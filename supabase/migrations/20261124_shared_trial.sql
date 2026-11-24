-- Deploy to staging and verify against the existing Maxxima schema before publishing Pages.
begin;

do $$
begin
  if to_regprocedure('public.public_trial_submit(text,text,date,text,text,uuid,date,text,text)') is null then
    raise exception 'Check the existing public_trial_submit signature in staging before installing this migration';
  end if;
end;
$$;

create table public.trial_portal_access (
  token_hash bytea primary key,
  lead_id uuid not null unique references public.leads(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.trial_portal_access enable row level security;
revoke all on public.trial_portal_access from anon, authenticated, public;
create index trial_portal_access_created_idx on public.trial_portal_access(created_at);

create function public.shared_trial_venues() returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', v.id, 'name', v.name) order by v.name), '[]'::jsonb)
  from public.venues v
  where v.active and exists (select 1 from public.classes c join public.programmes p on p.id=c.programme_id
    where c.venue_id=v.id and c.active and p.active and p.kind='group');
$$;

-- Read only scheduled, not-yet-started group options at the chosen venue. Use the same
-- checks before reserving. Classes without configured categories can take any junior age;
-- adults only see Adult classes, and juniors never see Adult classes.
create function public.shared_trial_slots(p_venue uuid, p_birth date, p_level text) returns jsonb
language sql stable security definer set search_path = ''
as $$
  with clock as (select timezone('Asia/Kuala_Lumpur', now()) as local_now),
  days as (
    select (local_now::date+i)::date as d, local_now from clock cross join generate_series(0,20) i
  ),
  groups as (
    select coalesce(
      (select value::jsonb from public.settings where key='age_groups' and jsonb_typeof(value::jsonb)='array'
        and value::jsonb <> '[]'::jsonb),
      '[{"code":"U8","min":0,"max":8},{"code":"U12","min":9,"max":12},{"code":"U17","min":13,"max":17},{"code":"Dewasa","min":18,"max":99}]'::jsonb
    ) as arr
  ),
  eligible as (
    select c.id as class_id, d.d as date, p.name as programme, p.id as programme_id, v.name as venue,
      coalesce(s.start_time,c.start_time) as start_at, coalesce(s.end_time,c.end_time) as end_at
    from public.classes c
    join public.programmes p on p.id=c.programme_id and p.active and p.kind='group'
    cross join days d cross join groups g
    left join public.class_sessions s on s.class_id=c.id and s.session_date=d.d
    join public.venues v on v.id=coalesce(s.venue_id,c.venue_id) and v.active and v.id=p_venue
    cross join lateral (select extract(year from age(d.d,p_birth))::int as years) a
    where c.active and (c.weekday=extract(dow from d.d) or s.status='scheduled')
      and (s.id is null or s.status='scheduled')
      and d.d + coalesce(s.start_time,c.start_time) > d.local_now
      and p_birth <= d.local_now::date and a.years between 3 and 99
      and p_level in ('new','rally','match','unsure')
      and (
        (a.years >= 18 and lower(trim(p.name)) ~ '^adult( |$)') or
        (a.years < 18 and case p_level
          when 'new' then lower(trim(p.name)) ~ '^(foundation|beginner)( |$)'
          when 'unsure' then lower(trim(p.name)) ~ '^(foundation|beginner)( |$)'
          when 'rally' then lower(trim(p.name)) ~ '^(foundation|beginner|performance|intermediate)( |$)'
          when 'match' then lower(trim(p.name)) ~ '^(performance|intermediate|elite|competitive)( |$)'
          else false end)
      )
      and (coalesce(cardinality(c.categories),0)=0 or exists (
        select 1 from jsonb_array_elements(g.arr) ag
        where ag->>'code'=any(c.categories) and a.years between (ag->>'min')::int and (ag->>'max')::int
      ))
      and c.capacity > (
        select count(distinct learner_id) from (
          select e.student_id as learner_id from public.class_enrolments e
          join public.students st on st.id=e.student_id
          where e.class_id=c.id and st.status='active'
          union
          select att.student_id from public.attendance att where att.session_id=s.id
        ) learners
      ) + (
        select count(*) from public.trials tr where tr.class_id=c.id and tr.trial_date=d.d and tr.status='scheduled'
      )
  )
  select coalesce(jsonb_agg(jsonb_build_object('class_id', class_id, 'date', date, 'start', to_char(start_at,'HH24:MI'),
    'end', to_char(end_at,'HH24:MI'), 'programme', programme, 'programme_id', programme_id, 'venue', venue)
    order by date, start_at, programme, class_id), '[]'::jsonb) from eligible;
$$;

-- No parent/student details are returned even when a valid link is presented.
create function public.shared_trial_portal(p_token text) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'status', case when t.status='cancelled' or s.status='cancelled' then 'cancelled'
      when t.status='done' then 'completed' when t.status='no_show' then 'not_attended'
      when t.trial_date < timezone('Asia/Kuala_Lumpur',now())::date then 'past'
      else 'confirmed' end,
    'date', t.trial_date, 'start', to_char(coalesce(s.start_time,t.trial_time,c.start_time),'HH24:MI'),
    'end', to_char(coalesce(s.end_time,c.end_time),'HH24:MI'), 'programme', p.name,
    'venue', v.name, 'court', coalesce(g.court,s.court,c.court)
  )
  from public.trial_portal_access a
  join public.leads l on l.id=a.lead_id and l.archived_at is null
  join lateral (select tr.* from public.trials tr where tr.lead_id=l.id order by (tr.status='scheduled') desc, tr.trial_date desc, tr.id desc limit 1) t on true
  left join public.classes c on c.id=t.class_id
  left join public.class_sessions s on s.class_id=t.class_id and s.session_date=t.trial_date
  left join public.programmes p on p.id=coalesce(c.programme_id,l.programme_id)
  left join public.venues v on v.id=coalesce(s.venue_id,c.venue_id,t.venue_id)
  left join lateral (
    select sg.court from public.session_groups sg where sg.session_id=s.id and sg.court is not null
      and exists (
        select 1 from jsonb_array_elements(coalesce(
          (select value::jsonb from public.settings where key='age_groups' and jsonb_typeof(value::jsonb)='array'
            and value::jsonb <> '[]'::jsonb),
          '[{"code":"U8","min":0,"max":8},{"code":"U12","min":9,"max":12},{"code":"U17","min":13,"max":17},{"code":"Dewasa","min":18,"max":99}]'::jsonb
        )) ag
        where ag->>'code'=sg.category
        and extract(year from age(t.trial_date,l.birth_date)) between (ag->>'min')::int and (ag->>'max')::int
      ) limit 1
  ) g on true
  where p_token ~ '^[a-f0-9]{64}$'
    and a.token_hash=sha256(convert_to(p_token,'UTF8'))
    and timezone('Asia/Kuala_Lumpur',now())::date <= t.trial_date+7
    and now() < a.created_at+interval '60 days';
$$;

create function public.shared_trial_book(p jsonb) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  tok text := p->>'token';
  child text := trim(p->>'child');
  guardian text := trim(p->>'guardian');
  raw_phone text := regexp_replace(coalesce(p->>'phone',''), '[^0-9]', '', 'g');
  phone text := case when raw_phone like '0%' then '60'||substr(raw_phone,2) else raw_phone end;
  venue uuid := (p->>'venue')::uuid;
  birth date := (p->>'birth')::date;
  level text := p->>'level';
  cls uuid := (p->>'class_id')::uuid;
  day date := (p->>'date')::date;
  choice jsonb;
  lead uuid;
  legacy_token text;
begin
  if tok is null or tok !~ '^[a-f0-9]{64}$' or coalesce(length(child),0) not between 2 and 120
     or coalesce(length(guardian),0) not between 2 and 120 or length(phone) not between 9 and 15
     or coalesce((p->>'consent')::boolean,false) is not true or birth is null or level is null
     or venue is null or cls is null or day is null then
    return jsonb_build_object('ok',false,'code','invalid_details');
  end if;
  -- Lock retries and duplicate contact+child submissions; a retry after a lost response
  -- gets the existing portal rather than creating a second booking.
  perform pg_advisory_xact_lock(hashtextextended('shared-trial:'||tok,0));
  if exists (select 1 from public.trial_portal_access a where a.token_hash=sha256(convert_to(tok,'UTF8'))) then
    if public.shared_trial_portal(tok) is null then
      return jsonb_build_object('ok',false,'code','expired');
    end if;
    return jsonb_build_object('ok',true);
  end if;
  perform pg_advisory_xact_lock(hashtextextended('shared-trial-contact:'||phone,0));
  if exists (
    select 1 from public.leads l join public.trials t on t.lead_id=l.id
    where l.archived_at is null and lower(trim(l.child_name))=lower(child)
      and (regexp_replace(l.phone,'[^0-9]','','g') in (phone,raw_phone)
           or (phone like '60%' and regexp_replace(l.phone,'[^0-9]','','g')='0'||substr(phone,3)))
      and t.kind='group_trial' and t.status in ('scheduled','done')
  ) then
    return jsonb_build_object('ok',false,'code','duplicate');
  end if;
  -- Serialize competing shared-link reservations for the same class. Legacy booking
  -- validation remains in place, including any existing server-side capacity checks.
  perform 1 from public.classes c where c.id=cls for update;
  select sl into choice from jsonb_array_elements(public.shared_trial_slots(venue,birth,level)) sl
  where sl->>'class_id'=cls::text and sl->>'date'=day::text;
  if choice is null then return jsonb_build_object('ok',false,'code','slot_unavailable'); end if;

  legacy_token := replace(gen_random_uuid()::text,'-','');
  insert into public.leads (child_name, child_age, birth_date, guardian_name, phone, source, status, kind, venue_id, programme_id, experience, trial_token)
  values (child,extract(year from age(timezone('Asia/Kuala_Lumpur',now())::date,birth))::int,birth,guardian,phone,'WhatsApp','contacted','group_trial',venue,
    (choice->>'programme_id')::uuid,level,legacy_token)
  returning id into lead;
  perform public.public_trial_submit(legacy_token,child,birth,null,guardian,cls,day,null,null);
  if not exists (select 1 from public.trials t where t.lead_id=lead and t.class_id=cls and t.trial_date=day and t.status='scheduled') then
    raise exception 'Trial booking was not confirmed';
  end if;
  insert into public.trial_portal_access (token_hash,lead_id) values (sha256(convert_to(tok,'UTF8')),lead);
  return jsonb_build_object('ok',true);
end;
$$;

revoke execute on function public.shared_trial_venues(), public.shared_trial_slots(uuid,date,text), public.shared_trial_book(jsonb), public.shared_trial_portal(text)
  from public;
grant execute on function public.shared_trial_venues(), public.shared_trial_slots(uuid,date,text), public.shared_trial_book(jsonb), public.shared_trial_portal(text)
  to anon, authenticated;
notify pgrst, 'reload schema';
commit;
