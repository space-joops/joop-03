import TopBar from "@/components/m1/TopBar";
import OrbitCanvas from "@/components/m1/OrbitCanvas";
import ProgressGauge from "@/components/m1/ProgressGauge";
import RankingList from "@/components/m1/RankingList";
import CTA from "@/components/m1/CTA";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground max-w-md mx-auto relative shadow-2xl shadow-primary/5">
      {/* Scanline overlay is handled by body background in globals.css, but we can add an extra inner shadow for the CRT bezel feel */}
      <div className="pointer-events-none fixed inset-0 z-50 shadow-[inset_0_0_50px_rgba(0,0,0,0.8)] border-[1px] border-surface/50 max-w-md mx-auto"></div>
      
      <TopBar />
      
      <main className="flex-1 flex flex-col overflow-y-auto pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] scrollbar-hide">
        <OrbitCanvas />
        <ProgressGauge percent={62} total={1284000} />
        <RankingList />
        <CTA />
      </main>
    </div>
  );
}
