"use client";

import { useEffect, useRef, useState } from "react";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import {
  trackPwaInstallAccepted,
  trackPwaInstallDismissed,
  trackPwaInstallShown,
} from "@/lib/analytics";

// PWA 설치 안내 배너 + 새 배포 업데이트 안내 (docs/architecture/adr/0002-pwa-portrait.md 후속).
// - 미설치(브라우저): iOS Safari → 홈 화면 추가 3단계 / iOS 타 브라우저 → Safari 유도 /
//   그 외 → beforeinstallprompt 설치 버튼, 3초 내 미발화면 브라우저 메뉴 일반 안내로 폴백.
// - 설치됨(standalone): /api/version 폴링으로 새 배포 감지 시 업데이트 안내 + 수동 리로드.
// 두 UI 는 standalone 게이트로 상호배타. 닫기는 세션 한정(매 방문 재노출 — 사용자 확정).

type PwaDict = Dictionary["pwa"];
type InstallMode = "hidden" | "prompt" | "ios-safari" | "ios-other" | "generic";

const DISMISS_KEY = "joops.pwa.installDismissed";
const BIP_GRACE_MS = 3000; // beforeinstallprompt 대기 유예
const VERSION_POLL_MS = 5 * 60 * 1000;

function isStandaloneDisplay(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari 레거시 플래그
    ("standalone" in navigator &&
      (navigator as { standalone?: boolean }).standalone === true)
  );
}

function detectPlatform(): { isIOS: boolean; isIOSSafari: boolean } {
  const ua = navigator.userAgent;
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    // iPadOS 13+ 는 데스크톱 UA(MacIntel)로 위장 — 터치포인트로 구분
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  // iOS 의 타 브라우저는 WebKit 위에 자체 토큰을 얹는다 (Chrome/Firefox/Edge/Opera/네이버 등)
  const iosNonSafari = /CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|YaBrowser|DuckDuckGo|GSA\/|NAVER|Whale/i.test(ua);
  return { isIOS, isIOSSafari: isIOS && !iosNonSafari };
}

