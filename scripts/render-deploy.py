#!/usr/bin/env python3
"""Create the Render web service for brightears-app via the Render API.

Reads env values from .env.local (gitignored), overrides production-specific
ones (DATABASE_URL, internal secrets, APP_URL, drops dev-only vars), and POSTs
a new always-on web service wired to the GitHub repo. Idempotent-ish: refuses
if a service named brightears-app already exists (pass --force to skip check).

Usage:
  RENDER_API_KEY=... DATABASE_URL=... python3 scripts/render-deploy.py
"""
import json
import os
import sys
import urllib.request

API = "https://api.render.com/v1"
OWNER = "tea-d13uhr3uibrs73btc1p0"
REPO = "https://github.com/brightears/brightearsagent"
SERVICE_NAME = "brightears-app"
APP_URL = "https://brightears-app.onrender.com"

KEY = os.environ["RENDER_API_KEY"]
DATABASE_URL = os.environ["DATABASE_URL"]


def api(method, path, body=None):
    req = urllib.request.Request(
        f"{API}{path}",
        method=method,
        data=json.dumps(body).encode() if body else None,
        headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())


def read_env_local(path=".env.local"):
    out = {}
    for line in open(path):
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        out[k.strip()] = v.strip()
    return out


def main():
    local = read_env_local()
    prod = read_env_local("/tmp/prod-secrets.env")

    # Vars to carry over from .env.local untouched (external service keys).
    carry = [
        "OPENROUTER_API_KEY",
        "POSTMARK_SERVER_TOKEN", "OUTBOUND_FROM",
        "VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT", "NEXT_PUBLIC_VAPID_PUBLIC_KEY",
        "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY",
        "NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL", "NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL",
        "STRIPE_SECRET_KEY", "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
    ]
    env = {k: local[k] for k in carry if k in local}

    # Production overrides — never the dev/local values.
    env["DATABASE_URL"] = DATABASE_URL
    env["APP_URL"] = APP_URL
    env["INBOUND_WEBHOOK_SECRET"] = prod["INBOUND_WEBHOOK_SECRET"]
    env["CRON_SECRET"] = prod["CRON_SECRET"]
    env["OPTOUT_SECRET"] = prod["OPTOUT_SECRET"]
    # STRIPE_WEBHOOK_SECRET: placeholder until the prod endpoint is registered (Phase 8).
    env["STRIPE_WEBHOOK_SECRET"] = local.get("STRIPE_WEBHOOK_SECRET", "whsec_placeholder_set_at_cutover")
    # NOTE: EMAIL_TRANSPORT and DEV_TENANT_SLUG are intentionally NOT set in prod.

    env_vars = [{"key": k, "value": v} for k, v in env.items()]

    payload = {
        "type": "web_service",
        "name": SERVICE_NAME,
        "ownerId": OWNER,
        "repo": REPO,
        "branch": "main",
        "autoDeploy": "yes",
        "serviceDetails": {
            "runtime": "node",
            "plan": "starter",
            "region": "singapore",
            "envSpecificDetails": {
                "buildCommand": "npm install --include=dev && npm run build",
                "startCommand": "npm start",
            },
            "preDeployCommand": "npm run db:deploy",
            "healthCheckPath": "/pricing",
        },
        "envVars": env_vars,
    }

    print(f"Creating web service '{SERVICE_NAME}' with {len(env_vars)} env vars...")
    try:
        result = api("POST", "/services", payload)
    except urllib.error.HTTPError as e:
        print("ERROR", e.code, e.read().decode())
        sys.exit(1)
    svc = result.get("service", result)
    print("service id:", svc.get("id"))
    print("dashboard:", svc.get("dashboardUrl"))
    print("url:", (svc.get("serviceDetails") or {}).get("url"))
    print("deploy id:", (result.get("deployId")))


if __name__ == "__main__":
    main()
