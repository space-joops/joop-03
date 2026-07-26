"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function LaunchSequencePage() {
  const router = useRouter();
  const [phase, setPhase] = useState<"select" | "countdown" | "liftoff">("select");
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    if (phase === "countdown") {
      if (countdown > 0) {
        const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
        return () => clearTimeout(timer);
      } else {
        setPhase("liftoff");
        setTimeout(() => {
          router.push("/space");
        }, 3000); // 3 seconds of liftoff animation before navigating
      }
    }
  }, [phase, countdown, router]);

  return (
    <div className="flex flex-col min-h-screen bg-black text-white max-w-md mx-auto relative p-6">
      <header className="flex justify-between items-center mb-12 mt-8 z-10 relative">
        <span className="font-mono text-primary text-xl">ORBITAL LAUNCH</span>
      </header>

      {phase === "select" && (
        <main className="flex-1 flex flex-col gap-8 z-10 relative">
          <div className="panel-bezel p-6 flex flex-col gap-6">
            <h1 className="font-display text-2xl text-primary crt-glow-primary">SELECT VEHICLE</h1>
            <p className="font-body text-sm text-muted">Choose a launch provider to deploy your Joop into Low Earth Orbit.</p>
            
            <div className="flex flex-col gap-4 mt-4">
              <button 
                onClick={() => setPhase("countdown")}
                className="bg-surface border border-muted p-4 text-left hover:border-primary group transition-colors"
              >
                <div className="font-mono text-primary group-hover:animate-pulse">Falcon 9 (SpaceX)</div>
                <div className="text-xs text-muted mt-1">Cape Canaveral, FL • 99.8% Success</div>
              </button>
              
              <button 
                onClick={() => setPhase("countdown")}
                className="bg-surface border border-muted p-4 text-left hover:border-primary group transition-colors"
              >
                <div className="font-mono text-primary group-hover:animate-pulse">Electron (Rocket Lab)</div>
                <div className="text-xs text-muted mt-1">Mahia, NZ • Dedicated Joop Payload</div>
              </button>
            </div>
          </div>
        </main>
      )}

      {phase === "countdown" && (
        <main className="flex-1 flex flex-col items-center justify-center z-10 relative">
          <div className="text-center">
            <div className="font-mono text-secondary mb-4">T-MINUS</div>
            <div className="font-display text-9xl text-primary crt-glow-primary animate-pulse">
              {countdown}
            </div>
          </div>
        </main>
      )}

      {phase === "liftoff" && (
        <main className="flex-1 flex flex-col items-center justify-center z-10 relative overflow-hidden">
          <div className="absolute inset-0 bg-white animate-ping opacity-20"></div>
          
          <div className="flex flex-col items-center animate-[bounce_0.5s_infinite]">
            <Image src="/game/exhaust.svg" alt="thrust" width={80} height={80} className="rotate-180 mb-2 scale-150 animate-pulse" />
            <div className="w-16 h-32 bg-zinc-300 rounded-t-full relative border-x-4 border-t-4 border-zinc-500 flex items-center justify-center">
              <Image src="/brand/logo-symbol.svg" alt="joops" width={32} height={32} className="opacity-50" />
            </div>
            {/* Massive thrust */}
            <div className="w-8 h-48 bg-gradient-to-b from-primary to-transparent mt-2 blur-md animate-pulse"></div>
          </div>
          
          <div className="absolute bottom-20 font-display text-4xl text-primary crt-glow-primary tracking-widest uppercase">
            LIFTOFF!
          </div>
        </main>
      )}

      {/* Grid Background */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-20"
           style={{
             backgroundImage: "linear-gradient(#39ff14 1px, transparent 1px), linear-gradient(90deg, #39ff14 1px, transparent 1px)",
             backgroundSize: "20px 20px"
           }}>
      </div>
    </div>
  );
}
