"use server";

import { revalidatePath } from "next/cache";
import { requireAdminAction } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { VehicleStatus } from "@/lib/admin/queries";

// ⚠️ 이 파일의 모든 액션은 첫 줄에서 requireAdminAction() 을 호출해야 한다.
//    Server Action 은 페이지 렌더 게이팅을 거치지 않고 POST 로 직접 호출될 수 있다.

export type VehicleError = {
  ok: false;
  error:
    | "auth"
    | "name"
    | "provider"
    | "site"
    | "launch_at"
    | "capacity"
    | "required_level"
    | "capacity_below_confirmed"
    | "not_found"
    | "not_scheduled"
    | "save";
  confirmedCount?: number;
};

export type VehicleState = { ok: true; id: string } | VehicleError | null;

type Parsed = {
  name: string;
  provider: string;
  site: string;
  launch_at: string;
  capacity: number;
  required_level: number;
};

function parseVehicleForm(formData: FormData): Parsed | VehicleError {
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 1 || name.length > 40) return { ok: false, error: "name" };

  const provider = String(formData.get("provider") ?? "").trim();
  if (provider.length < 1 || provider.length > 40) return { ok: false, error: "provider" };

  const site = String(formData.get("site") ?? "").trim();
  if (site.length < 1 || site.length > 80) return { ok: false, error: "site" };

  // 과거 시각도 허용한다 — 이미 지난 발사를 사후 등록할 수 있어야 한다.
  const launchAt = new Date(String(formData.get("launch_at") ?? ""));
  if (Number.isNaN(launchAt.getTime())) return { ok: false, error: "launch_at" };

  const capacity = Number(formData.get("capacity"));
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 1000) {
    return { ok: false, error: "capacity" };
  }

  const requiredLevel = Number(formData.get("required_level"));
  if (!Number.isInteger(requiredLevel) || requiredLevel < 1 || requiredLevel > 100) {
    return { ok: false, error: "required_level" };
  }

  return {
    name,
    provider,
    site,
    launch_at: launchAt.toISOString(),
    capacity,
    required_level: requiredLevel,
  };
}

function revalidateLaunch(vehicleId?: string) {
  revalidatePath("/admin/launch");
  if (vehicleId) revalidatePath(`/admin/launch/${vehicleId}`);
  revalidatePath("/admin");
  revalidatePath("/[lang]/launch", "page");
}

export async function createVehicle(
  _prev: VehicleState,
  formData: FormData,
): Promise<VehicleState> {
  if (!(await requireAdminAction())) return { ok: false, error: "auth" };

  const parsed = parseVehicleForm(formData);
  if ("ok" in parsed) return parsed;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("joop_03_launch_vehicles")
    .insert({ ...parsed, status: "scheduled" })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: "save" };

  revalidateLaunch(data.id);
  return { ok: true, id: data.id };
}

export async function updateVehicle(
  _prev: VehicleState,
  formData: FormData,
): Promise<VehicleState> {
  if (!(await requireAdminAction())) return { ok: false, error: "auth" };

  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, error: "not_found" };

  const parsed = parseVehicleForm(formData);
  if ("ok" in parsed) return parsed;

  const admin = createAdminClient();
  const { data: vehicle } = await admin
    .from("joop_03_launch_vehicles")
    .select("id,status")
    .eq("id", id)
    .maybeSingle();
  if (!vehicle) return { ok: false, error: "not_found" };
  if (vehicle.status !== "scheduled") return { ok: false, error: "not_scheduled" };

  // 정원을 이미 확정된 인원보다 낮추면 기존 탑승자가 조용히 초과 상태가 된다.
  // 누구를 내릴지는 정책 판단이므로 코드가 임의로 강등하지 않고, 강제 저장을 명시적으로 받는다.
  const { count: confirmedCount } = await admin
    .from("joop_03_launch_bookings")
    .select("id", { count: "exact", head: true })
    .eq("vehicle_id", id)
    .eq("status", "confirmed");

  const confirmed = confirmedCount ?? 0;
  const force = formData.get("force") === "on";
  if (parsed.capacity < confirmed && !force) {
    return { ok: false, error: "capacity_below_confirmed", confirmedCount: confirmed };
  }

  const { error } = await admin.from("joop_03_launch_vehicles").update(parsed).eq("id", id);
  if (error) return { ok: false, error: "save" };

  revalidateLaunch(id);
  return { ok: true, id };
}

export type SimpleResult<E extends string> = { ok: true } | { ok: false; error: E };

export async function setVehicleStatus(
  id: string,
  next: VehicleStatus,
): Promise<SimpleResult<"auth" | "not_found" | "invalid_transition" | "save">> {
  if (!(await requireAdminAction())) return { ok: false, error: "auth" };

  const admin = createAdminClient();
  const { data: vehicle } = await admin
    .from("joop_03_launch_vehicles")
    .select("id,status")
    .eq("id", id)
    .maybeSingle();
  if (!vehicle) return { ok: false, error: "not_found" };

  // 발사는 비가역이다. launched 에서 나가는 전이는 허용하지 않는다.
  if (vehicle.status === "launched") return { ok: false, error: "invalid_transition" };
  if (vehicle.status === next) return { ok: true };

  const { error } = await admin
    .from("joop_03_launch_vehicles")
    .update({ status: next })
    .eq("id", id);
  if (error) return { ok: false, error: "save" };

  if (next === "cancelled") {
    // 취소하면 살아있는 청약을 모두 거부 처리하고, 그 때문에 대기 중이던 줍스를 지상으로 돌린다.
    const { data: live } = await admin
      .from("joop_03_launch_bookings")
      .select("id,joop_id")
      .eq("vehicle_id", id)
      .in("status", ["pending", "confirmed"]);

    if (live && live.length > 0) {
      await admin
        .from("joop_03_launch_bookings")
        .update({ status: "rejected" })
        .eq("vehicle_id", id)
        .in("status", ["pending", "confirmed"]);

      // ⚠️ status='queued' 인 줍스만 되돌린다. 이미 발사됐거나(launching) 궤도에 오른(orbit)
      //    줍스를 지상으로 끌어내리면 안 된다.
      for (const booking of live as { id: number; joop_id: string }[]) {
        await rollbackJoopIfIdle(booking.joop_id, id);
      }
    }
  }

  revalidateLaunch(id);
  return { ok: true };
}

