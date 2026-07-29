// 발사체 프로필 + 발사 타임라인 + 연출용 텔레메트리 곡선 — 순수 모듈(클라 import 안전).
//
// DB(joop_03_launch_vehicles)에는 특성 컬럼이 없고 관리자가 임의 이름을 넣을 수 있으므로,
// 이름 정확 매칭(시드 5종) → provider 휴리스틱 → 기본 폴백 3단으로 해석한다.
// 실제 물리 시뮬이 아니라 **중계 연출용 근사**다 — 비율의 출처는 Falcon 9 CRS-33 중계
// (Max-Q T+1:12 / MECO 2:27 / 단 분리 2:30 / 2단 점화 2:38 / 부스터 착륙 ~8:30 / SECO ~8:50).

import type { MyVehicle } from "@/lib/launch";

export type VehicleProfile = {
  id: string;
  /** 단수(연출용 — 3단이면 SECO 라벨을 2단 컷오프로 쓴다) */
  stages: 2 | 3;
  /** 1단 부스터 회수(착륙 컷어웨이 장면) 여부 — SpaceX 계열만 true */
  boosterLanding: boolean;
  /** 로켓 본체 폴백 색(rocket.svg 미로딩 시) */
  bodyColor: string;
  accentColor: string;
  /** 1단이 전체 높이에서 차지하는 비(단 분리 연출) */
  stageRatio: number;
};

const PROFILES: Record<string, VehicleProfile> = {
  falcon9: {
    id: "falcon9",
    stages: 2,
    boosterLanding: true,
    bodyColor: "#e8ebee",
    accentColor: "#222831",
    stageRatio: 0.72,
  },
  electron: {
    id: "electron",
    stages: 2,
    boosterLanding: false,
    bodyColor: "#16181d",
    accentColor: "#c62828",
    stageRatio: 0.66,
  },
  ariane6: {
    id: "ariane6",
    stages: 2,
    boosterLanding: false,
    bodyColor: "#f2efe9",
    accentColor: "#e3701a",
    stageRatio: 0.6,
  },
  longmarch5: {
    id: "longmarch5",
    stages: 2,
    boosterLanding: false,
    bodyColor: "#f4f4f2",
    accentColor: "#2a4d9b",
    stageRatio: 0.62,
  },
  soyuz: {
    id: "soyuz",
    stages: 3,
    boosterLanding: false,
    bodyColor: "#b9b3a1",
    accentColor: "#5f7a3e",
    stageRatio: 0.55,
  },
};

const FALLBACK: VehicleProfile = {
  id: "generic",
  stages: 2,
  boosterLanding: false,
  bodyColor: "#d9dee2",
  accentColor: "#3a4a56",
  stageRatio: 0.65,
};

const norm = (s: string) => s.toLowerCase().replace(/[\s\-_]/g, "");

/** 발사체 → 프로필. 매칭 실패는 반드시 기본 폴백(관리자 임의 이름 허용 구조). */
export function resolveVehicleProfile(v: MyVehicle | null | undefined): VehicleProfile {
  if (!v) return FALLBACK;
  const name = norm(v.name);
  const provider = norm(v.provider);
  if (name.includes("falcon")) return PROFILES.falcon9;
  if (name.includes("electron")) return PROFILES.electron;
  if (name.includes("ariane")) return PROFILES.ariane6;
  if (name.includes("longmarch") || name.includes("장정")) return PROFILES.longmarch5;
  if (name.includes("soyuz") || name.includes("소유즈")) return PROFILES.soyuz;
  if (provider.includes("spacex")) return PROFILES.falcon9;
  if (provider.includes("rocketlab")) return PROFILES.electron;
  if (provider.includes("arianespace") || provider.includes("esa")) return PROFILES.ariane6;
  if (provider.includes("casc")) return PROFILES.longmarch5;
  if (provider.includes("roscosmos")) return PROFILES.soyuz;
  return FALLBACK;
}

// ── 타임라인 ────────────────────────────────────────────────────────────────

