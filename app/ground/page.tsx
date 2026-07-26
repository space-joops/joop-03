"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function GroundMinigamePage() {
  const router = useRouter();
  const [level, setLevel] = useState(1);
  const [xp, setXp] = useState(0);
  const xpNeeded = 100;
  
  const collectDebris = () => {
    setXp(prev => {
      const next = prev + 20;
      if (next >= xpNeeded) {
        setLevel(2);
      }
      return next;
    });
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#111] text-foreground max-w-md mx-auto relative p-4">
      <header className="flex justify-between items-center py-2 border-b border-muted/30">
        <span className="font-mono text-secondary">GROUND TRAINING</span>
        <span className="font-mono">LVL {level}</span>
      </header>

      <main className="flex-1 relative flex flex-col items-center justify-center">
        {/* Simple clicker mockup for M3 */}
        <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
          <Image src="/game/bg-earth.svg" alt="Earth" layout="fill" objectFit="cover" />
        </div>

        <div className="z-10 flex flex-col items-center gap-8">
          <div className="font-display text-4xl text-primary crt-glow-primary">{xp} / {xpNeeded}</div>
          
          <button 
            onClick={collectDebris}
            className="w-32 h-32 rounded-full border-4 border-primary border-dashed flex items-center justify-center active:scale-95 transition-transform hover:bg-primary/10 relative"
          >
            <Image src="/game/debris.svg" alt="Debris" width={64} height={64} className="opacity-80" />
            <div className="absolute -bottom-10 font-mono text-sm text-primary">TAP TO COLLECT</div>
          </button>
        </div>

        {/* Progress Bar */}
        <div className="absolute bottom-24 left-4 right-4 h-4 bg-black border border-muted/50 rounded-full overflow-hidden">
          <div 
            className="h-full bg-primary transition-all duration-300" 
            style={{ width: `${Math.min(100, (xp / xpNeeded) * 100)}%` }}
          />
        </div>

        {level >= 2 && (
          <div className="absolute bottom-6 left-4 right-4">
            <button 
              onClick={() => router.push("/arcade")}
              className="w-full bg-success text-black font-display text-xl py-4 rounded-sm animate-pulse"
            >
              LAUNCH AUTHORIZED 🚀
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
