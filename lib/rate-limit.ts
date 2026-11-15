const WINDOW_MS = 15 * 60 * 1000;

// Pencatat lokal per instance: di serverless tiap instance punya hitungan sendiri,
// jadi ini rem cepat untuk tebak-password, bukan pengganti WAF.
const attempts = new Map<string, { count: number; resetAt: number }>();

export function isRateLimited(key: string, maxPerWindow = 10): boolean {
  const now = Date.now();
  if (attempts.size > 5000) {
    for (const [k, v] of attempts) if (v.resetAt <= now) attempts.delete(k);
  }
  const rec = attempts.get(key);
  if (!rec || rec.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  rec.count += 1;
  return rec.count > maxPerWindow;
}

export function clearRateLimit(key: string): void {
  attempts.delete(key);
}
