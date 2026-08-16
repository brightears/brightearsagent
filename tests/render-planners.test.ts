import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const runPython = (args: string[]) => {
  const env = { ...process.env };
  delete env.RENDER_API_KEY;
  return spawnSync("python3", args, {
    cwd: process.cwd(),
    env,
    encoding: "utf8",
  });
};

describe("Render recovery planners", () => {
  it("stay offline and read-only by default", () => {
    const web = runPython([
      "scripts/render-deploy.py",
      "--env-group-id",
      "evg-dry-run",
    ]);
    const crons = runPython([
      "scripts/render-crons.py",
      "--env-group-id",
      "evg-dry-run",
    ]);

    expect(web.status).toBe(0);
    expect(web.stdout).toContain("DRY RUN — no network calls and no Render changes");
    expect(web.stdout).toContain("auto-deploy: OFF");
    expect(crons.status).toBe(0);
    expect(crons.stdout).toContain("request timeout: 330s");
    expect(crons.stdout.match(/cron: brightears-app-/g)).toHaveLength(4);
  });

  it("refuses apply mode before any API call when no key is present", () => {
    for (const script of ["scripts/render-deploy.py", "scripts/render-crons.py"]) {
      const result = runPython([
        script,
        "--env-group-id",
        "evg-dry-run",
        "--apply",
      ]);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("RENDER_API_KEY is required only with --apply");
    }
  });

  it("never emits raw cron response strings or tenant details", () => {
    const code = [
      "import os,runpy,subprocess",
      "m=runpy.run_path('scripts/render-crons.py')",
      "url='data:application/json,%7B%22tenants%22%3A2%2C%22errors%22%3A1%2C%22results%22%3A%5B%7B%22slug%22%3A%22artist-secret%22%2C%22email%22%3A%22private%40example.com%22%7D%5D%2C%22error%22%3A%22provider-secret%22%7D'",
      "command=m['command'](url,'')",
      "assert '.text()' not in command and 'console.log(r.status' not in command",
      "env=dict(os.environ,CRON_SECRET='fake-secret')",
      "result=subprocess.run(command,shell=True,capture_output=True,text=True,env=env)",
      "print(result.stdout.strip())",
      "raise SystemExit(result.returncode)",
    ].join(";");
    const result = runPython(["-c", code]);

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(
      '{"status":200,"counts":{"tenants":2,"errors":1}}',
    );
    expect(result.stdout).not.toContain("artist-secret");
    expect(result.stdout).not.toContain("private@example.com");
    expect(result.stdout).not.toContain("provider-secret");
  });
});
