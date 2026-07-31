import { joopSheetPath, sheetForColor } from "../core/joop-sprite";

// DOM 용 줍스 캐릭터 — 시트의 idle 2프레임을 CSS steps() 로 2fps 루프.
// 애니메이션·reduced-motion 정지는 globals.css 의 .joop-sprite-idle 이 담당(JS 불필요).
// 순수 표현 컴포넌트라 서버/클라이언트 어디서든 렌더 가능. 장식이므로 aria-hidden.
export function JoopSprite({
  color,
  size = 96,
  className = "",
}: {
  /** 줍스 색 hex — 가장 가까운 시트 변형으로 매핑된다 */
  color: string;
  /** 렌더 크기(px, 정사각) */
  size?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={`joop-sprite joop-sprite-idle inline-block ${className}`}
      style={{
        width: size,
        height: size,
        backgroundImage: `url(${joopSheetPath(sheetForColor(color))})`,
        backgroundSize: `${size * 6}px ${size}px`,
        "--joop-frame": `${size}px`,
      } as React.CSSProperties}
    />
  );
}
