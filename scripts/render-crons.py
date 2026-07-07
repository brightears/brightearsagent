#!/usr/bin/env python3
"""Create the three Render cron jobs that drive the web service's cron endpoints.

Lightweight design: each cron just pings an always-on web endpoint (which does
the work with its own DB + env). No heavy build, no duplicated logic.

Usage: RENDER_API_KEY=... python3 scripts/render-crons.py
"""
import json
import os
import urllib.request
import urllib.error

API = "https://api.render.com/v1"
OWNER = "tea-d13uhr3uibrs73btc1p0"
REPO = "https://github.com/brightears/brightearsagent"
BASE = "https://brightears-app.onrender.com"
KEY = os.environ["RENDER_API_KEY"]


def read_env(path):
    out = {}
    for line in open(path):
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            out[k.strip()] = v.strip()
    return out


SECRET = read_env("/tmp/prod-secrets.env")["CRON_SECRET"]

# Node one-liner (P7.3, audit 2026-07 — the old version was a FALSE-GREEN
# wrapper AND a secret leak): it resolved on any HTTP status (a 401 from a
# rotated secret or a 500 from a crashing tick printed the body and exited 0,
# so Render's cron dashboard showed success forever) and it passed the secret
# as ?secret= (into access logs). Now: Authorization header, res.ok checked,
# non-2xx exits 1, and a 120s abort so a hung tick shows up as a failure too.
# NOTE: the LIVE cron jobs still carry the old ?secret= command — reconfigure
# them (Render dashboard or API) to match; tracked in BUILD-JULY-2026 P7.3.
def cmd(path):
    url = f"{BASE}{path}"
    return (
        f"node -e \"fetch('{url}',{{headers:{{Authorization:'Bearer {SECRET}'}},"
        f"signal:AbortSignal.timeout(120000)}})"
        f".then(async r=>{{const t=await r.text();console.log(r.status,t);"
        f"if(!r.ok)process.exit(1)}})"
        f".catch(e=>{{console.error(e);process.exit(1)}})\""
    )


CRONS = [
    ("brightears-app-sequences", "*/30 * * * *", "/api/cron/sequences"),
    ("brightears-app-weekly-report", "0 14 * * 1", "/api/cron/weekly-report"),  # Mon 14:00 UTC
    ("brightears-app-margin-guardrail", "0 2 * * *", "/api/cron/margin-guardrail"),  # daily 02:00 UTC
    # Daily venue-discovery scan (the Hunt). CODIFICATION ONLY (audit C2): this
    # job ALREADY EXISTS as a live Render cron created ad hoc via the API — it
    # was never reproducible from code until now. Re-running this script will
    # try to POST a duplicate; skip this entry (or delete the live one first) if
    # you re-provision. Listed so the deploy config matches reality.
    ("brightears-app-discovery", "0 5 * * *", "/api/cron/discovery"),  # daily 05:00 UTC
]


def api(method, path, body=None):
    req = urllib.request.Request(
        f"{API}{path}", method=method,
        data=json.dumps(body).encode() if body else None,
        headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())


for name, schedule, endpoint in CRONS:
    payload = {
        "type": "cron_job",
        "name": name,
        "ownerId": OWNER,
        "repo": REPO,
        "branch": "main",
        "autoDeploy": "no",
        "serviceDetails": {
            "runtime": "node",
            "plan": "starter",
            "region": "singapore",
            "schedule": schedule,
            "envSpecificDetails": {
                "buildCommand": "echo no-build-needed",
                "startCommand": cmd(endpoint),
            },
        },
    }
    try:
        result = api("POST", "/services", payload)
        svc = result.get("service", result)
        print(f"+ {name} ({schedule}) -> {svc.get('id')}")
    except urllib.error.HTTPError as e:
        print(f"! {name}: {e.code} {e.read().decode()[:200]}")
