import "server-only";

// 로그인 무차별 대입 완화.
//
// ⚠️ 한계를 분명히 해둔다: Vercel 서버리스는 인스턴스가 여러 개이고 메모리가 인스턴스별이라
//    이 카운터는 우회 가능한 "약한" 방어다. 실질적 방어는 비밀번호 엔트로피(랜덤 24바이트)다.
//    강한 방어가 필요해지면 joop_03_admin_login_attempts 테이블이나 Vercel WAF 로 옮긴다.

const WINDOW_MS = 10 * 60 * 1000; // 10분
const MAX_FAILURES = 10;
const MAX_TRACKED = 1000;

const failures = new Map<string, number[]>();

function prune(now: number) {
  for (const [key, stamps] of failures) {
    const fresh = stamps.filter((t) => now - t < WINDOW_MS);
    if (fresh.length === 0) failures.delete(key);
    else failures.set(key, fresh);
  }
  // 메모리 상한 — 오래된 순으로 버린다.
  if (failures.size > MAX_TRACKED) {
    const excess = failures.size - MAX_TRACKED;
    let i = 0;
    for (const key of failures.keys()) {
      if (i++ >= excess) break;
      failures.delete(key);
    }
  }
}

export function isLoginLocked(key: string): boolean {
  const now = Date.now();
  prune(now);
  return (failures.get(key) ?? []).length >= MAX_FAILURES;
}

export function recordLoginFailure(key: string): void {
  const now = Date.now();
  prune(now);
  failures.set(key, [...(failures.get(key) ?? []), now]);
}

export function clearLoginFailures(key: string): void {
  failures.delete(key);
}
