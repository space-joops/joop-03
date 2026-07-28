import { ARCADE_DEBRIS } from "@/lib/arcade";
import { DEBRIS_SHEET } from "@/lib/minigame";
import type { DebrisKindId } from "@/lib/debris-kinds";

// 쓰레기 종류 아이콘 — debris-sheet.png(64px 6프레임)를 CSS background-position 으로
// 잘라 쓴다(components/joop-sprite.tsx 패턴). 서버 컴포넌트에서도 렌더 가능.
export function DebrisIcon({
  kind,
  size = 14,
  className,
}: {
  kind: DebrisKindId;
  size?: number;
  className?: string;
}) {
  const frame = ARCADE_DEBRIS.find((d) => d.id === kind)?.sheetFrame ?? 0;
  const frames = ARCADE_DEBRIS.length; // 시트 가로 프레임 수(6)
  return (
    <span
      aria-hidden
      className={`pixelated inline-block shrink-0 align-middle ${className ?? ""}`}
      style={{
        width: size,
        height: size,
        backgroundImage: `url(${DEBRIS_SHEET})`,
        backgroundRepeat: "no-repeat",
        backgroundSize: `${size * frames}px ${size}px`,
        backgroundPosition: `${-frame * size}px 0`,
      }}
    />
  );
}
