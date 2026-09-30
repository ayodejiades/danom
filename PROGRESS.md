# PROGRESS — monad-metropolis

Written by kit-autopilot after every step; last updated 2026-09-30T08:12:17.491Z. Do not edit by hand:
it is rewritten on the next run. Regenerate it any time with `kit-autopilot --progress --dir /Users/mac/Hackathons/monad-metropolis`.

- **Idea:** Credit layer for x402 agents on Monad: a lender vault is the payer of x402 batch settlement channels, so an AI agent holds only a voucher signing key and never unconstrained USDC. The agent gets a policy bound credit line (per channel cap,…
- **Track:** web3 · **Readiness:** scaffolded
- **Deadline:** 2026-10-13 (UTC)
- **Status:** 6 of 12 steps green, 3 need work, 1 not run yet

## Rules for any agent helping here

0. Read `AGENTS.md` in this folder before changing any code.
1. Work on the **first item under "Do next"** only. Finish it, then stop and re-run the command it names.
2. Never delete, regenerate or reformat files a "Done" step owns. Edit them only as far as your item needs.
3. Change the app through `docs/demo-path.json` and the code it points at. Do not stub, hardcode or fake a result to make a check pass.
4. Commit after each change that works (`git add -A && git commit -m "<what changed>"`). Never commit `.env`.
5. Never edit `.kit/`, `PROGRESS.md`, or anything under `~/.kitbuilder/`; the pipeline owns them.
6. If an item needs more than it describes, stop and say what is unclear instead of guessing.

## Do next

1. **story** — FAILED. demo-new could not link the project: demo-new: /Users/mac/Hackathons/monad-metropolis-demo already exists and is not empty cause: demo-new refuses to overwrite an existing project fix: choose a different name, or remove /Users/mac/Hackatho… Log: `/Users/mac/.kitbuilder/logs/monad-metropolis/story.log`.
   Fix, then run `kit-repair story --dir /Users/mac/Hackathons/monad-metropolis`, then `kit-autopilot --step story --dir /Users/mac/Hackathons/monad-metropolis`.
2. **video** — FAILED (required). demo-build failed: demo-build: not enough free memory to render cause: 2.21 GB free, this render needs 3 GB fix: quit Chrome and Simulator, then run demo-build again run with --verbose for the full trace Log: `/Users/mac/.kitbuilder/logs/monad-metropolis/video.log`.
   Fix, then run `kit-repair video --dir /Users/mac/Hackathons/monad-metropolis`, then `kit-autopilot --step video --dir /Users/mac/Hackathons/monad-metropolis`.
3. **preflight check 3: demo-path.json / DEMO_PATH.md exist** — found: missing. Fix in: demo-path. Then run `kit-autopilot --step preflight --dir /Users/mac/Hackathons/monad-metropolis`.
4. **preflight check 4: demo video in [60, 180]s** — found: 57.333333s. Fix in: video. Then run `kit-autopilot --step preflight --dir /Users/mac/Hackathons/monad-metropolis`.
5. **preflight check 12: docs/EVIDENCE.md and docs/HARD_THING.md generated** — found: missing evidence matrix or technical moat doc. Fix in: implement. Then run `kit-autopilot --step preflight --dir /Users/mac/Hackathons/monad-metropolis`.
6. **preflight check 14: live testnet contract & transaction verified** — found: no live testnet contract or transaction found in .kit/deployment.json or README.md. Fix in: deploy (run ./scripts/deploy_testnet.sh or populate .kit/deployment.json). Then run `kit-autopilot --step preflight --dir /Users/mac/Hackathons/monad-metropolis`.
7. **package** — not run yet. Run `kit-autopilot --resume --dir /Users/mac/Hackathons/monad-metropolis` (it starts at the first step that is not green).

## Done — do not redo

- **intake** — brief written to /Users/mac/.kitbuilder/staging/monad-metropolis/brief.json; search Q='Credit layer for x402 agents on Monad: a lender vault is the payer of x4…. Owns: brief.json, docs/BOUNTIES.md, docs/HOURS.md, .kit/limits.json.
- **scaffold** — /Users/mac/Hackathons/monad-metropolis already scaffolded with 3-stage flow — idempotent no-op. Owns: the app itself, README.md, AGENTS.md, docs/demo-path.json.
- **designAudit** — 3 skills, 0 blocking, 1 advisory -> .kit/design-audit.json. Owns: .kit/design-audit.json.
- **campaign** — executed solver against 6 runs; computed canonical EIP-712 digests; adversarial negative invariant verified (rejected probe with BLOCK). Owns: evidence/campaign-report.json.
- **verify** — live: skipped (not deployed); DEMO_MODE: OK; system verification: 12/12 invariant & adversarial checks PASSED. Owns: CLAIM_LEDGER.md, WHAT_IS_REAL.md.
- **record** — recorded /Users/mac/Hackathons/monad-metropolis/docs/fallback.mp4. Owns: docs/fallback.mp4, docs/actions.json.

## Skipped on purpose

- **implement** — skipped by --skip. Run `kit-autopilot --step implement --dir /Users/mac/Hackathons/monad-metropolis` if you want it.
- **deploy** — skipped by --skip. Run `kit-autopilot --step deploy --dir /Users/mac/Hackathons/monad-metropolis` if you want it.
