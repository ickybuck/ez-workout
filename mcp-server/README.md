# ez-workout MCP server

Lets Claude read and log workouts — list templates, see what you last lifted,
start a session, log sets between them, and finish.

It lives in this repo rather than its own because the parts worth getting
right already exist in `src/lib`: kilogram storage against pound plates
(`weight.ts`), superset contiguity (`supersets.ts`), the 1,000-row paging cap
(`paging.ts`), what a weight edit is allowed to touch (`setWeightEdit.ts`),
and rest duration (`restTimer.ts`). A separate repo would reimplement all of
it and drift. Nothing here duplicates a rule the app already has.

It is deliberately **not** folded into the SiYuan or Nextcloud MCP servers.
Tool lists load per session: the SiYuan fork ships 76 tools, and merging the
two would mean every notes conversation paying for workout tools and every
gym conversation paying for notes tools, with no way to enable one without
the other. Separate server, shared deployment pattern.

## What it looks like in use

```
ez_whoami                      →  Eric, eric@…  Weights in lb. 161 workouts logged.
ez_exercise_history leg press  →  2026-11-19  797 lb x 10, 847 lb x 10, 807 lb x 8 (target 10)
ez_log_set leg press, 10 reps  →  Leg Press set 2: 847 lb x 10. Rest 120s.
```

## Tools

| Tool | What it does |
| --- | --- |
| `ez_whoami` | Which account these tools act for, the unit, whether a workout is running |
| `ez_list_templates` | Templates with exercises in order, targets, and superset blocks |
| `ez_exercise_history` | Recent sessions for one exercise, newest first |
| `ez_last_session` | The last finished workout, optionally for one template |
| `ez_performance_summary` | Sessions, sets and volume over a window, with the top exercises |
| `ez_whats_next` | What is logged so far in the running workout |
| `ez_start_workout` | Begins a workout from a template, copying its superset pairing |
| `ez_log_set` | Records a set |
| `ez_edit_set` | Corrects one set |
| `ez_finish_workout` | Stamps the end time |

Everything takes exercise **names**, not ids — the caller is holding a phone
between sets. Matching is exact, then unique prefix, then all-words, and stops
at the first layer with exactly one hit. Several hits is a question, never a
guess: `"curls"` lists the five rather than picking one. There is no
edit-distance matching, on purpose — the library contains both **Hip Abductor**
and **Hip Adductor**, one letter apart and opposite movements.

## The conventions it has to honour

These are not style choices. Each is a rule the app already follows, and
breaking one corrupts history that is never rewritten afterwards.

- **Weights are stored in kilograms, the plates are in pounds.** A weight with
  no unit is in the unit on the account, never a default of kilograms.
- **A dumbbell weight is the pair.** Two 40s is 80, reps as performed on one
  side (EZ-42).
- **`exercise_logs.reps` is the prescription, not the performance.** Performed
  is `reps - failed_reps + extra_reps`. `planSet.ts` owns that translation and
  its tests check agreement with `src/lib/stopReason.ts`.
- **An edit touches one set.** `ez_edit_set` routes through `planWeightEdit`
  with scope `'set'` and throws if that ever widens (EZ-46).
- **Every list is paged** through `fetchAllPages` with a tie-broken order
  (EZ-35, EZ-39), and **no query filters on an embedded resource** (EZ-09).

## How a request is authorised

Two transports, two sources of identity, and no path between them.

**stdio** takes the user from `EZ_USER_ID`. The process was started by someone
who already has the keys, so the environment is as trustworthy as the shell
that set it. This is the transport to develop against: no tunnel, no Access
app, no container.

**HTTP** takes the user from the Cloudflare Access assertion on the request —
signature checked against Cloudflare's JWKS, audience checked against this
app's AUD tag, expiry enforced — and maps the email to a Supabase user. There
is no fallback to `EZ_USER_ID`, and the server refuses to start in HTTP mode
without its Access configuration, because a server that cannot verify an
assertion is a server trusting a header.

Database access uses the **service_role key**, which bypasses every RLS policy.
That is not a shortcut: this project signs with the new-style `sb_secret_`
keys, so there is no legacy HS256 secret to mint a per-user token with and let
RLS do the work. The guardrail therefore lives in `userScope.ts`, which is the
only module that puts a user id into a query:

- owned tables (`workouts`, `workout_templates`, `exercise_defaults`,
  `user_settings`) are filtered on read and stamped on insert;
- `exercises` and the other reference tables are shared and never written;
- `workout_exercises`, `exercise_logs` and `template_exercises` have no
  `user_id` at all, so reaching one requires either a proof handle carrying a
  symbol this module does not export, or a child read confined to parent ids
  by a **required** argument.

Ownership is proven with two plain queries rather than one with a nested
filter, because a filter on an embedded resource fails open.

## Running it locally

```
EZ_SUPABASE_URL=…            # the project URL, same as VITE_SUPABASE_URL
EZ_SUPABASE_SERVICE_ROLE_KEY=…
EZ_USER_ID=…                 # auth.users.id
EZ_USER_EMAIL=…              # optional, for nicer output
```

```
npm run build:mcp
npm run mcp:stdio
```

In Claude Code, add it as a stdio server pointing at `node dist-mcp/stdio.js`
with those variables set.

## Deploying it

Same shape as the SiYuan and Nextcloud MCP servers already on wtr-max.

1. Merge to `main`. `publish-mcp-container.yml` builds
   `ghcr.io/ickybuck/ez-workout-mcp` (`:main` plus an immutable `sha-` tag),
   **gated on CI** — see the comment in that workflow for why.
2. On the NAS, copy `deploy/ez-workout-mcp/` to
   `/mnt/apps-ssd/appdata/ez-workout-mcp/`, fill in `.env` from
   `env.example`, and `sudo docker compose up -d`.
3. Cloudflare: a tunnel route `ezmcp.thepetersens.ca → http://ez-workout-mcp:3000`
   on tunnel `truenas-home`, a DNS record, and an Access app protected by the
   existing reusable policy **Email Allow MN** (Eric and Marilyn). Team domain
   `late-heart-22ce.cloudflareaccess.com`.
4. Put the new app's AUD tag into `CF_ACCESS_AUD` and restart the container.
5. Add `https://ezmcp.thepetersens.ca/mcp` as a custom connector in Claude.

A redeploy does **not** happen on merge. Pull the new image explicitly:

```
sudo docker compose -f /mnt/apps-ssd/appdata/ez-workout-mcp/compose.yaml pull
sudo docker compose -f /mnt/apps-ssd/appdata/ez-workout-mcp/compose.yaml up -d
```

And after a redeploy, **reconnect the MCP client before investigating the
container** — a client caches `tools/list` at session start, and a stale tool
list looks exactly like a server that did not update. That one cost real time
on the SiYuan server.

## Adding someone

The app is multi-user and the database was built for it. To add a person:
their email joins the Access policy, and they need a row in `auth.users`.
`copy_user_defaults` and `set_user_data_as_default` exist to seed their
exercise defaults. Nothing in this server is per-person except the identity it
resolves per request.
