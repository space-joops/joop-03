"use server";

import { revalidatePath } from "next/cache";
import { requireAdminAction } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getGameConfig } from "@/lib/game-config";
import { CONFIG_SPECS, parseConfigValue } from "@/lib/config-specs";

// ⚠️ 이 파일의 모든 액션은 첫 줄에서 requireAdminAction() 을 호출해야 한다.
//    Server Action 은 페이지 렌더 게이팅을 거치지 않고 POST 로 직접 호출될 수 있다.

export type ConfigState =
  | { ok: true; updated: string[] }
  | { ok: false; error: "auth" | "invalid" | "save"; fields?: Record<string, string> }
  | null;

export async function updateGameConfig(
  _prev: ConfigState,
  formData: FormData,
): Promise<ConfigState> {
  if (!(await requireAdminAction())) return { ok: false, error: "auth" };

  const current = await getGameConfig();
  const fields: Record<string, string> = {};
  const rows: { key: string; value: number; updated_at: string }[] = [];
  const now = new Date().toISOString();

  for (const spec of CONFIG_SPECS) {
    const raw = formData.get(spec.key);
    if (raw === null) continue; // 이 폼(그룹)에 없는 키는 건드리지 않는다.

    const parsed = parseConfigValue(spec, String(raw));
    if (!parsed.ok) {
      fields[spec.key] = parsed.error;
      continue;
    }
    // 값이 그대로면 굳이 쓰지 않는다 → updated_at 이 의미 있게 남는다.
    if (current.has(spec.key) && Number(current.get(spec.key)) === parsed.value) continue;

    rows.push({ key: spec.key, value: parsed.value, updated_at: now });
  }

  // 하나라도 잘못됐으면 아무것도 저장하지 않는다. 부분 저장은 운영자를 혼란스럽게 한다.
  if (Object.keys(fields).length > 0) return { ok: false, error: "invalid", fields };
  if (rows.length === 0) return { ok: true, updated: [] };

  const admin = createAdminClient();
  const { error } = await admin.from("joop_03_game_config").upsert(rows, { onConflict: "key" });
  if (error) return { ok: false, error: "save" };

  revalidatePath("/admin/config");
  revalidatePath("/admin/launch");
  revalidatePath("/api/orbital");
  // 설정을 읽는 게임 화면들 — 미니게임 물리, 발사 카운트다운, 자동 수거 속도.
  revalidatePath("/[lang]/joop/train", "page");
  revalidatePath("/[lang]/joop/launch", "page");
  revalidatePath("/[lang]/joop/map", "page");

  return { ok: true, updated: rows.map((r) => r.key) };
}
