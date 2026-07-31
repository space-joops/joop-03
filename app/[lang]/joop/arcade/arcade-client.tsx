"use client";

import { ArcadeGame, type ArcadeGameProps } from "@joop/arcade-engine";
import { claimAdDockReward, payShadowEntry, submitArcadeResult } from "./actions";
import { trackArcadeCompleted } from "@/lib/analytics";
import { getAdDock, recordAdDock, readAdDockSnapshot } from "@/lib/ad-docks";
import { useRouter } from "next/navigation";

export function ArcadeClientWrapper(props: ArcadeGameProps) {
  const router = useRouter();

  return (
    <ArcadeGame
      {...props}
      assetsBaseUrl="/game"
      onPayShadowEntry={payShadowEntry}
      onSubmitArcadeResult={async (collected: number) => {
        const res = await submitArcadeResult(collected);
        if (res.ok) {
          trackArcadeCompleted(res.collected, res.totalCollected);
        }
        return res;
      }}
      onClaimAdDockReward={claimAdDockReward}
      getAdDock={getAdDock}
      recordAdDock={recordAdDock}
      getAdDockSnapshot={readAdDockSnapshot}
      onMapClick={() => router.push(`/${props.lang}/joop/map`)}
    />
  );
}
