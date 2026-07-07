# gstack skill port — provenance

Three skills in this directory (`office-hours`, `plan-ceo-review`, `design-review`) are
ported/adapted from **[garrytan/gstack](https://github.com/garrytan/gstack)**, pinned at
commit `11de390be1be6849eb9a15f91ff4922dd16c589a` (v1.58.5.0, 2026-06-25), MIT license.

## Why a cherry-pick instead of the full install

Decided 2026-07-07 with the founder: the full gstack install is **global**
(`~/.claude/skills`), edits the global CLAUDE.md to override browser tooling, and (in team
mode) adds an hourly self-updating session hook. This Mac mini also runs Vinyl — the Claude
Code agent operating the live agency at brightears.io — and the standing rule is that
Vinyl's environment never changes as a side effect. So we take only the conversational
methodology skills, project-scoped to `brightears-app`, pinned, with no hooks, no
auto-update, no Bun, no gstack binaries.

## Sources and modifications

| Skill here | Source file at pinned commit | Modifications |
|---|---|---|
| `office-hours` | `openclaw/skills/gstack-openclaw-office-hours/SKILL.md` | Renamed; design docs save to `docs/` (repo convention) instead of `memory/`; Phase 1 points at this repo's canonical docs; removed the closing Y Combinator application pitch ("Garry's Note"); kept the signal reflection. |
| `plan-ceo-review` | `openclaw/skills/gstack-openclaw-ceo-review/SKILL.md` | Renamed; summary saves to `docs/` instead of `memory/`; Step 0B points at this repo's canonical docs. |
| `design-review` | `plan-design-review/SKILL.md.tmpl` + pass structure from `plan-design-review/sections/review-sections.md` | Substantially adapted: stripped gstack designer/mockup binary, gbrain, template variables, JSONL task artifacts; kept the design principles, cognitive patterns, 7 review passes, and 0-10 rating method; wired visual evidence to this project's preview/browser tooling and calibration to `docs/DESIGN.md`. |

## Updating

Do NOT add gstack hooks or auto-update. To refresh: pick a new commit, re-fetch the source
files above, re-read them fully, re-apply the modification list, and update the pinned SHA
here.

## License (applies to the ported material)

```
MIT License

Copyright (c) 2026 Garry Tan

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
