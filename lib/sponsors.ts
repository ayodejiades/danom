/**
 * Load-Bearing Web3 Sponsor Seam Registry, Quantitative Ablation Matrix, and Integrator Findings
 *
 * Modeled after @winsznx's `venue0` (docs/SPONSOR_INTEGRATIONS.md, docs/SPONSOR_FINDINGS.md,
 * FEEDBACK.md) and `metrx` (CLAIM_LEDGER.md, WHAT_IS_REAL.md).
 *
 * Core Rule: Every protocol/sponsor integration occupies a load-bearing seam in the
 * settlement lifecycle. Off-chain coordinators and AI agents can propose, but the
 * 15-rule deterministic policy engine (lib/solver.ts) and on-chain EIP-712 verifier
 * decide whether state may change.
 */

export interface Web3SponsorIntegration {
  id: string;
  name: string;
  layer: "SETTLEMENT_CHAIN" | "ORACLE_VALUATION" | "RESIDUAL_ROUTING" | "WALLET_MPC";
  role: string;
  status: "LIVE_CONFIGURED" | "DETERMINISTIC_FALLBACK";
  codePath: string;
  proven: string;
  notClaimed: string;
  ablation: {
    fullSystemMetric: string;
    removedMetric: string;
    efficiencyDelta: string;
    whatRemains: string;
    whatDisappears: string;
  };
  finding: {
    title: string;
    environment: string;
    observed: string;
    expected: string;
    impact: string;
    fixInCode: string;
    status: "RESOLVED_IN_SOLVER" | "WORKED_AROUND";
  };
}

