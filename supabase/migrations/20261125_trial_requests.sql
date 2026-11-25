-- Trial dari borang = PERMINTAAN. Admin perlu masukkan ke slot (status 'scheduled') sebelum dikira sah.
-- Bila sesi dibatalkan, admin diingatkan untuk maklumkan ibu bapa trial (cancel_notified_at).
begin;

alter table public.trials drop constraint trials_status_check;
alter table public.trials add constraint trials_status_check
  check (status = any (array['requested','scheduled','done','no_show','cancelled']));
alter table public.trials add column if not exists cancel_notified_at timestamptz;

-- Borang (pautan peribadi lama & borang umum): rekod sebagai permintaan, bukan terus dijadualkan.
create or replace function public.public_trial_submit(p_token text, p_child text, p_birth date, p_gender text, p_guardian text, p_class uuid, p_date date, p_medical text, p_notes text)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare l public.leads; c public.classes; age int; today date := timezone('Asia/Kuala_Lumpur', now())::date; st time;
begin
  select * into l from public.leads where trial_token = p_token and length(p_token) >= 16;
  if l.id is null then raise exception 'Pautan tidak sah atau sudah tamat.'; end if;
  if l.status in ('trial_scheduled','trial_done','requested','enrolled') then raise exception 'Trial sudah dijadualkan. Hubungi admin untuk sebarang perubahan.'; end if;
  if coalesce(trim(p_child), '') = '' then raise exception 'Isi nama pelajar.'; end if;
  select * into c from public.classes where id = p_class and active;
  if c.id is null or p_date <= today or p_date > today + 30
     or exists (select 1 from public.class_sessions s where s.class_id = c.id and s.session_date = p_date and s.status = 'cancelled')
     or not (extract(dow from p_date)::int = c.weekday
             or exists (select 1 from public.class_sessions s where s.class_id = c.id and s.session_date = p_date and s.status = 'scheduled')) then
    raise exception 'Slot trial tidak sah. Pilih semula.';
  end if;
  select coalesce(s.start_time, c.start_time) into st from (select 1) x left join public.class_sessions s on s.class_id = c.id and s.session_date = p_date;
  age := case when p_birth is not null then extract(year from age(p_date, p_birth))::int else l.child_age end;
  update public.leads set child_name = left(trim(p_child), 120), birth_date = p_birth, child_age = age, gender = nullif(p_gender, ''),
    guardian_name = coalesce(nullif(left(trim(coalesce(p_guardian, '')), 120), ''), guardian_name), medical_notes = left(nullif(trim(coalesce(p_medical, '')), ''), 500),
    programme_id = c.programme_id, venue_id = c.venue_id, status = 'trial_scheduled', submitted_at = now(),
    notes = concat_ws(E'\n', nullif(notes, ''), nullif(left(trim(coalesce(p_notes, '')), 500), ''))
  where id = l.id;
  insert into public.trials(lead_id, kind, venue_id, coach_id, trial_date, trial_time, status, class_id, child_name, child_age, notes)
  values (l.id, 'group_trial', c.venue_id, c.coach_id, p_date, coalesce(st, c.start_time), 'requested', c.id, left(trim(p_child), 120), age, left(nullif(trim(coalesce(p_medical, '')), ''), 500));
  perform public.notify_admins('trial', 'Permintaan trial baharu — sila sahkan slot', left(trim(p_child), 120) || ' · ' || to_char(p_date, 'DD/MM') || ' ' || to_char(coalesce(st, c.start_time), 'HH24:MI'), 'trial');
  return jsonb_build_object('ok', true);
end $function$;

-- Permintaan juga memegang tempat supaya kelas tidak terlebih tempah.
create or replace function public.shared_trial_slots(p_venue uuid, p_birth date, p_level text) returns jsonb
language sql stable security definer set search_path = ''
as $$
  with clock as (select timezone('Asia/Kuala_Lumpur', now()) as local_now),
  days as (
    select (local_now::date+i)::date as d, local_now from clock cross join generate_series(1,21) i
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
          when 'rally' then lower(trim(p.name)) ~ '^(foundation|beginner|performance|intermediate|competitive)( |$)'
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
        select count(*) from public.trials tr where tr.class_id=c.id and tr.trial_date=d.d and tr.status in ('requested','scheduled')
      )
  )
  select coalesce(jsonb_agg(jsonb_build_object('class_id', class_id, 'date', date, 'start', to_char(start_at,'HH24:MI'),
    'end', to_char(end_at,'HH24:MI'), 'programme', programme, 'programme_id', programme_id, 'venue', venue)
    order by date, start_at, programme, class_id), '[]'::jsonb) from eligible;
$$;

create or replace function public.public_trial_info(p_token text)
 returns jsonb language plpgsql stable security definer set search_path to 'public'
