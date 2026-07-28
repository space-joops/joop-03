import { createSessionClient } from "@/lib/supabase/session";
import { createAdminClient } from "@/lib/supabase/admin";

export type LaunchVehicle = {
  id: string;
  name: string;
  provider: string;
  site: string;
  launchAt: string; // ISO
  capacity: number;
  requiredLevel: number;
  confirmedCount: number; // 확정된 청약 수(전체)
  myStatus: "pending" | "confirmed" | "rejected" | null; // 내 청약 상태
};

type VehicleRow = {
  id: string;
  name: string;
  provider: string;
  site: string;
  launch_at: string;
  capacity: number;
  required_level: number;
};

type BookingRow = { vehicle_id: string; status: string; owner_id: string };

/** 발사 시퀀스 미션 행에 쓰는 최소 정보. */
export type MyVehicle = { name: string; provider: string; site: string };

// 내 확정 청약의 발사체 — 발사 시퀀스가 "내가 선택한 발사체"를 표시할 때 쓴다.
// limit(1): 서로 다른 발사체에 중복 확정된 비정상 데이터(#29)가 있어도 죽지 않게.
export async function getMyConfirmedVehicle(): Promise<MyVehicle | null> {
  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data: bookings } = await admin
    .from("joop_03_launch_bookings")
    .select("vehicle_id")
    .eq("owner_id", user.id)
    .eq("status", "confirmed")
    .limit(1);
  const vehicleId = bookings?.[0]?.vehicle_id;
  if (!vehicleId) return null;

  const { data: v } = await admin
    .from("joop_03_launch_vehicles")
    .select("name,provider,site")
    .eq("id", vehicleId)
    .maybeSingle();
  return (v as MyVehicle | null) ?? null;
}

// 발사체 목록 + 각 발사체의 확정 청약 수(전체) + 내 청약 상태.
// 서버 컴포넌트 전용(admin = service_role 집계).
export async function getLaunchVehicles(): Promise<LaunchVehicle[]> {
  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const admin = createAdminClient();
  const [vehiclesRes, bookingsRes] = await Promise.all([
    admin
      .from("joop_03_launch_vehicles")
      .select("id,name,provider,site,launch_at,capacity,required_level")
      .eq("status", "scheduled")
      .order("launch_at"),
    admin.from("joop_03_launch_bookings").select("vehicle_id,status,owner_id"),
  ]);

  const vehicles = (vehiclesRes.data ?? []) as VehicleRow[];
  const bookings = (bookingsRes.data ?? []) as BookingRow[];

  const confirmedByVehicle = new Map<string, number>();
  const myStatusByVehicle = new Map<string, string>();
  for (const b of bookings) {
    if (b.status === "confirmed") {
      confirmedByVehicle.set(b.vehicle_id, (confirmedByVehicle.get(b.vehicle_id) ?? 0) + 1);
    }
    if (user && b.owner_id === user.id) {
      myStatusByVehicle.set(b.vehicle_id, b.status);
    }
  }

  return vehicles.map((v) => ({
    id: v.id,
    name: v.name,
    provider: v.provider,
    site: v.site,
    launchAt: v.launch_at,
    capacity: v.capacity,
    requiredLevel: v.required_level,
    confirmedCount: confirmedByVehicle.get(v.id) ?? 0,
    myStatus: (myStatusByVehicle.get(v.id) as LaunchVehicle["myStatus"]) ?? null,
  }));
}
