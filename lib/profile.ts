import { createSessionClient } from "@/lib/supabase/session";
import { levelFromXp } from "@/lib/minigame";

export type MyJoop = {
  id: string;
  name: string;
  color: string;
  status: string;
  level: number;
  xp: number;
  xpIntoLevel: number; // 현재 레벨 안에서의 진행 xp (0~99)
  totalCollected: number;
};

// 현재 세션의 내 줍스(분양된 것). 미로그인/미분양이면 null.
export async function getMyJoop(): Promise<MyJoop | null> {
  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("joop_03_joops")
    .select("id,name,color,status,xp,total_collected")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!data) return null;

  const xp = Number(data.xp ?? 0);
  return {
    id: data.id,
    name: data.name,
    color: data.color,
    status: data.status,
    level: levelFromXp(xp),
    xp,
    xpIntoLevel: xp % 100,
    totalCollected: Number(data.total_collected),
  };
}
