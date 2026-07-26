import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { OnboardingShell } from "@/components/onboarding-shell";
import { OnboardingForm } from "@/components/onboarding-form";
import { BootSequence } from "@/components/boot-sequence";
import { SetupForm } from "@/components/setup-form";

/**
 * 온보딩 3단계 시안 검수용 — 개발 환경 전용(운영에서는 404).
 *
 * 왜 필요한가: ②③은 세션 가드가 있어서 실제로 보려면 초대코드를 소진하고 익명 사용자를
 * 만들어야 한다(= 공유 DB 쓰기). 디자인이 어떻게 적용됐는지 확인하는 데 그 비용을 치를
 * 이유가 없으므로, 같은 컴포넌트를 스텁 props 로 렌더해 393×852 프레임 3개로 나란히 본다.
 * docs/design/mockups/onboarding.png 과 1:1 로 비교하는 용도.
 *
 * 주의: 여기 폼의 제출 버튼은 실제 Server Action 을 호출한다(= DB 쓰기). 검수 중에는 누르지 말 것.
 */
export const dynamic = "force-dynamic";

export default async function OnboardingPreviewPage({
  params,
  searchParams,
}: PageProps<"/[lang]/onboarding/preview">) {
  if (process.env.NODE_ENV === "production") notFound();

  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const sp = await searchParams;
  // ?boot=complete → 부팅 완료 상태로 렌더(연출 끝 모습·모션 최소화 대안 검수용)
  const bootComplete = sp.boot === "complete";
  // ?w=360 → 좁은 폭 검수(기준 프레임은 393). --page-pad-x 축소는 뷰포트 폭을 따르므로
  // 브라우저 창도 함께 좁혀야 한다.
  const frameWidth = Number(Array.isArray(sp.w) ? sp.w[0] : sp.w) || 393;

  const dict = await getDictionary(lang);
  const t = dict.onboarding;

  const frames = [
    {
      caption: "① 초대코드 입력 — FR-2.1 / FR-2.2",
      node: (
        <OnboardingShell
          title={t.invite.pageTitle}
          step={1}
          stepLabel={t.stepIndicator.replace("{n}", "1")}
          back={{ href: `/${lang}`, label: t.a11y.back }}
        >
          <p className="mb-1 text-xs uppercase leading-4 tracking-[0.08em] text-[var(--color-secondary)]">
            {t.invite.eyebrow}
          </p>
          <h2 className="mb-1.5 text-[22px] font-semibold leading-[30px]">{t.invite.title}</h2>
          <p className="mb-6 text-[15px] leading-[22px] text-[var(--color-muted)]">
            {t.invite.lead}
          </p>
          <OnboardingForm lang={lang} dict={dict} />
        </OnboardingShell>
      ),
    },
    {
      caption: "② 분양 연출(보급 카트리지 부팅) — FR-2.2 · 진입 시 3초 재생",
      node: (
        <OnboardingShell
          title={t.boot.title}
          step={2}
          stepLabel={t.stepIndicator.replace("{n}", "2")}
        >
          <BootSequence
            lang={lang}
            dict={dict}
            deviceName="JOOP-0042"
            rememberSeen={false}
            startComplete={bootComplete}
          />
        </OnboardingShell>
      ),
    },
    {
      caption: "③ 이름·색 설정 — FR-2.3 · 스와치 클릭 시 캐릭터 액센트 교체",
      node: (
        <OnboardingShell
          title={t.setup.title}
          step={3}
          stepLabel={t.stepIndicator.replace("{n}", "3")}
          back={{ href: `/${lang}/onboarding/boot`, label: t.a11y.back }}
        >
          <SetupForm lang={lang} dict={dict} />
        </OnboardingShell>
      ),
    },
  ];

  return (
    <div className="min-h-full p-6" style={{ background: "#1a1d1f" }}>
      <h1 className="mb-4 text-[15px] leading-[22px] text-[var(--color-muted)]">
        온보딩(M2) 적용 검수 — 개발 전용. 시안: docs/design/mockups/onboarding.png
      </h1>
      <div className="flex items-start gap-6 overflow-x-auto pb-4">
        {frames.map((f) => (
          <div key={f.caption} className="flex-none">
            <p className="mb-2 text-xs leading-4 text-[var(--color-muted)]">{f.caption}</p>
            <div
              className="flex h-[852px] flex-col overflow-hidden rounded-[24px]"
              style={{
                width: frameWidth,
                background: "var(--color-bg)",
                outline: "1px solid #333",
              }}
            >
              {f.node}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
