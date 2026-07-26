import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { levelFromXp } from "@/lib/minigame";

// 관리자 콘솔 전용 조회.
//
// 왜 lib/launch.ts 를 재사용하지 않는가: 그쪽은 status='scheduled' 만 보고 "내 청약"
// 관점이라 운영자에게 필요한 발사됨/취소됨과 전체 청약자가 보이지 않는다.
// 조회는 전부 service_role(createAdminClient) — 청약은 RLS 상 본인 것만 보이기 때문이다.

export type BookingStatus = "pending" | "confirmed" | "rejected";
export type VehicleStatus = "scheduled" | "launched" | "cancelled";

export type AdminVehicle = {
  id: string;
  name: string;
  provider: string;
  site: string;
  launchAt: string;
  capacity: number;
  requiredLevel: number;
  status: VehicleStatus;
  confirmedCount: number;
  pendingCount: number;
  rejectedCount: number;
  overCapacity: boolean;
};

type VehicleRow = {
  id: string;
  name: string;
  provider: string;
  site: string;
  launch_at: string;
  capacity: number;
  required_level: number;
  status: VehicleStatus;
};

type BookingCountRow = { vehicle_id: string; status: BookingStatus };

export async function getVehiclesForAdmin(): Promise<AdminVehicle[]> {
  const admin = createAdminClient();
  const [vehiclesRes, bookingsRes] = await Promise.all([
    admin
      .from("joop_03_launch_vehicles")
      .select("id,name,provider,site,launch_at,capacity,required_level,status")
      .order("launch_at"),
    admin.from("joop_03_launch_bookings").select("vehicle_id,status"),
  ]);
  if (vehiclesRes.error) throw vehiclesRes.error;
  if (bookingsRes.error) throw bookingsRes.error;

  const counts = new Map<string, { confirmed: number; pending: number; rejected: number }>();
  for (const b of (bookingsRes.data ?? []) as BookingCountRow[]) {
    const c = counts.get(b.vehicle_id) ?? { confirmed: 0, pending: 0, rejected: 0 };
    c[b.status] += 1;
    counts.set(b.vehicle_id, c);
  }

  return ((vehiclesRes.data ?? []) as VehicleRow[]).map((v) => {
    const c = counts.get(v.id) ?? { confirmed: 0, pending: 0, rejected: 0 };
    return {
      id: v.id,
      name: v.name,
      provider: v.provider,
      site: v.site,
      launchAt: v.launch_at,
      capacity: v.capacity,
      requiredLevel: v.required_level,
      status: v.status,
      confirmedCount: c.confirmed,
      pendingCount: c.pending,
      rejectedCount: c.rejected,
      overCapacity: c.confirmed > v.capacity,
    };
  });
}

export type RosterEntry = {
  bookingId: number;
  status: BookingStatus;
  createdAt: string;
  joopId: string;
  joopName: string;
  joopColor: string;
  joopStatus: string;
  level: number;
  ownerId: string;
  ownerName: string | null;
  eligible: boolean;
};

type RosterRow = {
  id: number;
  status: BookingStatus;
  created_at: string;
  owner_id: string;
  joop: { id: string; name: string; color: string; xp: number; status: string } | null;
};

export async function getVehicleRoster(
  vehicleId: string,
): Promise<{ vehicle: AdminVehicle; roster: RosterEntry[] } | null> {
  const admin = createAdminClient();

  const { data: vehicleRow, error: vErr } = await admin
    .from("joop_03_launch_vehicles")
    .select("id,name,provider,site,launch_at,capacity,required_level,status")
    .eq("id", vehicleId)
    .maybeSingle();
  if (vErr) throw vErr;
  if (!vehicleRow) return null;

  const { data: bookingRows, error: bErr } = await admin
    .from("joop_03_launch_bookings")
    .select("id,status,created_at,owner_id,joop:joop_03_joops(id,name,color,xp,status)")
    .eq("vehicle_id", vehicleId);
  if (bErr) throw bErr;

  const rows = (bookingRows ?? []) as unknown as RosterRow[];

  // owner_id 는 auth.users FK 라 프로필을 embed 할 수 없다 → 별도 조회 후 JS 조인.
  const ownerIds = [...new Set(rows.map((r) => r.owner_id))];
  const nameByOwner = new Map<string, string | null>();
  if (ownerIds.length > 0) {
    const { data: profiles } = await admin
      .from("joop_03_profiles")
      .select("id,display_name")
      .in("id", ownerIds);
    for (const p of (profiles ?? []) as { id: string; display_name: string | null }[]) {
      nameByOwner.set(p.id, p.display_name);
    }
  }

  const v = vehicleRow as VehicleRow;
  const counts = { confirmed: 0, pending: 0, rejected: 0 };
  for (const r of rows) counts[r.status] += 1;

  const roster: RosterEntry[] = rows
    .filter((r) => r.joop !== null)
    .map((r) => {
      // 레벨은 DB 의 level 캐시가 아니라 xp 에서 계산한다(xp 가 단일 진실).
      const level = levelFromXp(Number(r.joop!.xp ?? 0));
      return {
        bookingId: r.id,
        status: r.status,
        createdAt: r.created_at,
        joopId: r.joop!.id,
        joopName: r.joop!.name,
        joopColor: r.joop!.color,
        joopStatus: r.joop!.status,
        level,
        ownerId: r.owner_id,
        ownerName: nameByOwner.get(r.owner_id) ?? null,
        eligible: level >= v.required_level,
      };
    })
    .sort((a, b) => {
      // 선별 판단에 쓸모 있는 순서: 대기 → 확정 → 거부, 그 안에서 레벨 높은 순, 먼저 신청한 순.
      const rank = { pending: 0, confirmed: 1, rejected: 2 } as const;
      if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
      if (a.level !== b.level) return b.level - a.level;
      return a.createdAt.localeCompare(b.createdAt);
    });

  return {
    vehicle: {
      id: v.id,
      name: v.name,
      provider: v.provider,
      site: v.site,
      launchAt: v.launch_at,
      capacity: v.capacity,
      requiredLevel: v.required_level,
      status: v.status,
      confirmedCount: counts.confirmed,
      pendingCount: counts.pending,
      rejectedCount: counts.rejected,
      overCapacity: counts.confirmed > v.capacity,
    },
    roster,
  };
}

