# ez-workout — notes for Claude Code

## Eric's task list

https://claude.ai/artifact/S6zqCoAw35cRa9VusyGhax — the Master Task List opening on the
`ez-workout` scope. Rules: the "✅ Master Task List — Protocol" page in personal SiYuan.
Read the open rows for this scope at session start; a row whose **Who** is `Claude` is work
any session may do without asking.

## Findings and decisions

Bugs, requests and the reasoning behind past fixes live in the **🐛 ez-workout — Bug & Finding
Report** database, on the `3.9.2 🏋️ ez-workout` page in personal SiYuan — not in this repo and
not in GitHub issues. Findings are numbered `EZ-nn` and commit messages refer to them by number.
The project page's Status line is the short version of where things stand.

## How changes reach production

1. **Schema changes are applied to the live Supabase project first**, through the Supabase MCP
   connection, and the migration file is committed afterwards — so `supabase/migrations/` records
   what the database already did rather than what it is about to do.
2. `npm run types:generate` must follow any schema change, or the new columns surface as type
   errors in whatever touches them.
3. Merging to `main` builds and publishes `ghcr.io/ickybuck/ez-workout` (`:main` plus an immutable
   `sha-` tag). **The publish job depends on CI passing** — before 2026-09-23 they were
   independent and releases shipped from a red build for weeks.
4. The NAS does not update itself. On TrueNAS:
   `midclt call -j app.pull_images ez-workout '{"redeploy": true}'`, then confirm with
   `sudo docker inspect ix-ez-workout-ez-workout-1 --format '{{index .Config.Labels "org.opencontainers.image.revision"}}'`.
   Do not trust `app.outdated_docker_images` or `image_updates_available`; both have reported
   "nothing to update" minutes after a fresh push.

**Order matters when a change spans both.** The app is served as a built bundle, so dropping a
column the running bundle still selects breaks that screen. Ship the code, deploy it, then change
the schema.

## Things that have bitten this codebase

- **A Supabase select returns at most 1,000 rows and says nothing about it.** Use
  `fetchAllPages` in `src/lib/paging.ts` with an explicit `.range()` and a stable order
  (`created_at` then `id`). EZ-35 and EZ-39.
- **A filter on an embedded resource does not error when it fails — it stops filtering.** Fetch
  the ids in their own query instead. EZ-09.
- **Weights are stored in kilograms** while the plates are in pounds. Step in display units,
  round, convert back. `fromKg` is unrounded by design; use `convert` for anything a person sees.
- **Dumbbells:** the logged weight is the *pair* (two 40s is 80) with reps as performed; work
  done one side at a time counts reps across both sides. EZ-42.
- `exercise_logs` is the record of what was lifted and is not rewritten to match a later
  convention — the same call made for EZ-11, the 2026-08-29 snap and EZ-42.

## Quality gates

`npm test`, and `npm run ratchet` — the ratchet fails only when the type or lint count *increases*,
so the inherited backlog can be burned down without the build being red. Run `npm run ratchet:update`
and commit `quality-baseline.json` when a count genuinely improves.
