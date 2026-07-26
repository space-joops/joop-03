// i18n 기본 설정 — docs/architecture/adr/0001-i18n.md
// M1은 영어(폴백)+한국어 2개 로케일. 이후 10개까지 확장(지원 목록 확정 후).
export const locales = ["en", "ko"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}