export function PwaPrompt({
  dict,
  currentVersion,
}: {
  dict: PwaDict;
  currentVersion: string;
}) {
  const [installMode, setInstallMode] = useState<InstallMode>("hidden");
  const [updateReady, setUpdateReady] = useState(false);
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);
  // 배너 "노출" 이벤트는 컴포넌트 생애주기당 1회만 — generic → prompt로 뒤늦게
  // 승격돼도(onBip이 유예 이후 도착) 재발화하지 않는다(최초 노출 시점의 mode만 기록).
  const shownTracked = useRef(false);
  const markShown = (mode: Exclude<InstallMode, "hidden">) => {
    if (shownTracked.current) return;
    shownTracked.current = true;
    trackPwaInstallShown(mode);
  };

  // 설치 배너 판별 — 마운트 후에만 실행 (SSR/hydration 안전, 초기엔 숨김이라 플래시 없음)
  useEffect(() => {
    if (isStandaloneDisplay() || sessionStorage.getItem(DISMISS_KEY)) return;

    const { isIOS, isIOSSafari } = detectPlatform();
    if (isIOS) {
      // 효과 본문 동기 setState 금지(react-hooks/set-state-in-effect) — 타이머로 비동기화
      const t = setTimeout(() => {
        const mode = isIOSSafari ? "ios-safari" : "ios-other";
        setInstallMode(mode);
        markShown(mode);
      }, 0);
      return () => clearTimeout(t);
    }

    const onBip = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      deferredPrompt.current = e;
      setInstallMode("prompt"); // 유예 후 늦게 와도 generic → 버튼형 승격
      markShown("prompt");
    };
    const onInstalled = () => {
      trackPwaInstallAccepted();
      setInstallMode("hidden");
    };
    window.addEventListener("beforeinstallprompt", onBip);
    window.addEventListener("appinstalled", onInstalled);
    const grace = setTimeout(() => {
      if (!deferredPrompt.current) {
        setInstallMode("generic");
        markShown("generic");
      }
    }, BIP_GRACE_MS);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("appinstalled", onInstalled);
      clearTimeout(grace);
    };
  }, []);

  // 새 배포 폴링 — 설치형(standalone)에서만. 감지 즉시 중단, 실패는 조용히 무시.
  useEffect(() => {
    if (!isStandaloneDisplay()) return;
    let stopped = false;
    const check = async () => {
      if (stopped) return;
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { version?: string };
        if (
          !stopped &&
          typeof data.version === "string" &&
          data.version &&
          data.version !== currentVersion
        ) {
          stopped = true;
          setUpdateReady(true);
        }
      } catch {
        // 다음 주기 재시도
      }
    };
    const id = setInterval(check, VERSION_POLL_MS);
    const onVisibility = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stopped = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [currentVersion]);

  const dismissInstall = () => {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setInstallMode("hidden");
  };

  const install = async () => {
    const ev = deferredPrompt.current;
    if (!ev) return;
    await ev.prompt();
    const { outcome } = await ev.userChoice; // 수락이면 appinstalled 가 재차 숨김을 보장
    // "닫음"은 여기가 아니라 진짜 거절(prompt 응답이 dismissed)일 때만 — 수락은
    // appinstalled 리스너의 pwa_install_accepted가 이미 잡는다(중복 방지).
    if (outcome !== "accepted") trackPwaInstallDismissed("prompt");
    deferredPrompt.current = null;
    dismissInstall();
  };

  if (updateReady) {
    return (
      <BannerShell role="alert" ariaLabel={dict.update.title}>
        <BannerTitle text={dict.update.title} />
        <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-fg)]">
          {dict.update.body}
        </p>
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="flex-1 rounded-md py-2.5 text-center font-mono text-xs font-semibold uppercase tracking-widest"
            style={{ background: "var(--color-primary)", color: "var(--color-bg)" }}
          >
            {dict.update.updateButton}
          </button>
          <button
            type="button"
            onClick={() => setUpdateReady(false)}
            className="px-2 py-2 font-mono text-xs text-[var(--color-muted)] underline"
          >
            {dict.update.dismiss}
          </button>
        </div>
      </BannerShell>
    );
  }

  if (installMode === "hidden") return null;

  const steps =
    installMode === "ios-safari"
      ? dict.install.iosSafari
      : installMode === "ios-other"
        ? dict.install.iosOther
        : null;

  return (
    <BannerShell role="region" ariaLabel={dict.install.title}>
      <BannerTitle text={dict.install.title} />
      {steps ? (
        <>
          <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-fg)]">{steps.lead}</p>
          <ol className="mt-2 flex list-decimal flex-col gap-1 pl-5 text-sm leading-relaxed text-[var(--color-fg)]">
            <li>{steps.step1}</li>
            <li>{steps.step2}</li>
            <li>{steps.step3}</li>
          </ol>
        </>
      ) : (
        <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-fg)]">
          {installMode === "prompt" ? dict.install.body : dict.install.generic}
        </p>
      )}
      <div className="mt-3 flex items-center gap-3">
        {installMode === "prompt" && (
          <button
            type="button"
            onClick={install}
            className="flex-1 rounded-md py-2.5 text-center font-mono text-xs font-semibold uppercase tracking-widest"
            style={{ background: "var(--color-primary)", color: "var(--color-bg)" }}
          >
            {dict.install.installButton}
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            trackPwaInstallDismissed(installMode);
            dismissInstall();
          }}
          className={
            installMode === "prompt"
              ? "px-2 py-2 font-mono text-xs text-[var(--color-muted)] underline"
              : "ml-auto px-2 py-2 font-mono text-xs text-[var(--color-muted)] underline"
          }
        >
          {dict.install.dismiss}
        </button>
      </div>
    </BannerShell>
  );
}

function BannerShell({
  role,
  ariaLabel,
  children,
}: {
  role: "region" | "alert";
  ariaLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div
      role={role}
      aria-label={ariaLabel}
      className="pwa-prompt fixed inset-x-0 bottom-0 z-50 px-4 pb-[calc(env(safe-area-inset-bottom)+0.5rem)]"
    >
      <div
        className="panel-amber mx-auto w-full max-w-md px-4 py-3"
        style={{ background: "var(--color-bg)" }}
      >
        {children}
      </div>
    </div>
  );
}

function BannerTitle({ text }: { text: string }) {
  return (
    <p
      className="font-mono text-xs uppercase tracking-widest text-[var(--color-secondary)]"
      style={{ textShadow: "var(--glow-secondary)" }}
    >
      {text}
    </p>
  );
}