as $function$
declare l public.leads;
begin
  select * into l from public.leads where trial_token = p_token and length(p_token) >= 16;
  if l.id is null then return jsonb_build_object('ok', false); end if;
  return jsonb_build_object('ok', true,
    'done', l.status in ('trial_scheduled','trial_done','requested','enrolled'),
    'lead', jsonb_build_object('child_name', l.child_name, 'child_age', l.child_age, 'guardian_name', l.guardian_name, 'phone', l.phone, 'programme_id', l.programme_id, 'venue_id', l.venue_id, 'birth_date', l.birth_date, 'gender', l.gender),
    'academy', (select value->>'name' from public.settings where key = 'academy'),
    'age_groups', (select value from public.settings where key = 'age_groups'),
    'slots', coalesce((select jsonb_agg(x order by x->>'date', x->>'start') from (
      select jsonb_build_object('class_id', c.id, 'date', d::date, 'start', to_char(c.start_time, 'HH24:MI'), 'end', to_char(c.end_time, 'HH24:MI'),
             'programme', p.name, 'programme_id', p.id, 'venue', v.name, 'venue_id', v.id, 'categories', c.categories,
             'left', c.capacity - (select count(*) from public.class_enrolments e where e.class_id = c.id)
                    - (select count(*) from public.trials t where t.class_id = c.id and t.trial_date = d::date and t.status in ('requested','scheduled'))) x
      from public.classes c join public.programmes p on p.id = c.programme_id join public.venues v on v.id = c.venue_id
      cross join generate_series(current_date + 1, current_date + 21, interval '1 day') d
      where c.active and p.kind = 'group' and extract(dow from d)::int = c.weekday
        and not exists (select 1 from public.class_sessions s where s.class_id = c.id and s.session_date = d::date and s.status = 'cancelled')) q), '[]'::jsonb));
end $function$;

-- Portal: 'pending' sehingga admin sahkan slot.
create or replace function public.shared_trial_portal(p_token text) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'status', case when t.status='cancelled' or s.status='cancelled' then 'cancelled'
      when t.status='done' then 'completed' when t.status='no_show' then 'not_attended'
      when t.trial_date < timezone('Asia/Kuala_Lumpur',now())::date then 'past'
      when t.status='requested' then 'pending'
      else 'confirmed' end,
    'date', t.trial_date, 'start', to_char(coalesce(s.start_time,t.trial_time,c.start_time),'HH24:MI'),
    'end', to_char(coalesce(s.end_time,c.end_time),'HH24:MI'), 'programme', p.name,
    'venue', v.name, 'court', case when t.status='scheduled' then coalesce(g.court,s.court,c.court) end
  )
  from public.trial_portal_access a
  join public.leads l on l.id=a.lead_id and l.archived_at is null
  join lateral (select tr.* from public.trials tr where tr.lead_id=l.id order by (tr.status in ('requested','scheduled')) desc, tr.trial_date desc, tr.id desc limit 1) t on true
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

create or replace function public.shared_trial_book(p jsonb) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  tok text := p->>'token';
  child text := trim(p->>'child');
  guardian text := trim(p->>'guardian');
  v_raw text := regexp_replace(coalesce(p->>'phone',''), '[^0-9]', '', 'g');
  v_phone text := case when v_raw like '0%' then '60'||substr(v_raw,2) else v_raw end;
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
     or coalesce(length(guardian),0) not between 2 and 120 or length(v_phone) not between 9 and 15
     or coalesce((p->>'consent')::boolean,false) is not true or birth is null or level is null
     or venue is null or cls is null or day is null then
    return jsonb_build_object('ok',false,'code','invalid_details');
  end if;
  perform pg_advisory_xact_lock(hashtextextended('shared-trial:'||tok,0));
  if exists (select 1 from public.trial_portal_access a where a.token_hash=sha256(convert_to(tok,'UTF8'))) then
    if public.shared_trial_portal(tok) is null then
      return jsonb_build_object('ok',false,'code','expired');
    end if;
    return jsonb_build_object('ok',true);
  end if;
  perform pg_advisory_xact_lock(hashtextextended('shared-trial-contact:'||v_phone,0));
  if (select count(*) from public.trial_portal_access a join public.leads l on l.id=a.lead_id
      where regexp_replace(l.phone,'[^0-9]','','g')=v_phone and a.created_at > now()-interval '7 days') >= 3 then
    return jsonb_build_object('ok',false,'code','too_many');
  end if;
  if (select count(*) from public.trial_portal_access a where a.created_at > now()-interval '1 hour') >= 30 then
    return jsonb_build_object('ok',false,'code','busy');
  end if;
  if exists (
    select 1 from public.leads l join public.trials t on t.lead_id=l.id
    where l.archived_at is null and lower(trim(l.child_name))=lower(child)
      and (regexp_replace(l.phone,'[^0-9]','','g') in (v_phone,v_raw)
           or (v_phone like '60%' and regexp_replace(l.phone,'[^0-9]','','g')='0'||substr(v_phone,3)))
      and t.kind='group_trial' and t.status in ('requested','scheduled','done')
  ) then
    return jsonb_build_object('ok',false,'code','duplicate');
  end if;
  perform 1 from public.classes c where c.id=cls for update;
  select sl into choice from jsonb_array_elements(public.shared_trial_slots(venue,birth,level)) sl
  where sl->>'class_id'=cls::text and sl->>'date'=day::text;
  if choice is null then return jsonb_build_object('ok',false,'code','slot_unavailable'); end if;

  legacy_token := replace(gen_random_uuid()::text,'-','');
  insert into public.leads (child_name, child_age, birth_date, guardian_name, phone, source, status, kind, venue_id, programme_id, experience, trial_token)
  values (child,extract(year from age(timezone('Asia/Kuala_Lumpur',now())::date,birth))::int,birth,guardian,v_phone,'WhatsApp','contacted','group_trial',venue,
    (choice->>'programme_id')::uuid,level,legacy_token)
  returning id into lead;
  perform public.public_trial_submit(legacy_token,child,birth,null,guardian,cls,day,null,null);
  if not exists (select 1 from public.trials t where t.lead_id=lead and t.class_id=cls and t.trial_date=day and t.status in ('requested','scheduled')) then
    raise exception 'Trial booking was not recorded';
  end if;
  insert into public.trial_portal_access (token_hash,lead_id) values (sha256(convert_to(tok,'UTF8')),lead);
  return jsonb_build_object('ok',true);
end;
$$;

commit;
