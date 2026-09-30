// lib/demo-mode.ts — DEMO_MODE=1 replaces every external dependency (database, RPC node,
// real wallet) with on-disk fixtures and a mock wallet connector, so the demo path completes
// with the Wi-Fi off.
//
// Reads the flag directly rather than through the validated config, so a page that only
// needs to know "am I in demo mode?" never triggers environment validation — which runs
// during `next build` and used to make an unconfigured scaffold unbuildable.
import { demoModeEnabled } from "./env";

export function isDemoMode(): boolean {
  return demoModeEnabled();
}
