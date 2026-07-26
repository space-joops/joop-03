// 브랜드 심볼(v1.0) — public/brand/logo-symbol.svg 와 동일 지오메트리의 인라인 판.
// 64 그리드 currentColor 단색: 색은 부모 color 로 주입(팔레트 하드코딩 없음).
// next/image 는 currentColor 를 물들일 수 없어 인라인 SVG 로 사용한다(디자인 답변, PR #19).
export function LogoSymbol({ size = 28 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      aria-hidden
    >
      {/* 지구(경위도 그리드) */}
      <circle cx="32" cy="32" r="16" strokeWidth={3} />
      <ellipse cx="32" cy="32" rx="6.5" ry="16" strokeWidth={1.5} opacity={0.55} />
      <path d="M16 32h32" strokeWidth={1.5} opacity={0.55} />
      <path d="M17.9 24.5h28.2M17.9 39.5h28.2" strokeWidth={1.5} opacity={0.35} />
      {/* 궤도 링 (-24°) */}
      <ellipse
        cx="32"
        cy="32"
        rx="28.5"
        ry="10.5"
        strokeWidth={2}
        opacity={0.9}
        transform="rotate(-24 32 32)"
      />
      {/* 줍스 점 (궤도 위) */}
      <circle cx="50.8" cy="17" r="6" fill="currentColor" stroke="none" opacity={0.25} />
      <circle cx="50.8" cy="17" r="3" fill="currentColor" stroke="none" />
    </svg>
  );
}
