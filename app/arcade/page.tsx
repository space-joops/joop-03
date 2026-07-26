"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function ArcadePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const router = useRouter();
  const [fuel, setFuel] = useState(100);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;
    let vx = 0;
    let vy = 0;
    
    // Debris
    const debris = Array.from({ length: 10 }).map(() => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      active: true
    }));

    let animId: number;
    let lastTime = performance.now();

    const render = (time: number) => {
      const dt = (time - lastTime) / 16;
      lastTime = time;

      // Clear
      ctx.fillStyle = "#09090b";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Inertia (no friction)
      x += vx * dt;
      y += vy * dt;

      // Wrap around bounds
      if (x < 0) x = canvas.width;
      if (x > canvas.width) x = 0;
      if (y < 0) y = canvas.height;
      if (y > canvas.height) y = 0;

      // Draw Debris
      ctx.fillStyle = "#a1a1aa";
      debris.forEach(d => {
        if (!d.active) return;
        ctx.beginPath();
        ctx.arc(d.x, d.y, 4, 0, Math.PI * 2);
        ctx.fill();
        
        // Collision
        const dist = Math.hypot(d.x - x, d.y - y);
        if (dist < 20) {
          d.active = false;
        }
      });

      // Draw Joop
      ctx.fillStyle = "#39ff14";
      ctx.beginPath();
      ctx.arc(x, y, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 10;
      ctx.shadowColor = "#39ff14";
      ctx.fill();
      ctx.shadowBlur = 0;

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    // Mock Joystick input
    const handleTouch = (e: TouchEvent) => {
      // Just apply some random thrust for mockup
      vx += (Math.random() - 0.5) * 2;
      vy += (Math.random() - 0.5) * 2;
      setFuel(f => Math.max(0, f - 1));
    };

    canvas.addEventListener('touchstart', handleTouch);

    return () => {
      cancelAnimationFrame(animId);
      canvas.removeEventListener('touchstart', handleTouch);
    };
  }, []);

  return (
    <div className="flex flex-col h-screen w-full bg-black relative overflow-hidden text-white max-w-md mx-auto">
      <div className="absolute inset-0 opacity-20 pointer-events-none">
         {/* Parallax Background Mock */}
         <Image src="/game/bg-sun.svg" alt="Sun" width={200} height={200} className="absolute -top-10 -right-10" />
      </div>

      <header className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-10">
        <button onClick={() => router.push("/")} className="p-2 bg-surface/80 rounded">
          <Image src="/ui/icon-back.svg" alt="Back" width={24} height={24} />
        </button>
        <div className="flex flex-col items-end">
          <span className="font-mono text-xs text-muted">FUEL</span>
          <div className="w-32 h-4 bg-surface border border-muted/50 p-[1px]">
            <div className="h-full bg-secondary" style={{ width: `${fuel}%` }} />
          </div>
        </div>
      </header>

      <canvas 
        ref={canvasRef} 
        className="w-full h-full"
        width={393}
        height={852}
      />

      {/* Joystick Mockup */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 opacity-50 pointer-events-none">
        <Image src="/ui/joystick.svg" alt="Joystick" width={100} height={100} />
      </div>

      {fuel <= 0 && (
        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-20 gap-4">
          <h2 className="font-display text-4xl text-danger crt-glow-primary">OUT OF FUEL</h2>
          <button onClick={() => router.push("/")} className="bg-surface border-2 border-primary text-primary px-6 py-2 font-mono">
            RETURN TO BASE
          </button>
        </div>
      )}
    </div>
  );
}
