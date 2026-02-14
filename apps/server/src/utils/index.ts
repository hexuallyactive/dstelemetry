export function uptimeSecondsFromNsBigInt(createdAtNs: bigint): number {
    const nowNs = BigInt(Date.now()) * 1_000_000n;
    const uptimeNs = nowNs - createdAtNs;
    return Number(uptimeNs / 1_000_000_000n);
  }
