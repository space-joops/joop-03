"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function SpaceDashboardPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"map" | "inventory">("map");

  // Mock data for the map
  const isShadow = false; // Mock daylight state
  const altitude = 412; // km
  const speed = 7.66; // km/s

  return (
    <div className="flex flex-col min-h-screen bg-black text-white max-w-md mx-auto relative pb-safe">
      <header className="p-4 border-b border-surface flex justify-between items-center bg-black/80 z-20 sticky top-0">
        <Image src="/brand/logo-wordmark.svg" alt="JOOPS" width={100} height={24} />
        <div className="flex gap-2">
          <div className="w-2 h-2 rounded-full bg-success animate-pulse mt-1" />
          <span className="font-mono text-xs text-success">LINK ACTIVE</span>
        </div>
      </header>

      <main className="flex-1 flex flex-col relative">
        {/* Tab Navigation */}
        <div className="flex border-b border-surface bg-black z-20">
          <button 
            onClick={() => setTab("map")}
            className={`flex-1 py-4 font-display text-sm tracking-widest ${tab === "map" ? "text-primary border-b-2 border-primary bg-primary/5" : "text-muted hover:text-white"}`}
          >
            ORBITAL MAP
          </button>
          <button 
            onClick={() => setTab("inventory")}
            className={`flex-1 py-4 font-display text-sm tracking-widest ${tab === "inventory" ? "text-primary border-b-2 border-primary bg-primary/5" : "text-muted hover:text-white"}`}
          >
            INVENTORY
          </button>
        </div>

        {tab === "map" && (
          <div className="flex-1 flex flex-col">
            {/* Map Area */}
            <div className="relative w-full aspect-square bg-[#0a192f] overflow-hidden border-b border-surface">
              {/* World map mockup (just a wireframe grid for now) */}
              <div className="absolute inset-0 opacity-30"
                   style={{ backgroundImage: "radial-gradient(circle at center, #39ff14 1px, transparent 1px)", backgroundSize: "20px 20px" }}>
              </div>
              
              {/* Sine wave orbit path */}
              <svg className="absolute inset-0 w-full h-full opacity-50" viewBox="0 0 100 100" preserveAspectRatio="none">
                <path d="M 0 50 Q 25 10, 50 50 T 100 50" fill="none" stroke="#39ff14" strokeWidth="0.5" strokeDasharray="2 1"/>
              </svg>

              {/* Joop Location */}
              <div className="absolute top-[30%] left-[40%] flex flex-col items-center">
                <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center animate-pulse">
                  <Image src="/game/joop.svg" alt="Joop" width={24} height={24} />
                </div>
                <span className="font-mono text-[10px] text-primary mt-1 bg-black/80 px-1">SEOUL, KR</span>
              </div>
            </div>

            {/* Telemetry Data */}
            <div className="p-6 flex flex-col gap-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="panel-bezel p-3 flex flex-col">
                  <span className="font-mono text-xs text-muted">ALTITUDE</span>
                  <span className="font-display text-2xl text-white">{altitude} <span className="text-sm text-secondary">km</span></span>
                </div>
                <div className="panel-bezel p-3 flex flex-col">
                  <span className="font-mono text-xs text-muted">VELOCITY</span>
                  <span className="font-display text-2xl text-white">{speed} <span className="text-sm text-secondary">km/s</span></span>
                </div>
              </div>

              <div className="panel-bezel p-4 flex justify-between items-center bg-primary/10 border-primary">
                <div className="flex flex-col">
                  <span className="font-mono text-xs text-primary">STATUS</span>
                  <span className="font-display text-xl text-white">DAYLIGHT / MANUAL OK</span>
                </div>
                {!isShadow && (
                  <button 
                    onClick={() => router.push("/arcade")}
                    className="bg-primary text-black font-display text-lg py-2 px-6 rounded-sm active:scale-95 crt-glow-primary shadow-[0_0_15px_rgba(57,255,20,0.4)] hover:bg-white transition-colors"
                  >
                    ENTER ARCADE
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {tab === "inventory" && (
          <div className="flex-1 p-6 flex flex-col gap-6 overflow-y-auto">
            <h2 className="font-display text-xl text-primary crt-glow-primary">COLLECTED DEBRIS</h2>
            
            <div className="grid grid-cols-3 gap-4">
              {Array.from({length: 6}).map((_, i) => (
                <div key={i} className="aspect-square panel-bezel flex flex-col items-center justify-center bg-surface relative group">
                  {i < 3 ? (
                    <>
                      <Image src="/game/debris.svg" alt="Debris" width={32} height={32} className="opacity-80 group-hover:scale-110 transition-transform" />
                      <span className="absolute bottom-1 right-2 font-mono text-xs text-primary">{Math.floor(Math.random() * 50) + 10}</span>
                    </>
                  ) : (
                    <span className="font-mono text-xs text-muted opacity-30">EMPTY</span>
                  )}
                </div>
              ))}
            </div>

            <h2 className="font-display text-xl text-secondary mt-4">UPGRADES / CRAFTING</h2>
            <div className="flex flex-col gap-4">
              <div className="panel-bezel p-4 flex gap-4 items-center">
                <div className="w-12 h-12 bg-black flex items-center justify-center border border-muted/30">
                  <Image src="/ui/icon-magnet.svg" alt="Magnet" width={24} height={24} />
                </div>
                <div className="flex-1 flex flex-col">
                  <span className="font-display text-white">MAGNETIC TETHER</span>
                  <span className="font-mono text-xs text-muted">Cost: 150 Debris</span>
                </div>
                <button className="border border-secondary text-secondary px-3 py-1 font-mono text-sm hover:bg-secondary hover:text-black">
                  CRAFT
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
