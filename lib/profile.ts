import { createSessionClient } from "@/lib/supabase/session";

export type MyJoop = {
  name: string;
  color: string;
  status: string;
  level: number;
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
    .select("name,color,status,level,total_collected")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!data) return null;
  return {
    name: data.name,
    color: data.color,
    status: data.status,
    level: data.level,
    totalCollected: Number(data.total_collected),
  };
}
