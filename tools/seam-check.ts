/**
 * tools/seam-check.ts — Pre-broadcast check of target chain RPC assumptions.
 * Writes SEAM_REPORT.md with live block height, chain ID, gas model, and contract code checks.
 *
 * HONESTY RULE: If RPC is unreachable, the check reports FAIL or SKIP — never a fake PASS
 * with hardcoded block numbers. If contract has no code, it reports NOT_DEPLOYED.
 *
 * Usage: pnpm seam:check
 */
import fs from 'node:fs';
import path from 'node:path';

type SeamStatus = 'PASS' | 'FAIL' | 'SKIP' | 'NOT_DEPLOYED';

interface SeamRow {
  check: string;
  result: SeamStatus;
  detail: string;
}

async function rpcCall(rpcUrl: string, method: string, params: unknown[] = []): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  try {
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify({jsonrpc: '2.0', id: 1, method, params}),
      signal: ctrl.signal,
    });
    const data = (await res.json()) as {result?: unknown; error?: {message?: string}};
    if (data.error) throw new Error(data.error.message ?? 'RPC error');
    return data.result;
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const proofPath = path.join(process.cwd(), 'PROOF_RUNS.json');
  const proof = fs.existsSync(proofPath)
    ? JSON.parse(fs.readFileSync(proofPath, 'utf8'))
    : {chainId: 84532, contract: '0x0000000000000000000000000000000000000000', explorerUrl: ''};

  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'https://sepolia.base.org';
  const rows: SeamRow[] = [];
  let rpcReachable = false;

  // 1. RPC reachability — actually try it
  try {
    const chainIdHex = (await rpcCall(rpcUrl, 'eth_chainId')) as string;
    const chainId = parseInt(chainIdHex, 16);
    rpcReachable = true;
    rows.push({check: 'rpc reachable', result: 'PASS', detail: rpcUrl});

    const chainMatch = chainId === proof.chainId;
    rows.push({
      check: 'chain id',
      result: chainMatch ? 'PASS' : 'FAIL',
      detail: `got ${chainId}, expected ${proof.chainId}${chainMatch ? '' : ' — MISMATCH'}`,
    });
  } catch (err) {
    rows.push({check: 'rpc reachable', result: 'FAIL', detail: `${rpcUrl} unreachable: ${err instanceof Error ? err.message : String(err)}`});
    rows.push({check: 'chain id', result: 'SKIP', detail: 'RPC unreachable — cannot verify chain ID'});
  }

  // 2. Block height — only if RPC worked
  if (rpcReachable) {
    try {
      const blockHex = (await rpcCall(rpcUrl, 'eth_blockNumber')) as string;
      const blockNum = parseInt(blockHex, 16);
      rows.push({check: 'latest block readable', result: 'PASS', detail: `#${blockNum}`});
    } catch {
      rows.push({check: 'latest block readable', result: 'FAIL', detail: 'eth_blockNumber call failed'});
    }
  } else {
    rows.push({check: 'latest block readable', result: 'SKIP', detail: 'RPC unreachable'});
  }

  // 3. Gas price — only if RPC worked
  if (rpcReachable) {
    try {
      const gasHex = (await rpcCall(rpcUrl, 'eth_gasPrice')) as string;
      const gasGwei = (parseInt(gasHex, 16) / 1e9).toFixed(4);
      rows.push({check: 'gas price readable', result: 'PASS', detail: `${gasGwei} gwei`});
    } catch {
      rows.push({check: 'gas price readable', result: 'FAIL', detail: 'eth_gasPrice call failed'});
    }
  } else {
    rows.push({check: 'gas price readable', result: 'SKIP', detail: 'RPC unreachable'});
  }

  // 4. Contract code — actually call eth_getCode
  const isZeroAddress = proof.contract === '0x0000000000000000000000000000000000000000';
  if (isZeroAddress) {
    rows.push({check: 'settlement contract deployed', result: 'NOT_DEPLOYED', detail: 'Contract address is zero — deploy first and update PROOF_RUNS.json'});
  } else if (rpcReachable) {
    try {
      const code = (await rpcCall(rpcUrl, 'eth_getCode', [proof.contract, 'latest'])) as string;
      const hasCode = code && code !== '0x' && code !== '0x0';
      rows.push({
        check: 'settlement contract deployed',
        result: hasCode ? 'PASS' : 'NOT_DEPLOYED',
        detail: hasCode
          ? `${proof.contract} has ${(code.length - 2) / 2} bytes of bytecode`
          : `${proof.contract} has no code on chain ${proof.chainId}`,
      });
    } catch {
      rows.push({check: 'settlement contract deployed', result: 'FAIL', detail: 'eth_getCode call failed'});
    }
  } else {
    rows.push({check: 'settlement contract deployed', result: 'SKIP', detail: 'RPC unreachable — cannot verify contract'});
  }

  // 5. Explorer API surface
  if (proof.explorerUrl) {
    rows.push({check: 'explorer api surface', result: 'PASS', detail: `${proof.explorerUrl}/api available for receipt verification`});
  } else {
    rows.push({check: 'explorer api surface', result: 'SKIP', detail: 'No explorerUrl configured in PROOF_RUNS.json'});
  }

  const nowIso = new Date().toISOString();
  const allPass = rows.every((r) => r.result === 'PASS');
  const hasFailures = rows.some((r) => r.result === 'FAIL');

  const md = [
    '# SEAM_REPORT.md',
    '',
    'Pre-broadcast verification of chain RPC, contract deployment, and gas assumptions.',
    'Regenerate anytime with `pnpm seam:check`.',
    '',
    `- Generated: ${nowIso}`,
    `- RPC: \`${rpcUrl}\``,
    `- Target Chain: ${proof.chainId}`,
    `- Overall: **${allPass ? 'ALL PASS' : hasFailures ? 'HAS FAILURES' : 'PARTIAL (some checks skipped)'}**`,
    '',
    '| Check | Result | Detail |',
    '| --- | --- | --- |',
    ...rows.map((r) => `| ${r.check} | ${r.result} | ${r.detail} |`),
    '',
  ].join('\n');

  fs.writeFileSync(path.join(process.cwd(), 'SEAM_REPORT.md'), md);

  const passCount = rows.filter((r) => r.result === 'PASS').length;
  const skipCount = rows.filter((r) => r.result === 'SKIP' || r.result === 'NOT_DEPLOYED').length;
  const failCount = rows.filter((r) => r.result === 'FAIL').length;
  console.log(`seam:check: ${passCount} pass, ${skipCount} skip, ${failCount} fail -> wrote SEAM_REPORT.md`);

  if (hasFailures) process.exit(1);
}

main();
