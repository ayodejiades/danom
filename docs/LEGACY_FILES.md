# Legacy files to delete

These came from the starter template or from earlier designs of this project. They are not used by the app. An automatic bulk delete was blocked by a safety check, so they are left in place, and `tsconfig.json` excludes the ones that would break the build. Delete them by hand:

```bash
cd /Users/mac/Hackathons/monad-metropolis
rm -rf agent sdk SEAM_REPORT.md lib/solver.ts lib/solver.ts.bak lib/sponsors.ts lib/escrow.ts lib/rpc.ts lib/network-resilience.ts components/console-tour.tsx components/ablation-benchmark.tsx components/dashboard-shell.tsx components/security-lab.tsx tools/keys-generate.ts tools/verify.ts tools/seam-check.ts docs/PAYOUT.md docs/HOURS.md docs/demo-path.json.bak contracts/src/AgentCredit.sol contracts/src/AgentSpend.sol contracts/src/AusdStream.sol contracts/src/ChannelFunder.sol contracts/test/AgentCredit.t.sol contracts/test/AgentSpend.t.sol contracts/test/AusdStream.t.sol contracts/test/ChannelFunder.fork.t.sol
fixtures/events.json.bak story/narration.json.bak app/globals.css.bak docs/demo-path.json.bak lib/solver.ts.bak components/ui/button.tsx.bak components/ui/illustration.tsx.bak components/ui/input.tsx.bak components/ui/empty-state.tsx.bak components/ui/table.tsx.bak components/ui/select.tsx.bak components/ui/badge.tsx.bak components/ui/toast.tsx.bak components/ui/nav.tsx.bak components/ui/stat.tsx.bak components/ui/sidebar.tsx.bak components/ui/skeleton.tsx.bak components/ui/card.tsx.bak app/dashboard/page.tsx.bak 
```

Also: the route files under app/dashboard, app/lab, app/login, app/onboarding, app/verify and app/(marketing) are one line redirects and can be removed with their folders.

After deleting, remove the matching entries from the `exclude` list in tsconfig.json.

Note: ChannelFunder is the small prototype that validated the design against the real x402 contract. Its fork tests are superseded by CreditVault.t.sol, which runs the same checks and more.
