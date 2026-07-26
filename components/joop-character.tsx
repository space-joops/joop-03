"use client";

import { useId } from "react";

/**
 * 줍스 캐릭터 — 대기(idle) 포즈 인라인 SVG.
 *
 * 지오메트리는 디자이너 마스터와 동일하다:
 *   public/design-src/game/joop-character-master.svg
 *   docs/design/mockups/onboarding.html (시안 ②③의 인라인 SVG)
 * 스프라이트 시트(public/game/joop-sheet-*.png)와 같은 형태이므로 M3 캔버스와 인지가 이어진다.
 *
 * 색 규칙 (docs/design/handoff-m2.md §2):
 *   - 고정색(셸 #c8d2c4 / 라인 #5c6b5e / 금속 #8ba08c / 스크린 #071a0d / 노즐 #414d43·#2a332c
 *     / 보조 LED #ffb000)은 캐릭터 로컬 팔레트이고 디자인 토큰이 아니라서 리터럴로 둔다.
 *   - 액센트(눈·입·안테나 팁·1번 LED·스크린 틴트)만 `currentColor` → --joop-accent 를 따른다.
 *     즉 색 교체는 부모가 --joop-accent 를 바꾸면 즉시 반영된다.
 */
export function JoopCharacter({
  size,
  label,
  still = false,
  className,
}: {
  /** 렌더 픽셀 크기. 시안: 부팅 화면 170, 설정 미리보기 180 */
  size: number;
  /** 지정하면 role="img" + aria-label, 없으면 장식으로 취급(aria-hidden) */
  label?: string;
  /** 연출상 정지가 필요할 때. prefers-reduced-motion 은 CSS 가 따로 처리한다 */
  still?: boolean;
  className?: string;
}) {
  // 인스턴스별 유일 gradient id (시안은 tip2/tip3 로 하드코딩되어 있었다)
  const tipId = `joop-tip-${useId()}`;
  const blink = still ? "" : "animate-eye-blink motion-reduce:animate-none";
  const pulse = still ? "" : "animate-antenna-pulse motion-reduce:animate-none";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 128 128"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={className}
      // 액센트는 currentColor 로 흐른다. Tailwind 의 text-[var(--joop-accent)] 는 --color-* 네임스페이스가
      // 아니라 타입 추론이 안 돼 규칙이 생성되지 않으므로(→ color 가 fg 로 상속됨) 인라인으로 지정한다.
      style={{ color: "var(--joop-accent)" }}
    >
      <defs>
        <radialGradient id={tipId}>
          <stop offset="0%" stopColor="currentColor" stopOpacity=".9" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* 안테나 + 팁 발광 */}
      <path d="M64 24 V13" stroke="#8ba08c" strokeWidth={3} />
      <circle cx={64} cy={11} r={7} fill={`url(#${tipId})`} />
      <circle cx={64} cy={11} r={3.2} fill="currentColor" className={pulse} />

      {/* 팔 */}
      <g fill="#c8d2c4" stroke="#5c6b5e" strokeWidth={2}>
        <rect x={22} y={46} width={12} height={18} rx={6} transform="rotate(6 28 50)" />
        <rect x={94} y={46} width={12} height={18} rx={6} transform="rotate(-6 100 50)" />
      </g>

      {/* 셸 + 인셋 하이라이트 */}
      <rect x={34} y={24} width={60} height={54} rx={10} fill="#c8d2c4" stroke="#5c6b5e" strokeWidth={2.5} />
      <rect
        x={37.5}
        y={27.5}
        width={53}
        height={47}
        rx={7}
        fill="none"
        stroke="#f2f7f0"
        strokeOpacity=".5"
        strokeWidth={1.5}
      />

      {/* CRT 스크린 + 액센트 틴트 7% */}
      <rect x={42} y={32} width={44} height={32} rx={4} fill="#071a0d" stroke="#414d43" strokeWidth={2} />
      <rect x={42} y={32} width={44} height={32} rx={4} fill="currentColor" opacity=".07" />

      {/* 눈 · 입 */}
      <g className={`joop-eyes ${blink}`} fill="currentColor">
        <rect x={50} y={40} width={7} height={10} rx={1.5} />
        <rect x={71} y={40} width={7} height={10} rx={1.5} />
      </g>
      <rect x={56} y={55} width={16} height={3} rx={1.5} fill="currentColor" opacity=".9" />

      {/* LED 3개(1번만 액센트) + 통풍구 */}
      <circle cx={46} cy={71} r={2.2} fill="currentColor" />
      <circle cx={53} cy={71} r={2.2} fill="#ffb000" opacity=".85" />
      <circle cx={60} cy={71} r={2.2} fill="#5c6b5e" />
      <path d="M72 69.5h14M72 72.5h14" stroke="#8ba08c" strokeWidth={1.5} />

      {/* 스커트 + 노즐 */}
      <path d="M46 78 H82 L78 88 H50 Z" fill="#414d43" />
      <rect x={55} y={88} width={18} height={5} rx={2} fill="#2a332c" />
    </svg>
  );
}
