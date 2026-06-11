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

# Node one-liner: ping the endpoint, fail (non-zero exit) on error so Render flags it.
def cmd(path):
    url = f"{BASE}{path}?secret={SECRET}"
    return (
        f"node -e \"fetch('{url}').then(r=>r.text()).then(t=>{{console.log(t);}})"
        f".catch(e=>{{console.error(e);process.exit(1)}})\""
    )


CRONS = [
    ("brightears-app-sequences", "*/30 * * * *", "/api/cron/sequences"),
    ("brightears-app-weekly-report", "0 14 * * 1", "/api/cron/weekly-report"),  # Mon 14:00 UTC
    ("brightears-app-margin-guardrail", "0 2 * * *", "/api/cron/margin-guardrail"),  # daily 02:00 UTC
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
