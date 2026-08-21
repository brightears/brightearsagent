#!/usr/bin/env python3
"""Plan or create the Bright Ears Render web service safely.

Dry-run is the default and performs no network calls. Applying requires an
explicit production Render environment group; this script never reads
`.env.local`, a temporary secret file, or local development/test credentials.

Examples:
  python3 scripts/render-deploy.py --env-group-id evg-...
  python3 scripts/render-deploy.py --env-group-id evg-... --apply

For --apply, supply RENDER_API_KEY through a secret-capable session. Do not put
the key in command history.

The created service starts with auto-deploy OFF. After the environment group is
linked, attach/verify the custom domain, trigger one manual deploy, run the live
smoke checklist, then explicitly select "After CI Checks Pass" in Render.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request


API = "https://api.render.com/v1"
OWNER = "tea-d13uhr3uibrs73btc1p0"
REPO = "https://github.com/brightears/brightearsagent"
SERVICE_NAME = "brightears-app"
APP_URL = "https://brightears.io"
BUILD_COMMAND = "npm ci && npm run build"
START_COMMAND = "npm start"
PREDEPLOY_COMMAND = "npm run db:deploy"
HEALTH_PATH = "/api/health"

REQUIRED_ENV = {
    "DATABASE_URL",
    "APP_URL",
    "POSTMARK_SERVER_TOKEN",
    "OUTBOUND_FROM",
    "SERPER_API_KEY",
    "OPENROUTER_API_KEY",
    "TOKEN_ENCRYPTION_KEY",
    "OPS_ALERT_EMAIL",
    "INBOUND_WEBHOOK_SECRET",
    "CRON_SECRET",
    "OPTOUT_SECRET",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
    "CLERK_SECRET_KEY",
    "GOOGLE_OAUTH_CLIENT_ID",
    "GOOGLE_OAUTH_CLIENT_SECRET",
    "R2_ACCOUNT_ID",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET",
    "R2_PUBLIC_BASE_URL",
    "VAPID_PUBLIC_KEY",
    "NEXT_PUBLIC_VAPID_PUBLIC_KEY",
    "VAPID_PRIVATE_KEY",
}


class RecoveryError(RuntimeError):
    """A safe, user-actionable recovery refusal."""


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--env-group-id",
        default=os.environ.get("BRIGHTEARS_PROD_ENV_GROUP_ID"),
        help="Dedicated production Render environment group (or BRIGHTEARS_PROD_ENV_GROUP_ID)",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Create/link resources. Omit for an offline, read-only plan.",
    )
    parser.add_argument(
        "--adopt-existing",
        action="store_true",
        help="Allow linking the environment group to an exact existing recovery service.",
    )
    args = parser.parse_args()
    if not args.env_group_id:
        parser.error("--env-group-id (or BRIGHTEARS_PROD_ENV_GROUP_ID) is required")
    return args


def api(key: str, method: str, path: str, body: object | None = None) -> object:
    request = urllib.request.Request(
        f"{API}{path}",
        method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            raw = response.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as error:
        detail = error.read().decode(errors="replace")[:500]
        raise RecoveryError(f"Render API {method} {path} failed ({error.code}): {detail}") from error
    except urllib.error.URLError as error:
        raise RecoveryError(f"Render API {method} {path} failed: {error.reason}") from error


def unwrap_service(item: object) -> dict:
    if not isinstance(item, dict):
        return {}
    service = item.get("service")
    return service if isinstance(service, dict) else item


def list_services(key: str) -> list[dict]:
    services: list[dict] = []
    cursor: str | None = None
    seen_cursors: set[str] = set()
    while True:
        params = {"ownerId": OWNER, "limit": 100, "includePreviews": "false"}
        if cursor:
            params["cursor"] = cursor
        response = api(key, "GET", f"/services?{urllib.parse.urlencode(params)}")
        if not isinstance(response, list):
            raise RecoveryError("Render returned an invalid service-list response")
        services.extend(unwrap_service(item) for item in response)
        if len(response) < 100:
            return services
        tail = response[-1]
        next_cursor = tail.get("cursor") if isinstance(tail, dict) else None
        if not isinstance(next_cursor, str) or not next_cursor or next_cursor in seen_cursors:
            raise RecoveryError("Render service pagination did not provide a safe next cursor")
        seen_cursors.add(next_cursor)
        cursor = next_cursor


def environment_group(
    key: str,
    group_id: str,
) -> tuple[dict[str, str], set[str], set[str]]:
    response = api(key, "GET", f"/env-groups/{urllib.parse.quote(group_id)}")
    if not isinstance(response, dict):
        raise RecoveryError("Render returned an invalid environment-group response")
    if response.get("ownerId") != OWNER:
        raise RecoveryError("production environment group belongs to a different workspace")
    values = {
        str(item.get("key")): str(item.get("value", ""))
        for item in response.get("envVars", [])
        if isinstance(item, dict) and item.get("key")
    }
    service_ids = {
        str(link.get("id"))
        for link in response.get("serviceLinks", [])
        if isinstance(link, dict) and link.get("id")
    }
    secret_files = {
        str(item.get("name"))
        for item in response.get("secretFiles", [])
        if isinstance(item, dict) and item.get("name")
    }
    return values, service_ids, secret_files


def direct_environment_keys(key: str, service_id: str) -> set[str]:
    keys: set[str] = set()
    cursor: str | None = None
    seen_cursors: set[str] = set()
    while True:
        params: dict[str, object] = {"limit": 100}
        if cursor:
            params["cursor"] = cursor
        response = api(
            key,
            "GET",
            f"/services/{urllib.parse.quote(service_id)}/env-vars?{urllib.parse.urlencode(params)}",
        )
        if not isinstance(response, list):
            raise RecoveryError("Render returned an invalid direct-environment response")
        for item in response:
            env_var = item.get("envVar") if isinstance(item, dict) else None
            if isinstance(env_var, dict) and env_var.get("key"):
                keys.add(str(env_var["key"]))
        if len(response) < 100:
            return keys
        tail = response[-1]
        next_cursor = tail.get("cursor") if isinstance(tail, dict) else None
        if not isinstance(next_cursor, str) or not next_cursor or next_cursor in seen_cursors:
            raise RecoveryError("Render environment pagination did not provide a safe next cursor")
        seen_cursors.add(next_cursor)
        cursor = next_cursor


def validate_environment(values: dict[str, str], secret_files: set[str]) -> None:
    errors: list[str] = []
    missing = sorted(key for key in REQUIRED_ENV if not values.get(key, "").strip())
    if missing:
        errors.append(f"missing required keys: {', '.join(missing)}")

    if values.get("APP_URL", "").strip() not in {APP_URL, f"{APP_URL}/"}:
        errors.append(f"APP_URL must be {APP_URL}")
    if values.get("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY") and not values[
        "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"
    ].startswith("pk_live_"):
        errors.append("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is not live-mode")
    if values.get("CLERK_SECRET_KEY") and not values["CLERK_SECRET_KEY"].startswith("sk_live_"):
        errors.append("CLERK_SECRET_KEY is not live-mode")
    if values.get("STRIPE_SECRET_KEY") and not values["STRIPE_SECRET_KEY"].startswith("sk_live_"):
        errors.append("STRIPE_SECRET_KEY is not live-mode")
    if values.get("STRIPE_WEBHOOK_SECRET") and not values["STRIPE_WEBHOOK_SECRET"].startswith(
        "whsec_"
    ):
        errors.append("STRIPE_WEBHOOK_SECRET is not an endpoint signing secret")
    if values.get("TOKEN_ENCRYPTION_KEY") and not re.fullmatch(
        r"[0-9a-fA-F]{64}", values["TOKEN_ENCRYPTION_KEY"].strip()
    ):
        errors.append("TOKEN_ENCRYPTION_KEY must be 64 hexadecimal characters")
    if values.get("VAPID_PUBLIC_KEY") != values.get("NEXT_PUBLIC_VAPID_PUBLIC_KEY"):
        errors.append("VAPID_PUBLIC_KEY and NEXT_PUBLIC_VAPID_PUBLIC_KEY must match")
    if values.get("R2_PUBLIC_BASE_URL") and not values["R2_PUBLIC_BASE_URL"].strip().lower().startswith(
        "https://"
    ):
        errors.append("R2_PUBLIC_BASE_URL must be HTTPS")
    beta_emails = [
        email.strip()
        for email in values.get("BETA_COMP_EMAILS", "").split(",")
        if email.strip()
    ]
    if any(not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email) for email in beta_emails):
        errors.append("BETA_COMP_EMAILS must contain only comma-separated email addresses")
    if values.get("EMAIL_TRANSPORT", "").strip().lower() == "dev":
        errors.append("EMAIL_TRANSPORT=dev is forbidden")
    if values.get("DISCOVERY_PROVIDER", "").strip().lower() == "stub":
        errors.append("DISCOVERY_PROVIDER=stub is forbidden")
    if secret_files:
        errors.append(
            "production group must use the reviewed environment manifest only; "
            f"remove secret files: {', '.join(sorted(secret_files))}"
        )

    if errors:
        raise RecoveryError("production environment group rejected: " + "; ".join(errors))


def desired_payload() -> dict:
    return {
        "type": "web_service",
        "name": SERVICE_NAME,
        "ownerId": OWNER,
        "repo": REPO,
        "branch": "main",
        # API service creation cannot express "After CI Checks Pass". OFF is
        # the safe recovery default; enable checks-pass only after live smoke.
        "autoDeploy": "no",
        "serviceDetails": {
            "runtime": "node",
            "plan": "starter",
            "region": "singapore",
            "envSpecificDetails": {
                "buildCommand": BUILD_COMMAND,
                "startCommand": START_COMMAND,
            },
            "preDeployCommand": PREDEPLOY_COMMAND,
            "healthCheckPath": HEALTH_PATH,
        },
    }


def existing_config_errors(service: dict) -> list[str]:
    details = service.get("serviceDetails") or {}
    env_details = details.get("envSpecificDetails") or {}
    checks = {
        "type": (service.get("type"), "web_service"),
        "repo": (str(service.get("repo", "")).removesuffix(".git"), REPO),
        "branch": (service.get("branch"), "main"),
        "auto-deploy": (service.get("autoDeploy"), "no"),
        "runtime": (details.get("runtime"), "node"),
        "plan": (details.get("plan"), "starter"),
        "region": (details.get("region"), "singapore"),
        "build command": (env_details.get("buildCommand"), BUILD_COMMAND),
        "start command": (env_details.get("startCommand"), START_COMMAND),
        "pre-deploy command": (env_details.get("preDeployCommand"), PREDEPLOY_COMMAND),
        "health path": (details.get("healthCheckPath"), HEALTH_PATH),
    }
    return [name for name, (actual, expected) in checks.items() if actual != expected]


def link_group(key: str, group_id: str, service_id: str) -> None:
    api(
        key,
        "POST",
        f"/env-groups/{urllib.parse.quote(group_id)}/services/{urllib.parse.quote(service_id)}",
    )


def main() -> int:
    args = parse_args()
    payload = desired_payload()

    if not args.apply:
        print("DRY RUN — no network calls and no Render changes")
        print(f"web service: {SERVICE_NAME} ({REPO}#main)")
        print(f"build/start: {BUILD_COMMAND} / {START_COMMAND}")
        print(f"pre-deploy/health: {PREDEPLOY_COMMAND} / {HEALTH_PATH}")
        print("auto-deploy: OFF (enable After CI Checks Pass only after live smoke)")
        print(f"production environment group: {args.env_group_id} (validated only with --apply)")
        return 0

    key = os.environ.get("RENDER_API_KEY", "").strip()
    if not key:
        raise RecoveryError("RENDER_API_KEY is required only with --apply")

    values, linked_ids, secret_files = environment_group(key, args.env_group_id)
    validate_environment(values, secret_files)

    matches = [service for service in list_services(key) if service.get("name") == SERVICE_NAME]
    if len(matches) > 1:
        raise RecoveryError(f"multiple services named {SERVICE_NAME}; refusing to guess")

    if matches:
        service = matches[0]
        service_id = str(service.get("id", ""))
        unrelated_links = linked_ids - {service_id}
        if unrelated_links:
            raise RecoveryError(
                "production environment group is linked to unrelated service ids: "
                + ", ".join(sorted(unrelated_links))
            )
        drift = existing_config_errors(service)
        if drift:
            raise RecoveryError(
                f"existing {SERVICE_NAME} differs in {', '.join(drift)}; review it manually"
            )
        direct_keys = direct_environment_keys(key, service_id)
        if direct_keys:
            raise RecoveryError(
                "existing service has direct environment variables that could override the "
                "reviewed group; migrate/remove these keys manually first: "
                + ", ".join(sorted(direct_keys))
            )
        if service_id not in linked_ids:
            if not args.adopt_existing:
                raise RecoveryError(
                    "exact service exists but is not linked to this environment group; "
                    "rerun with --adopt-existing only after verifying it is the recovery target"
                )
            link_group(key, args.env_group_id, service_id)
            print(f"linked production environment group to existing service {service_id}")
        else:
            print(f"no-op: exact service {service_id} already exists and is linked")
        return 0

    if linked_ids:
        raise RecoveryError(
            "production environment group is already linked to service ids: "
            + ", ".join(sorted(linked_ids))
        )

    result = api(key, "POST", "/services", payload)
    service = unwrap_service(result)
    service_id = str(service.get("id", ""))
    if not service_id:
        raise RecoveryError("service was created but Render returned no service id")

    link_group(key, args.env_group_id, service_id)
    print(f"created {SERVICE_NAME} ({service_id}) with auto-deploy OFF")
    print("linked the validated production environment group")
    print("NEXT: verify the custom domain, manually deploy, smoke-test, then enable After CI Checks Pass")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except RecoveryError as error:
        print(f"ERROR: {error}", file=sys.stderr)
        raise SystemExit(1)
