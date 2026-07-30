// i18n 기본 설정 — docs/architecture/adr/0001-i18n.md
// 영어(폴백) + 한국어 + 13개 언어(설정 화면의 언어 목록 확정에 따라 확장). zh는 간체 1개 코드만 지원.
export const locales = [
  "en",
  "ko",
  "fr",
  "it",
  "de",
  "es",
  "zh",
  "ja",
  "ru",
  "pt",
  "id",
  "th",
  "vi",
  "hi",
  "ar",
] as const;
export type Locale = (typeof locales)[number];

// 오른쪽에서 왼쪽으로 쓰는 로케일 — <html dir> 처리용 (app/[lang]/layout.tsx)
export const rtlLocales: readonly Locale[] = ["ar"];
export function isRtlLocale(locale: Locale): boolean {
  return rtlLocales.includes(locale);
}

export const defaultLocale: Locale = "en";

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}
