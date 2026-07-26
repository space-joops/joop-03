/**
 * 보급 카트리지에 찍히는 기기명 `JOOP-####` (docs/design/handoff-m2.md §3-5).
 *
 * 분양 시퀀스 번호를 DB 에서 세지 않고 사용자 id 에서 결정론적으로 파생한다.
 * 이유: (1) 같은 사용자는 항상 같은 번호 → 부팅 화면을 다시 봐도 값이 흔들리지 않는다,
 *      (2) 카운트 조회가 필요 없어 연출 화면이 DB 에 의존하지 않는다.
 * 진짜 분양 순번이 필요해지면 profiles 에 시퀀스 컬럼을 두고 이 함수를 대체할 것.
 */
export function deviceNameFor(seed: string): string {
  // FNV-1a 32bit
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  const sequence = (hash % 9999) + 1; // 0001–9999
  return `JOOP-${String(sequence).padStart(4, "0")}`;
}