/**
 * 줍스를 지상으로 되돌린다. 단 (a) 지금 'queued' 이고 (b) 다른 예정 발사체에 남은
 * 확정 청약이 없을 때만. 한 사용자가 발사체 여러 대에 청약할 수 있으므로(테이블의 unique 는
 * (vehicle_id, owner_id) 라 발사체별로 1회) 다른 확정이 남아 있으면 계속 대기 상태여야 한다.
 */
async function rollbackJoopIfIdle(joopId: string, excludeVehicleId?: string): Promise<void> {
  const admin = createAdminClient();

  let query = admin
    .from("joop_03_launch_bookings")
    .select("id,vehicle:joop_03_launch_vehicles!inner(status)")
    .eq("joop_id", joopId)
    .eq("status", "confirmed")
    .eq("vehicle.status", "scheduled");

  // uuid 컬럼이라 빈 문자열을 넘기면 안 된다. 제외 대상이 있을 때만 조건을 붙인다.
  if (excludeVehicleId) query = query.neq("vehicle_id", excludeVehicleId);

  const { data: others } = await query;
  if (others && others.length > 0) return;

  await admin
    .from("joop_03_joops")
    .update({ status: "ground" })
    .eq("id", joopId)
    .eq("status", "queued");
}

export type BookingActionError =
  | "auth"
  | "not_found"
  | "not_scheduled"
  | "full"
  | "already_confirmed_elsewhere"
  | "save";

/** 탑승 승인 (FR-4.2). 정원과 중복 확정을 확인한 뒤 확정하고 줍스를 대기 상태로 올린다. */
export async function approveBooking(
  bookingId: number,
  force = false,
): Promise<SimpleResult<BookingActionError>> {
  if (!(await requireAdminAction())) return { ok: false, error: "auth" };
  if (!Number.isInteger(bookingId)) return { ok: false, error: "not_found" };

  const admin = createAdminClient();
  const { data: booking } = await admin
    .from("joop_03_launch_bookings")
    .select("id,vehicle_id,joop_id,status")
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking) return { ok: false, error: "not_found" };

  const { data: vehicle } = await admin
    .from("joop_03_launch_vehicles")
    .select("id,capacity,status")
    .eq("id", booking.vehicle_id)
    .maybeSingle();
  if (!vehicle) return { ok: false, error: "not_found" };
  if (vehicle.status !== "scheduled") return { ok: false, error: "not_scheduled" };

  // 한 줍스가 두 로켓에 타는 일을 막는다.
  const { data: elsewhere } = await admin
    .from("joop_03_launch_bookings")
    .select("id,vehicle:joop_03_launch_vehicles!inner(status)")
    .eq("joop_id", booking.joop_id)
    .eq("status", "confirmed")
    .neq("vehicle_id", booking.vehicle_id)
    .eq("vehicle.status", "scheduled");
  if (elsewhere && elsewhere.length > 0) {
    return { ok: false, error: "already_confirmed_elsewhere" };
  }

  if (booking.status !== "confirmed") {
    // ⚠️ 세느라 읽고 나서 쓰는 사이에 사용자 쪽 자동 선별(bookLaunch)이 끼어들 수 있다.
    //    이 구간의 경쟁 조건은 완전히 없애지 못한다(worklog 의 "알려진 한계" 참조).
    //    실사용 규모(정원 수십, 동시 운영자 1명)에서는 실질적 위험이 낮다.
    const { count } = await admin
      .from("joop_03_launch_bookings")
      .select("id", { count: "exact", head: true })
      .eq("vehicle_id", booking.vehicle_id)
      .eq("status", "confirmed");

    if ((count ?? 0) >= vehicle.capacity && !force) return { ok: false, error: "full" };

    const { error } = await admin
      .from("joop_03_launch_bookings")
      .update({ status: "confirmed" })
      .eq("id", bookingId);
    if (error) return { ok: false, error: "save" };
  }

  await admin
    .from("joop_03_joops")
    .update({ status: "queued" })
    .eq("id", booking.joop_id)
    .eq("status", "ground");

  revalidateLaunch(booking.vehicle_id);
  return { ok: true };
}

/** 탑승 거부 또는 확정 취소. 줍스는 조건이 맞을 때만 지상으로 되돌린다. */
export async function demoteBooking(
  bookingId: number,
  to: "pending" | "rejected",
): Promise<SimpleResult<BookingActionError>> {
  if (!(await requireAdminAction())) return { ok: false, error: "auth" };
  if (!Number.isInteger(bookingId)) return { ok: false, error: "not_found" };

  const admin = createAdminClient();
  const { data: booking } = await admin
    .from("joop_03_launch_bookings")
    .select("id,vehicle_id,joop_id,status")
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking) return { ok: false, error: "not_found" };

  const { error } = await admin
    .from("joop_03_launch_bookings")
    .update({ status: to })
    .eq("id", bookingId);
  if (error) return { ok: false, error: "save" };

  // 이 청약은 방금 confirmed 에서 내려왔으므로 따로 제외할 발사체가 없다.
  await rollbackJoopIfIdle(booking.joop_id);

  revalidateLaunch(booking.vehicle_id);
  return { ok: true };
}
