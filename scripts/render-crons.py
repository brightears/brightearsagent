#!/usr/bin/env python3
"""Plan or create the four Bright Ears Render cron wrappers safely.

Dry-run is the default. Applying requires a dedicated Render environment group
that contains only CRON_SECRET, plus an API key. Existing exact jobs are a
no-op; drift or duplicate names fail closed instead of silently returning 0.

Examples:
  python3 scripts/render-crons.py --env-group-id evg-...
  python3 scripts/render-crons.py --env-group-id evg-... --apply

For --apply, supply RENDER_API_KEY through a secret-capable session. Do not put
the key in command history.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request


API = "https://api.render.com/v1"
OWNER = "tea-d13uhr3uibrs73btc1p0"
REPO = "https://github.com/brightears/brightearsagent"
DEFAULT_BASE = "https://brightears.io"
# Server routes declare a 300-second ceiling and discovery stops tenant work at
# 240 seconds. Give the HTTP response 30 seconds of headroom; the old 120-second
# wrapper aborted legitimate discovery work while the server kept running.
REQUEST_TIMEOUT_MS = 330_000

CRONS = [
    ("brightears-app-sequences", "*/30 * * * *", "/api/cron/sequences"),
    ("brightears-app-weekly-report", "0 14 * * 1", "/api/cron/weekly-report"),
    ("brightears-app-margin-guardrail", "0 2 * * *", "/api/cron/margin-guardrail"),
    ("brightears-app-discovery", "0 5 * * *", "/api/cron/discovery"),
]


class RecoveryError(RuntimeError):
    """A safe, user-actionable recovery refusal."""


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--env-group-id",
        default=os.environ.get("BRIGHTEARS_CRON_ENV_GROUP_ID"),
        help="Dedicated CRON_SECRET Render env group (or BRIGHTEARS_CRON_ENV_GROUP_ID)",
    )
    parser.add_argument(
        "--app-url",
        default=DEFAULT_BASE,
        help=f"Canonical web origin (default: {DEFAULT_BASE})",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Create/link resources. Omit for an offline, read-only plan.",
    )
    parser.add_argument(
        "--adopt-existing",
        action="store_true",
        help="Allow linking the secret group to exact existing cron jobs.",
    )
    args = parser.parse_args()
    if not args.env_group_id:
        parser.error("--env-group-id (or BRIGHTEARS_CRON_ENV_GROUP_ID) is required")
    args.app_url = args.app_url.rstrip("/")
    if args.app_url != DEFAULT_BASE:
        parser.error(f"--app-url must be the canonical {DEFAULT_BASE} origin")
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
        raise RecoveryError("cron environment group belongs to a different workspace")
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


def validate_cron_group(values: dict[str, str], secret_files: set[str]) -> None:
    if not values.get("CRON_SECRET", "").strip():
        raise RecoveryError("cron environment group is missing CRON_SECRET")
    extras = sorted(key for key in values if key != "CRON_SECRET")
    if extras:
        raise RecoveryError(
            "cron jobs require a least-privilege group containing only CRON_SECRET; "
            f"remove: {', '.join(extras)}"
        )
    if secret_files:
        raise RecoveryError(
            "cron environment group must not contain secret files; remove: "
            + ", ".join(sorted(secret_files))
        )


def command(base: str, path: str) -> str:
    url = f"{base}{path}"
    # Endpoint bodies contain slugs, recipient addresses and provider errors.
    # The scheduler log needs an HTTP verdict and small aggregate counters,
    # never the raw body. Only explicitly allowlisted numeric fields survive;
    # nested objects/arrays/strings are ignored and values are clamped.
    safe_count_keys = (
        "['tenants','cutOff','errors','sent','failed','checked','nagged','skipped',"
        "'stepsFired','draftAttempts','draftFailures','scheduledSent','scheduledBlocked',"
        "'stuckVenuePitches','expiredDrafts','backfilledRuns','redraftedLeads','agingPings',"
        "'exhausted']"
    )
    return (
        f"node -e \"fetch('{url}',{{headers:{{Authorization:'Bearer '+process.env.CRON_SECRET}},"
        f"signal:AbortSignal.timeout({REQUEST_TIMEOUT_MS})}})"
        ".then(async r=>{let body={};try{body=await r.json()}catch{};"
        f"const keys={safe_count_keys};const counts={{}};"
        "const sources=[['',body],['freshness.',body?.freshness],['roi.',body?.roi],"
        "['reconcile.',body?.reconcile]];"
        "for(const [prefix,source] of sources){if(!source||typeof source!=='object')continue;"
        "for(const key of keys){const value=source[key];if(typeof value==='number'&&Number.isFinite(value))"
        "counts[prefix+key]=Math.max(-1000000000,Math.min(1000000000,Math.trunc(value)))}}"
        "console.log(JSON.stringify({status:r.status,counts}));if(!r.ok)process.exitCode=1})"
        ".catch(()=>{console.error(JSON.stringify({kind:'request_failed'}));process.exit(1)})\""
    )


def desired_payload(name: str, schedule: str, endpoint: str, base: str) -> dict:
    return {
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
                "startCommand": command(base, endpoint),
            },
        },
    }


def existing_config_errors(
    service: dict,
    schedule: str,
    endpoint: str,
    base: str,
) -> list[str]:
    details = service.get("serviceDetails") or {}
    env_details = details.get("envSpecificDetails") or {}
    checks = {
        "type": (service.get("type"), "cron_job"),
        "repo": (str(service.get("repo", "")).removesuffix(".git"), REPO),
        "branch": (service.get("branch"), "main"),
        "auto-deploy": (service.get("autoDeploy"), "no"),
        "runtime": (details.get("runtime"), "node"),
        "plan": (details.get("plan"), "starter"),
        "region": (details.get("region"), "singapore"),
        "schedule": (details.get("schedule"), schedule),
        "build command": (env_details.get("buildCommand"), "echo no-build-needed"),
        "start command": (env_details.get("startCommand"), command(base, endpoint)),
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

    if not args.apply:
        print("DRY RUN — no network calls and no Render changes")
        print(f"target: {args.app_url}; request timeout: {REQUEST_TIMEOUT_MS // 1000}s")
        for name, schedule, endpoint in CRONS:
            print(f"cron: {name} | {schedule} UTC | {endpoint} | auto-deploy OFF")
        print(f"least-privilege cron environment group: {args.env_group_id} (validated with --apply)")
        return 0

    key = os.environ.get("RENDER_API_KEY", "").strip()
    if not key:
        raise RecoveryError("RENDER_API_KEY is required only with --apply")

    values, linked_ids, secret_files = environment_group(key, args.env_group_id)
    validate_cron_group(values, secret_files)
    services = list_services(key)

    # Refuse every detectable conflict before the first mutation. If a later
    # network request still fails, a rerun is idempotent: already-created exact
    # jobs are treated as no-ops and processing resumes with the missing ones.
    plans: list[tuple[str, str, str, dict | None]] = []
    expected_existing_ids: set[str] = set()
    for name, schedule, endpoint in CRONS:
        matches = [service for service in services if service.get("name") == name]
        if len(matches) > 1:
            raise RecoveryError(f"multiple services named {name}; refusing to guess")

        if matches:
            service = matches[0]
            service_id = str(service.get("id", ""))
            expected_existing_ids.add(service_id)
            drift = existing_config_errors(service, schedule, endpoint, args.app_url)
            if drift:
                raise RecoveryError(
                    f"existing {name} differs in {', '.join(drift)}; review/update it manually"
                )
            direct_keys = direct_environment_keys(key, service_id)
            if direct_keys:
                raise RecoveryError(
                    f"existing {name} has direct environment variables that could override "
                    "the least-privilege group; migrate/remove these keys manually first: "
                    + ", ".join(sorted(direct_keys))
                )
            if service_id not in linked_ids:
                if not args.adopt_existing:
                    raise RecoveryError(
                        f"exact {name} exists but is not linked to this group; rerun with "
                        "--adopt-existing only after verifying the target"
                    )
            plans.append((name, schedule, endpoint, service))
        else:
            plans.append((name, schedule, endpoint, None))

    unrelated_links = linked_ids - expected_existing_ids
    if unrelated_links:
        raise RecoveryError(
            "cron environment group is linked to unrelated service ids: "
            + ", ".join(sorted(unrelated_links))
        )

    for name, schedule, endpoint, service in plans:
        if service is not None:
            service_id = str(service.get("id", ""))
            if service_id not in linked_ids:
                link_group(key, args.env_group_id, service_id)
                linked_ids.add(service_id)
                print(f"linked cron environment group to {name} ({service_id})")
            else:
                print(f"no-op: {name} ({service_id}) already exact and linked")
            continue

        result = api(key, "POST", "/services", desired_payload(name, schedule, endpoint, args.app_url))
        service = unwrap_service(result)
        service_id = str(service.get("id", ""))
        if not service_id:
            raise RecoveryError(f"{name} was created but Render returned no service id")
        link_group(key, args.env_group_id, service_id)
        linked_ids.add(service_id)
        services.append(service)
        print(f"created {name} ({service_id}), auto-deploy OFF, secret group linked")

    print("DONE: trigger each cron once and verify 2xx plus a fresh /api/health stamp")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except RecoveryError as error:
        print(f"ERROR: {error}", file=sys.stderr)
        raise SystemExit(1)
