import "server-only";
import type { Locale } from "@/lib/i18n/config";

// 서버 전용 사전 로더. 동적 import 라 번역 JSON은 클라 번들에 포함되지 않는다
// (docs/architecture/adr/0001-i18n.md).
const dictionaries = {
  en: () => import("@/lib/i18n/dictionaries/en.json").then((m) => m.default),
  ko: () => import("@/lib/i18n/dictionaries/ko.json").then((m) => m.default),
  fr: () => import("@/lib/i18n/dictionaries/fr.json").then((m) => m.default),
  it: () => import("@/lib/i18n/dictionaries/it.json").then((m) => m.default),
  de: () => import("@/lib/i18n/dictionaries/de.json").then((m) => m.default),
  es: () => import("@/lib/i18n/dictionaries/es.json").then((m) => m.default),
  zh: () => import("@/lib/i18n/dictionaries/zh.json").then((m) => m.default),
  ja: () => import("@/lib/i18n/dictionaries/ja.json").then((m) => m.default),
  ru: () => import("@/lib/i18n/dictionaries/ru.json").then((m) => m.default),
  pt: () => import("@/lib/i18n/dictionaries/pt.json").then((m) => m.default),
  id: () => import("@/lib/i18n/dictionaries/id.json").then((m) => m.default),
  th: () => import("@/lib/i18n/dictionaries/th.json").then((m) => m.default),
  vi: () => import("@/lib/i18n/dictionaries/vi.json").then((m) => m.default),
  hi: () => import("@/lib/i18n/dictionaries/hi.json").then((m) => m.default),
  ar: () => import("@/lib/i18n/dictionaries/ar.json").then((m) => m.default),
} as const;

export type Dictionary = Awaited<ReturnType<(typeof dictionaries)["en"]>>;

export async function getDictionary(locale: Locale): Promise<Dictionary> {
  return dictionaries[locale]();
}