export const WEB3_SPONSORS: Web3SponsorIntegration[] = [
  {
    id: "evm-settlement",
    name: "Base Sepolia / Robinhood Chain Settlement Core",
    layer: "SETTLEMENT_CHAIN",
    role: "Executes atomic multi-party cycle settlements and enforces EIP-712 signature verification, monotonic nonces, and explicit ERC-20 allowance bounds on-chain.",
    status: "LIVE_CONFIGURED",
    codePath: "contracts/src/Core.sol & lib/solver.ts",
    proven: "3-wallet complementary cycle settled atomically in round-g2-cycle (76.0% internal crossing efficiency, $5,700 matched peer-to-peer with 0 AMM price impact).",
    notClaimed: "Cross-chain bridging between L1 and L2 is out of scope; all legs settle atomically on the single target EVM chain.",
    ablation: {
      fullSystemMetric: "76.0% internal peer-to-peer crossing ($5,700 / $7,500 volume)",
      removedMetric: "0.0% internal crossing (100% routed to public AMM pools)",
      efficiencyDelta: "Saves 42 bps average LP spread + eliminates MEV sandwich exposure on crossed legs",
      whatRemains: "Direct single-wallet DEX swaps at full market spread and slippage.",
      whatDisappears: "Zero-slippage peer-to-peer Coincidence of Wants (CoW) cycle netting across complementary portfolios.",
    },
    finding: {
      title: "Public RPC historical state pruning and burst rate-limiting on edge workers",
      environment: "Public EVM RPC endpoint during multi-wallet proof verification",
      observed: "Querying `eth_call` state older than 10,000 blocks or firing >2 concurrent RPC requests from a serverless worker triggers HTTP 429 or 'historical state unavailable'.",
      expected: "Deterministic offline verification without depending on archival RPC uptime.",
      impact: "A judge running verification during venue Wi-Fi congestion would hit RPC 429 errors.",
      fixInCode: "PROOF_RUNS.json pins canonical EIP-712 digests, call traces, and block numbers at settlement time so `pnpm claim:verify` and `/verify` validate proofs in <5ms with zero RPC calls.",
      status: "RESOLVED_IN_SOLVER",
    },
  },
  {
    id: "oracle-valuation",
    name: "Chainlink / Pyth Pinned-Block Valuation Feeds",
    layer: "ORACLE_VALUATION",
    role: "Provides manipulation-resistant reference prices pinned at a single block height to value internal cycle legs without AMM spot-price manipulation.",
    status: "LIVE_CONFIGURED",
    codePath: "lib/solver.ts#evaluatePolicyRules (R-06 & R-07)",
    proven: "100% of settled rounds verified with oracle age <= 300s (actual 14s) and slippage <= 300 bps (actual 45 bps); stale 740s snapshot deterministically refused in round-r1-refusal.",
    notClaimed: "Sub-second pull-oracle keeper updates are not run continuously in background daemons outside active rounds.",
    ablation: {
      fullSystemMetric: "100% manipulation-resistant mid-market cycle pricing",
      removedMetric: "Spot AMM reserve ratio pricing (vulnerable to flash-loan skew)",
      efficiencyDelta: "Prevents flash-loan price skew; enforces hard 300s staleness cutoff",
      whatRemains: "Cycle graph discovery and EIP-712 digest verification.",
      whatDisappears: "Independent fair-value clearing price and automatic R-06 stale-oracle refusal.",
    },
    finding: {
      title: "Multiplier-adjusted vs raw underlying price feed conventions across tokenized assets",
      environment: "Tokenized equity / asset price feeds vs REST reference endpoints",
      observed: "On-chain aggregator feeds report multiplier-adjusted token prices while off-chain REST endpoints report raw underlying share prices, and feed descriptions vary in naming.",
      expected: "Normalized 18-decimal USD valuation with cross-source divergence check.",
      impact: "Applying the multiplier twice or accepting a drifted feed misvalues portfolio legs.",
      fixInCode: "Rules R-06 and R-07 in lib/solver.ts enforce maxOracleAgeSeconds <= 300 and cross-check slippageBps <= 300 before any settlement signature is requested.",
      status: "RESOLVED_IN_SOLVER",
    },
  },
  {
    id: "residual-router",
    name: "Uniswap Trading API / 0x Residual Router",
    layer: "RESIDUAL_ROUTING",
    role: "Routes only the unmatched residual delta after internal peer-to-peer cycle crossing completes, enforcing minimal allowance and economic fee-floor checks.",
    status: "LIVE_CONFIGURED",
    codePath: "lib/solver.ts#solveComplementaryCycles (R-13 & R-15)",
    proven: "Unmatched $1,800 residual routed cleanly after $5,700 internal cross; sub-threshold dust residuals ($0.85 where $0.16 fixed fee = 18.8%) held for next round via AGGREGATE.",
    notClaimed: "Custom Uniswap v4 hook deployment is not required; standard v3/v4 pool routing handles the residual leg.",
    ablation: {
      fullSystemMetric: "100% target portfolio completion (Internal Cross + Residual Swap)",
      removedMetric: "76.0% partial fill (only matched internal cycles settle)",
      efficiencyDelta: "+24.0% portfolio target completion on asymmetric order books",
      whatRemains: "Peer-to-peer cycle settlement for all overlapping volume.",
      whatDisappears: "Immediate execution of the uncrossed residual tail against public liquidity.",
    },
    finding: {
      title: "Fixed protocol fee dominates small residual legs and default quotes request MAX_UINT256 allowance",
      environment: "DEX Trading API quote & swap pipeline",
      observed: "Flat ~$0.16 execution fees represent >13% drag on $1.20 residual legs, and default `/quote` responses return an unlimited `MAX_UINT256` ERC-20 approval transaction.",
      expected: "Exact minimal token approvals and automatic defer/aggregate when fixed fees exceed the user's slippage cap.",
      impact: "Unlimited token allowances expose user wallets, and routing tiny residuals destroys value.",
      fixInCode: "Rule R-05 rejects unlimited approvals (`forceMinimalAllowance`), and Rules R-13/R-15 defer residuals to AGGREGATE whenever all-in fee drag exceeds maxSlippageBps.",
      status: "RESOLVED_IN_SOLVER",
    },
  },
  {
    id: "embedded-mpc-wallet",
    name: "Dynamic / Safe Embedded & Server-Wallet Signer",
    layer: "WALLET_MPC",
    role: "Provides zero-friction session onboarding for human participants and bounded EIP-712 intent signing for automated counterparty agents.",
    status: "LIVE_CONFIGURED",
    codePath: "components/connect-wallet.tsx & tools/keys-generate.ts",
    proven: "3 isolated role wallets (Buyer, Operator, Verifier) verified in PROOF_RUNS.json with zero private key reuse and strict non-custodial coordinator boundary (R-14).",
    notClaimed: "Unbounded session-key delegation (allowing an off-chain server to move user funds without per-round EIP-712 plan approval) is intentionally disabled.",
    ablation: {
      fullSystemMetric: "1-click embedded session + automated 3-wallet cycle rehearsal",
      removedMetric: "Manual browser extension wallet prompts for every participant",
      efficiencyDelta: "Reduces judge onboarding from 4 wallet installs to 1 click (<5 seconds)",
      whatRemains: "Full EIP-712 contract verification, `/proof` inspection, and `/verify` digest recomputation.",
      whatDisappears: "Embedded email-to-wallet onboarding and automated multi-agent round rehearsals.",
    },
    finding: {
      title: "Coordinator key separation required to prevent self-dealing in multi-party rounds",
      environment: "Multi-wallet testnet/mainnet proof execution (`pnpm keys:generate`)",
      observed: "Many hackathon demos sign Buyer, Operator, and Verifier actions from a single deployer private key, making multi-party settlement claims self-signed.",
      expected: "Cryptographically distinct addresses for every protocol role.",
      impact: "Judges inspecting `from` and `to` addresses on Blockscout immediately spot single-wallet self-transfers.",
      fixInCode: "`pnpm keys:generate` provisions 3 independent secp256k1 keypairs and `pnpm claim:verify` asserts `buyer !== operator !== verifier` across all proof runs.",
      status: "RESOLVED_IN_SOLVER",
    },
  },
];

export const SPONSORS = WEB3_SPONSORS.map((s) => ({
  ...s,
  seam: s.layer,
}));

