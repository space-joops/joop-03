import { sendGTMEvent } from "@next/third-parties/google";

// GTM 커스텀 이벤트 — 얇은 타입 래퍼. sendGTMEvent(data: Object, ...)는 컴파일 타임
// 안전성이 없으므로, 이벤트 이름·파라미터 형태를 여기서 함수 시그니처로 고정한다.
// 네이밍: snake_case, 완료형은 과거형(_booked/_completed/_joined/_redeemed).

function track(event: string, params: Record<string, string | number> = {}) {
  sendGTMEvent({ event, ...params });
}

export function trackLaunchBooked(status: "confirmed" | "pending") {
  track("launch_booked", { status });
}

export function trackLaunchCompleted() {
  track("launch_completed");
}

export function trackArcadeCompleted(collected: number, totalCollected: number) {
  track("arcade_completed", { collected, total_collected: totalCollected });
}

export function trackMinigameCompleted(xpGained: number, level: number, xp: number) {
  track("minigame_completed", { xp_gained: xpGained, level, xp });
}

export function trackWaitlistJoined() {
  track("waitlist_joined");
}

export function trackInviteRedeemed() {
  track("invite_redeemed");
}

export function trackSetupCompleted() {
  track("setup_completed");
}

export function trackPwaInstallShown(mode: "prompt" | "ios-safari" | "ios-other" | "generic") {
  track("pwa_install_shown", { mode });
}

export function trackPwaInstallAccepted() {
  track("pwa_install_accepted");
}

export function trackPwaInstallDismissed(mode: "prompt" | "ios-safari" | "ios-other" | "generic") {
  track("pwa_install_dismissed", { mode });
}
