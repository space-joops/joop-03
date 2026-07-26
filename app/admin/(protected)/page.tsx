import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { getDashboardSummary } from "@/lib/admin/queries";
import {
  panelClass,
  panelStyle,
  labelClass,
  mutedTextClass,
  formatDateTime,
} from "@/components/admin/ui";

export const dynamic = "force-dynamic";

function Card({
  href,
  title,
  value,
  hint,
  danger,
}: {
  href: string;
  title: string;
  value: string;
  hint: string;
  danger?: boolean;
}) {
  return (
    <Link href={href} className={panelClass} style={panelStyle}>
      <p className={labelClass}>{title}</p>
      <p
        className="mt-2 font-mono text-2xl font-semibold"
        style={{ color: danger ? "var(--color-danger)" : "var(--color-primary)" }}
      >
        {value}
      </p>
      <p className={`mt-1 ${mutedTextClass}`}>{hint}</p>
    </Link>
  );
}

export default async function AdminDashboardPage() {
  // 레이아웃 가드는 클라이언트 네비게이션 때 재실행되지 않으므로 페이지에서도 확인한다.
  await requireAdmin();

  const s = await getDashboardSummary();

  const nextLaunchHint = s.nextLaunch
    ? `다음: ${s.nextLaunch.name} · ${formatDateTime(s.nextLaunch.launchAt)}`
    : "예정된 발사 없음";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-mono text-lg font-semibold text-[var(--color-fg)]">운영 현황</h1>
        <p className={`mt-1 ${mutedTextClass}`}>
          줍스 운영에 필요한 설정·발사체·초대를 여기서 관리합니다.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card
          href="/admin/launch"
          title="선별 대기 청약"
          value={`${s.pendingBookings}`}
          hint={`예정 발사체 ${s.scheduledVehicles}대 · ${nextLaunchHint}`}
          danger={s.pendingBookings > 0}
        />
        <Card
          href="/admin/config"
          title="궤도 / 지상 줍스"
          value={`${s.joopsInOrbit} / ${s.joopsOnGround}`}
          hint="궤도에 있는 줍스와 지상에서 훈련 중인 줍스"
        />
        <Card
          href="/admin/invites"
          title="미사용 초대코드"
          value={`${s.activeInvites}`}
          hint="아직 소진되지 않은 코드"
        />
        <Card
          href="/admin/waitlist"
          title="대기리스트"
          value={`${s.waitlistTotal}`}
          hint={`코드 미발급 ${s.waitlistWithoutInvite}명`}
          danger={s.waitlistWithoutInvite > 0}
        />
      </div>

      {s.overCapacityVehicles > 0 && (
        <p
          className="rounded-md border px-4 py-3 font-mono text-xs"
          style={{ borderColor: "var(--color-danger)", color: "var(--color-danger)" }}
        >
          정원을 초과해 확정된 발사체가 {s.overCapacityVehicles}대 있습니다. 선별 화면에서 확정을
          조정하세요.
        </p>
      )}
    </div>
  );
}
