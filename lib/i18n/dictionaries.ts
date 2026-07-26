import "server-only";
import type { Locale } from "@/lib/i18n/config";

// 서버 전용 사전 로더. 동적 import 라 번역 JSON은 클라 번들에 포함되지 않는다
// (docs/architecture/adr/0001-i18n.md).
const dictionaries = {
  en: () => import("@/lib/i18n/dictionaries/en.json").then((m) => m.default),
  ko: () => import("@/lib/i18n/dictionaries/ko.json").then((m) => m.default),
} as const;

export type Dictionary = Awaited<ReturnType<(typeof dictionaries)["en"]>>;

export async function getDictionary(locale: Locale): Promise<Dictionary> {
  return dictionaries[locale]();
}
