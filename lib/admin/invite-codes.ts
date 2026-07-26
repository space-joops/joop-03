import { randomInt } from "node:crypto";

// 초대 코드 생성 규칙 — 순수 로직만 두어 테스트·재사용이 쉽도록 분리한다.
//
// 형식은 기존 시드(JOOP-ALPHA-01)와 온보딩 화면 placeholder(JOOP-XXXX-XX)를 따른다.
// 사람이 메일로 받아 타이핑하거나 구두로 전달하는 값이라 가독성이 랜덤성보다 중요하다.
//
// ⚠️ redeemInvite(app/[lang]/onboarding/actions.ts)가 입력을 toUpperCase() 한 뒤 조회하므로
//    저장은 반드시 대문자여야 한다.

export const CODE_PREFIX = "JOOP";
export const MAX_SEQUENCE = 99;
export const MAX_BATCH = 50;

/** 라벨 없이 자동 생성할 때 쓰는 문자셋 — 0/O, 1/I 처럼 헷갈리는 글자는 뺐다. */
const LABEL_ALPHABET = "ACDEFGHJKLMNPQRTUVWXY2345679";

export function isValidLabel(label: string): boolean {
  return /^[A-Z0-9]{2,10}$/.test(label);
}

export function randomLabel(length = 5): string {
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += LABEL_ALPHABET[randomInt(LABEL_ALPHABET.length)];
  }
  return out;
}

/**
 * 같은 라벨의 기존 코드 뒤에 이어붙여 N개를 만든다.
 * 일련번호가 99를 넘으면 null — 호출부가 "새 라벨을 쓰세요"로 안내한다.
 */
export function nextInviteCodes(
  label: string,
  existingCodes: string[],
  count: number,
): string[] | null {
  const prefix = `${CODE_PREFIX}-${label}-`;

  let max = 0;
  for (const code of existingCodes) {
    if (!code.startsWith(prefix)) continue;
    const n = Number(code.slice(prefix.length));
    if (Number.isInteger(n) && n > max) max = n;
  }

  if (max + count > MAX_SEQUENCE) return null;

  return Array.from(
    { length: count },
    (_, i) => `${prefix}${String(max + i + 1).padStart(2, "0")}`,
  );
}
