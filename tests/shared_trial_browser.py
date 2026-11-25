"""Run against a local copy of Maxxima, with Playwright and Chromium installed.

    python3 -m http.server 8038
    python3 tests/shared_trial_browser.py
"""
import os
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get("MAXXIMA_TEST_URL", "http://localhost:8038")
URL = BASE + "/trial.html"
DATE = "2099-02-17"
TOKENS = {}
SLOTS = [
    {"class_id": "junior", "date": DATE, "start": "09:00", "end": "11:00", "programme": "Foundation", "venue": "Forum SBA"},
    {"class_id": "senior", "date": DATE, "start": "16:00", "end": "18:00", "programme": "Adult", "venue": "GoTeam"},
]
# Mock the remote client at the boundary; production PostgreSQL is not accessed.
was_full = False

def handle(route):
    global was_full
    method = route.request.url.rsplit("/", 1)[1]
    args = route.request.post_data_json or {}
    result = None
    if method == "shared_trial_venues":
        result = [{"id": "forum", "name": "Forum SBA"}, {"id": "goteam", "name": "GoTeam"}]
    if method == "shared_trial_slots":
        if args == {"p_birth": "2015-01-11", "p_venue": "forum", "p_level": "new"}:
            result = [SLOTS[0]]
        elif args == {"p_birth": "1994-01-11", "p_venue": "goteam", "p_level": "new"}:
            result = [SLOTS[1]]
        else:
            result = []
    if method == "shared_trial_book":
        payload = args["p"]
        assert payload["child"] == "Example Player"
        assert payload["guardian"] == "Example Guardian"
        assert payload["phone"] == "0123456789"
        assert payload["class_id"] == "senior"
        assert payload["venue"] == "goteam"
        assert payload["consent"]
        assert len(payload["token"]) == 64
        if not was_full:
            was_full = True
            result = {"ok": False, "code": "slot_unavailable"}
        else:
            TOKENS[payload["token"]] = {**SLOTS[1], "status": "confirmed", "court": "4"}
            result = {"ok": True}
    if method == "shared_trial_portal":
        result = TOKENS.get(args["p_token"])
    if method == "public_trial_info":
        assert args["p_token"] == "existing-per-lead"
        result = {"ok": True, "done": False, "lead": {"child_name": "Legacy Player"}, "slots": []}
    route.fulfill(json=result)

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(executable_path=os.environ.get("CHROMIUM", "/usr/bin/chromium"), args=["--no-sandbox"])
    context = browser.new_context()
    context.route("**/js/config.js", lambda r:r.fulfill(content_type="application/javascript",
        body="export const CONFIG = {SUPABASE_URL: 'fake', SUPABASE_ANON_KEY: 'fake'};"))
    context.route("https://cdn.jsdelivr.net/npm/@supabase/**", lambda r:r.fulfill(content_type="application/javascript",
        body="export const createClient = () => ({rpc: async (method,args) => ({data: await fetch('/mock/'+method,{method:'POST',body:JSON.stringify(args || {})}).then(r=>r.json())})});"))
    context.route("**/mock/*", handle)
    page = context.new_page()
    page.goto(URL)
    expect(page.get_by_role("heading",name="Book a Free Group Trial")).to_be_visible()
    page.locator("[name=birth]").fill("2015-01-11")
    page.locator("[name=venue]").select_option("forum")
    page.locator("[name=level]").select_option("new")
    expect(page.get_by_text("Foundation · Forum SBA")).to_be_visible()
    page.locator("[name=slot]").check()
    page.locator("[name=level]").select_option("match")
    expect(page.get_by_text("No suitable slots at this venue", exact=False)).to_be_visible()
    expect(page.get_by_role("button",name="Confirm Trial Slot")).to_be_disabled()
    page.locator("[name=birth]").fill("1994-01-11")
    page.locator("[name=venue]").select_option("goteam")
    page.locator("[name=level]").select_option("new")
    expect(page.get_by_text("Adult · GoTeam")).to_be_visible()
    page.locator("[name=slot]").check()
    page.locator("[name=child]").fill("Example Player")
    page.locator("[name=guardian]").fill("Example Guardian")
    page.locator("[name=phone]").fill("0123456789")
    page.locator("[name=consent]").check()
    page.get_by_role("button",name="Confirm Trial Slot").click()
    expect(page.get_by_text("That slot is no longer available.",exact=False)).to_be_visible()
    expect(page.get_by_role("button",name="Confirm Trial Slot")).to_be_disabled()
    page.locator("[name=slot]").check()
    page.get_by_role("button",name="Confirm Trial Slot").click()
    expect(page.get_by_role("heading",name="Trial Portal")).to_be_visible()
    expect(page.locator("dd").last).to_have_text("4")
    portal = page.url
    assert "?t=" not in portal and "#reservation=" in portal
    token = portal.split("#reservation=")[1]
    assert "Example Player" not in page.locator("body").inner_text()
    TOKENS[token]["status"] = "cancelled"
    page.get_by_role("button",name="Refresh details").click()
    expect(page.get_by_text("Please do not travel",exact=False)).to_be_visible()
    expect(page.get_by_text("Court",exact=True)).to_have_count(0)
    page.goto(URL + "#reservation=" + "a"*64)
    page.reload()
    expect(page.get_by_text("invalid or has expired",exact=False)).to_be_visible()
    page.goto(URL + "?t=existing-per-lead")
    expect(page.locator("[name=child]")).to_have_value("Legacy Player")
    browser.close()
print("Shared trial flow passed: slot filtering and invalidation, full-slot retry, private portal, cancellation refresh, expired link and legacy route.")