export type InviteStatus = "active" | "used" | "revoked";

export type AdminInvite = {
  code: string;
  status: InviteStatus;
  email: string | null;
  redeemedByName: string | null;
  redeemedAt: string | null;
  createdAt: string;
};

type InviteRow = {
  code: string;
  status: InviteStatus;
  email: string | null;
  redeemed_by: string | null;
  redeemed_at: string | null;
  created_at: string;
};

export async function getInviteCodes(limit = 500): Promise<AdminInvite[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("joop_03_invite_codes")
    .select("code,status,email,redeemed_by,redeemed_at,created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;

  const rows = (data ?? []) as InviteRow[];
  const redeemerIds = [...new Set(rows.map((r) => r.redeemed_by).filter((v): v is string => !!v))];

  const nameById = new Map<string, string | null>();
  if (redeemerIds.length > 0) {
    const { data: profiles } = await admin
      .from("joop_03_profiles")
      .select("id,display_name")
      .in("id", redeemerIds);
    for (const p of (profiles ?? []) as { id: string; display_name: string | null }[]) {
      nameById.set(p.id, p.display_name);
    }
  }

  return rows.map((r) => ({
    code: r.code,
    status: r.status,
    email: r.email,
    redeemedByName: r.redeemed_by ? (nameById.get(r.redeemed_by) ?? null) : null,
    redeemedAt: r.redeemed_at,
    createdAt: r.created_at,
  }));
}

export type WaitlistEntry = {
  id: number;
  email: string;
  createdAt: string;
  /** 이 이메일 앞으로 발급된 코드의 현재 상태. 대기리스트 화면의 핵심 정보. */
  invite: { code: string; status: InviteStatus; redeemedAt: string | null } | null;
};

export async function getWaitlistWithInvites(limit = 200): Promise<WaitlistEntry[]> {
  const admin = createAdminClient();
  const [waitRes, inviteRes] = await Promise.all([
    admin
      .from("joop_03_waitlist")
      .select("id,email,created_at")
      .order("created_at", { ascending: false })
      .limit(limit),
    admin
      .from("joop_03_invite_codes")
      .select("code,status,email,redeemed_at")
      .not("email", "is", null),
  ]);
  if (waitRes.error) throw waitRes.error;
  if (inviteRes.error) throw inviteRes.error;

  const invites = (inviteRes.data ?? []) as {
    code: string;
    status: InviteStatus;
    email: string;
    redeemed_at: string | null;
  }[];

  // 한 이메일에 여러 코드가 있을 수 있다. used > active > revoked 순으로 대표 하나를 고른다.
  const rank: Record<InviteStatus, number> = { used: 0, active: 1, revoked: 2 };
  const byEmail = new Map<string, (typeof invites)[number]>();
  for (const inv of invites) {
    const key = inv.email.toLowerCase();
    const cur = byEmail.get(key);
    if (!cur || rank[inv.status] < rank[cur.status]) byEmail.set(key, inv);
  }

  return ((waitRes.data ?? []) as { id: number; email: string; created_at: string }[]).map((w) => {
    const inv = byEmail.get(w.email.toLowerCase());
    return {
      id: w.id,
      email: w.email,
      createdAt: w.created_at,
      invite: inv
        ? { code: inv.code, status: inv.status, redeemedAt: inv.redeemed_at }
        : null,
    };
  });
}

export type DashboardSummary = {
  joopsInOrbit: number;
  joopsOnGround: number;
  pendingBookings: number;
  scheduledVehicles: number;
  nextLaunch: { id: string; name: string; launchAt: string } | null;
  overCapacityVehicles: number;
  activeInvites: number;
  waitlistTotal: number;
  waitlistWithoutInvite: number;
};

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const admin = createAdminClient();
  const [orbit, ground, pending, vehicles, invites, waitlist] = await Promise.all([
    admin
      .from("joop_03_joops")
      .select("id", { count: "exact", head: true })
      .eq("status", "orbit"),
    admin
      .from("joop_03_joops")
      .select("id", { count: "exact", head: true })
      .eq("status", "ground"),
    admin
      .from("joop_03_launch_bookings")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    getVehiclesForAdmin(),
    admin
      .from("joop_03_invite_codes")
      .select("code", { count: "exact", head: true })
      .eq("status", "active"),
    getWaitlistWithInvites(500),
  ]);

  const scheduled = vehicles.filter((v) => v.status === "scheduled");
  const next = scheduled
    .filter((v) => new Date(v.launchAt).getTime() > Date.now())
    .sort((a, b) => a.launchAt.localeCompare(b.launchAt))[0];

  return {
    joopsInOrbit: orbit.count ?? 0,
    joopsOnGround: ground.count ?? 0,
    pendingBookings: pending.count ?? 0,
    scheduledVehicles: scheduled.length,
    nextLaunch: next ? { id: next.id, name: next.name, launchAt: next.launchAt } : null,
    overCapacityVehicles: scheduled.filter((v) => v.overCapacity).length,
    activeInvites: invites.count ?? 0,
    waitlistTotal: waitlist.length,
    waitlistWithoutInvite: waitlist.filter((w) => !w.invite).length,
  };
}
