// indexer/abi.ts — the AgentCredit events this indexer watches. catchup.ts and daemon.ts both
// read them from here, so a new event only needs adding in one place.
import { parseAbiItem } from "viem";

export const ALL_EVENTS = [
  parseAbiItem("event Supplied(address indexed lender, uint256 amount, uint256 shares)"),
  parseAbiItem("event SupplyWithdrawn(address indexed lender, uint256 amount, uint256 shares)"),
  parseAbiItem(
    "event LineOpened(address indexed sponsor, address indexed agent, uint256 collateral, uint256 baseLimit, uint256 perBorrowCap, uint256 aprBps, uint64 dueAt)",
  ),
  parseAbiItem("event VendorSet(address indexed sponsor, address indexed agent, address indexed vendor, bool allowed)"),
  parseAbiItem(
    "event Borrowed(address indexed sponsor, address indexed agent, address indexed vendor, uint256 amount, bytes32 ref, uint256 debtAfter, uint256 limit)",
  ),
  parseAbiItem(
    "event Repaid(address indexed sponsor, address indexed agent, address indexed payer, uint256 interestPaid, uint256 principalPaid, uint256 debtAfter)",
  ),
  parseAbiItem("event LineRevoked(address indexed sponsor, address indexed agent)"),
  parseAbiItem("event CollateralReturned(address indexed sponsor, address indexed agent, uint256 amount)"),
  parseAbiItem(
    "event Liquidated(address indexed sponsor, address indexed agent, address indexed liquidator, uint256 debt, uint256 seized, uint256 returnedToSponsor, uint256 shortfall)",
  ),
] as const;

/** JSON-safe copy of decoded log args (bigint -> string). */
export function serializeArgs(args: unknown): Record<string, unknown> {
  return JSON.parse(JSON.stringify(args ?? {}, (_k, v) => (typeof v === "bigint" ? v.toString() : v)));
}