export type LaunchEventId =
  | "liftoff"
  | "maxQ"
  | "meco"
  | "separation"
  | "secondIgnition"
  | "boosterLanding"
  | "seco"
  | "fairing"
  | "deploy"
  | "orbitInsertion";

export type LaunchEvent = { id: LaunchEventId; tSec: number };

/**
 * 총 길이(초)에 CRS-33 비율을 입혀 이벤트 시각표를 만든다.
 * boosterLanding=false 프로필은 착륙 이벤트가 아예 빠진다 — 타임라인 점 수가
 * 발사체마다 달라지는 것 자체가 "발사체 특성"의 표현이다.
 */
export function buildLaunchTimeline(p: VehicleProfile, totalSec: number): LaunchEvent[] {
  const ev: LaunchEvent[] = [
    { id: "liftoff", tSec: 0 },
    { id: "maxQ", tSec: totalSec * 0.1 },
    { id: "meco", tSec: totalSec * 0.2 },
    { id: "separation", tSec: totalSec * 0.21 },
    { id: "secondIgnition", tSec: totalSec * 0.23 },
  ];
  if (p.boosterLanding) ev.push({ id: "boosterLanding", tSec: totalSec * 0.55 });
  // 사출 시퀀스(지구 등장 → 페어링 → 큐브샛 → 줍스 전개 → 궤도 진입)가 뒤 38%를 쓴다.
  // 180초 기준 사출 창 ≈50초 — 15초였던 이전 배치로는 연출이 압축된다.
  ev.push(
    { id: "seco", tSec: totalSec * 0.62 },
    { id: "fairing", tSec: totalSec * 0.66 },
    { id: "deploy", tSec: totalSec * 0.72 },
    { id: "orbitInsertion", tSec: totalSec },
  );
  return ev;
}

// ── 연출용 텔레메트리 곡선 ──────────────────────────────────────────────────

const smooth = (t: number) => {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
};

/**
 * T+t초의 표시용 속도(km/h)·고도(km). 실제 궤적이 아니라 중계 화면의 "느낌" 근사 —
 * 이벤트 시각을 앵커로 구간별 smoothstep 보간, 엔진 컷(MECO/SECO)에서 증가가 꺾인다.
 */
export function sampleTelemetry(
  timeline: LaunchEvent[],
  tSec: number,
): { speedKmh: number; altKm: number } {
  const at = (id: LaunchEventId, fb: number) => timeline.find((e) => e.id === id)?.tSec ?? fb;
  const total = at("orbitInsertion", 150);
  const tMaxQ = at("maxQ", total * 0.1);
  const tMeco = at("meco", total * 0.2);
  const tSecond = at("secondIgnition", total * 0.23);
  const tSeco = at("seco", total * 0.72);

  // 속도(km/h): 0 → MaxQ 1,600 → MECO 5,800 → (분리 딥 −150) → SECO 27,400 → 유지
  let speed: number;
  if (tSec <= tMaxQ) speed = 1600 * smooth(tSec / tMaxQ);
  else if (tSec <= tMeco) speed = 1600 + 4200 * smooth((tSec - tMaxQ) / (tMeco - tMaxQ));
  else if (tSec <= tSecond) speed = 5800 - 150 * smooth((tSec - tMeco) / (tSecond - tMeco));
  else if (tSec <= tSeco) speed = 5650 + 21750 * smooth((tSec - tSecond) / (tSeco - tSecond));
  else speed = 27400;

  // 고도(km): 0 → MaxQ 13 → MECO 68 → SECO 205 → 210 유지
  let alt: number;
  if (tSec <= tMaxQ) alt = 13 * smooth(tSec / tMaxQ);
  else if (tSec <= tMeco) alt = 13 + 55 * smooth((tSec - tMaxQ) / (tMeco - tMaxQ));
  else if (tSec <= tSeco) alt = 68 + 137 * smooth((tSec - tMeco) / (tSeco - tMeco));
  else alt = 205 + 5 * smooth((tSec - tSeco) / Math.max(1, total - tSeco));

  return { speedKmh: Math.round(speed), altKm: alt };
}
