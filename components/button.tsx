// 공통 버튼 — 물리 버튼 은유(카세트퓨처리즘), handoff-m6.md §4-4.
// 스타일 본체는 app/globals.css 의 .btn-console-* (:active/:disabled 상태 포함).
// 비활성은 variant 가 아니라 disabled 속성으로 표현한다.
import Link from "next/link";
import type { ComponentProps } from "react";

type Variant = "primary" | "secondary";

const VARIANT_CLASS: Record<Variant, string> = {
  primary: "btn-console-primary",
  secondary: "btn-console-secondary",
};

function cx(...parts: Array<string | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function Button({
  variant = "primary",
  className,
  type = "button",
  ...props
}: { variant?: Variant } & ComponentProps<"button">) {
  return <button type={type} className={cx(VARIANT_CLASS[variant], className)} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  className,
  ...props
}: { variant?: Variant } & ComponentProps<typeof Link>) {
  return <Link className={cx(VARIANT_CLASS[variant], className)} {...props} />;
}
