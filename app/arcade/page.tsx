"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function ArcadePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const router = useRouter();
  const [fuel, setFuel] = useState(100);
  const [score, setScore] = useState(0);

  // Preload images
  const imagesRef = useRef<Record<string, HTMLImageElement>>({});

  useEffect(() => {
    const srcList = ["/game/joop.svg", "/game/debris.svg", "/game/satellite.svg", "/game/bg-sun.svg", "/game/bg-moon.svg"];
    srcList.forEach(src => {
      const img = new window.Image();
      img.src = src;
      img.onload = () => { imagesRef.current[src] = img; };
    });
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Camera (World) coordinates
    const worldSize = 3000;
    let camX = worldSize / 2;
    let camY = worldSize / 2;
    let vx = 0;
    let vy = 0;
    
    // Debris Spawner
    const debris = Array.from({ length: 40 }).map(() => ({
      x: Math.random() * worldSize,
      y: Math.random() * worldSize,
      active: true,
      rot: Math.random() * Math.PI * 2
    }));

    // Satellites
    const satellites = Array.from({ length: 5 }).map(() => ({
      x: Math.random() * worldSize,
      y: Math.random() * worldSize,
      vx: (Math.random() - 0.5) * 2,
      vy: (Math.random() - 0.5) * 2,
    }));

    let animId: number;
    let lastTime = performance.now();
    let isInputting = false;
    let inputDX = 0;
    let inputDY = 0;
    
    // Joystick visual state
    let touchStartX = 0;
    let touchStartY = 0;
    let touchCurrentX = 0;
    let touchCurrentY = 0;

    const render = (time: number) => {
      const dt = Math.min((time - lastTime) / 16, 2);
      lastTime = time;

      const rect = canvas.getBoundingClientRect();
      if (canvas.width !== rect.width || canvas.height !== rect.height) {
        canvas.width = rect.width;
        canvas.height = rect.height;
      }

      // Clear
      ctx.fillStyle = "#020202";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (isInputting && fuel > 0) {
         vx += inputDX * 0.2 * dt; // Much draggier feeling
         vy += inputDY * 0.2 * dt;
         setFuel(f => Math.max(0, f - 0.2 * dt)); // Deplete fuel
      }

      // Inertia (friction 0 in space)
      // Camera follows Joop, so moving camera = moving Joop
      camX += vx * dt;
      camY += vy * dt;

      // Wrap around world
      if (camX < 0) camX = worldSize;
      if (camX > worldSize) camX = 0;
      if (camY < 0) camY = worldSize;
      if (camY > worldSize) camY = 0;

      const cx = canvas.width / 2;
      const cy = canvas.height / 2;

      // Draw Parallax Backgrounds
      // Moon at 1/2 speed
      const moonImg = imagesRef.current["/game/bg-moon.svg"];
      if (moonImg) {
        const mx = ((worldSize - camX) * 0.2) % canvas.width;
        const my = ((worldSize - camY) * 0.2) % canvas.height;
        ctx.globalAlpha = 0.5;
        ctx.drawImage(moonImg, mx, my, 200, 200);
        ctx.globalAlpha = 1.0;
      }

      // Sun at 1/5 speed
      const sunImg = imagesRef.current["/game/bg-sun.svg"];
      if (sunImg) {
        const sx = ((worldSize - camX) * 0.05 + 500) % canvas.width;
        const sy = ((worldSize - camY) * 0.05 + 100) % canvas.height;
        ctx.globalAlpha = 0.8;
        ctx.drawImage(sunImg, sx, sy, 300, 300);
        ctx.globalAlpha = 1.0;
      }

      // Helper to wrap coordinates around camera
      const wrapOffset = (val: number, cam: number, max: number) => {
        let diff = val - cam;
        if (diff > max / 2) diff -= max;
        if (diff < -max / 2) diff += max;
        return diff;
      };

      // Draw Satellites (moving obstacles/props)
      const satImg = imagesRef.current["/game/satellite.svg"];
      satellites.forEach(sat => {
        sat.x = (sat.x + sat.vx * dt + worldSize) % worldSize;
        sat.y = (sat.y + sat.vy * dt + worldSize) % worldSize;
        const screenX = cx + wrapOffset(sat.x, camX, worldSize);
        const screenY = cy + wrapOffset(sat.y, camY, worldSize);

        if (screenX > -100 && screenX < canvas.width + 100 && screenY > -100 && screenY < canvas.height + 100) {
          if (satImg) ctx.drawImage(satImg, screenX - 40, screenY - 40, 80, 80);
        }
      });

      // Draw Debris
      const debImg = imagesRef.current["/game/debris.svg"];
      let collected = 0;
      debris.forEach(d => {
        if (!d.active) return;
        d.rot += 0.01 * dt; // slow spin

        const screenX = cx + wrapOffset(d.x, camX, worldSize);
        const screenY = cy + wrapOffset(d.y, camY, worldSize);

        // Cull offscreen
        if (screenX > -50 && screenX < canvas.width + 50 && screenY > -50 && screenY < canvas.height + 50) {
          ctx.save();
          ctx.translate(screenX, screenY);
          ctx.rotate(d.rot);
          if (debImg) ctx.drawImage(debImg, -15, -15, 30, 30);
          else { ctx.fillStyle = "#a1a1aa"; ctx.beginPath(); ctx.arc(0,0,10,0,Math.PI*2); ctx.fill(); }
          ctx.restore();

          // Collision detection (Joop is always at cx, cy)
          const dist = Math.hypot(screenX - cx, screenY - cy);
          if (dist < 30) {
            d.active = false;
            collected++;
          }
        }
      });

      if (collected > 0) setScore(s => s + collected * 10);

      // Draw Joop at center
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(Math.atan2(vy, vx)); // point towards velocity
      const joopImg = imagesRef.current["/game/joop.svg"];
      if (joopImg) {
        ctx.drawImage(joopImg, -20, -20, 40, 40);
        // Thrust exhaust
        if (isInputting && fuel > 0) {
           ctx.fillStyle = "#00ffff";
           ctx.globalAlpha = 0.8 + Math.random()*0.2;
           ctx.beginPath(); ctx.arc(-25, 0, 6, 0, Math.PI*2); ctx.fill();
        }
      }
      ctx.restore();

      // Draw Virtual 5-circle Joystick
      if (isInputting) {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
        ctx.lineWidth = 2;
        // Outer bounds
        ctx.beginPath(); ctx.arc(touchStartX, touchStartY, 40, 0, Math.PI*2); ctx.stroke();
        // Inner directions (4 circles)
        const d = 25;
        ctx.beginPath(); ctx.arc(touchStartX, touchStartY - d, 5, 0, Math.PI*2); ctx.stroke();
        ctx.beginPath(); ctx.arc(touchStartX, touchStartY + d, 5, 0, Math.PI*2); ctx.stroke();
        ctx.beginPath(); ctx.arc(touchStartX - d, touchStartY, 5, 0, Math.PI*2); ctx.stroke();
        ctx.beginPath(); ctx.arc(touchStartX + d, touchStartY, 5, 0, Math.PI*2); ctx.stroke();
        // Current knob
        ctx.fillStyle = "rgba(57, 255, 20, 0.6)";
        ctx.beginPath(); ctx.arc(touchCurrentX, touchCurrentY, 15, 0, Math.PI*2); ctx.fill();
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    const getCanvasPos = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      return { x: clientX - rect.left, y: clientY - rect.top };
    };

    const handlePointerDown = (e: PointerEvent) => {
      isInputting = true;
      const pos = getCanvasPos(e.clientX, e.clientY);
      touchStartX = pos.x;
      touchStartY = pos.y;
      touchCurrentX = pos.x;
      touchCurrentY = pos.y;
      inputDX = 0; inputDY = 0;
    };
    const handlePointerMove = (e: PointerEvent) => {
      if (isInputting) {
        const pos = getCanvasPos(e.clientX, e.clientY);
        // Clamp knob to 40px radius
        const dx = pos.x - touchStartX;
        const dy = pos.y - touchStartY;
        const dist = Math.hypot(dx, dy);
        if (dist > 40) {
          touchCurrentX = touchStartX + (dx / dist) * 40;
          touchCurrentY = touchStartY + (dy / dist) * 40;
        } else {
          touchCurrentX = pos.x;
          touchCurrentY = pos.y;
        }
        
        // Normalized input vector (-1 to 1)
        inputDX = (touchCurrentX - touchStartX) / 40;
        inputDY = (touchCurrentY - touchStartY) / 40;
      }
    };
    const handlePointerUp = () => {
      isInputting = false;
      inputDX = 0;
      inputDY = 0;
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, []);

  return (
    <div className="flex flex-col h-screen w-full bg-black relative overflow-hidden text-white max-w-md mx-auto select-none touch-none">
      <header className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-10 pointer-events-none">
        <div className="flex flex-col gap-2">
          <div className="font-display text-2xl text-primary crt-glow-primary">SCRAP: {score}</div>
          <span className="font-mono text-xs text-muted bg-black/50 px-2 py-1 rounded">MANUAL OVERRIDE: ON</span>
        </div>
        
        <div className="flex flex-col items-end pointer-events-auto">
          <button onClick={() => router.push("/space")} className="p-2 bg-surface/80 rounded border border-muted mb-2 active:bg-primary/20">
            <Image src="/ui/icon-back.svg" alt="Back" width={24} height={24} />
          </button>
          <span className="font-mono text-xs text-muted">H₂ / O₂ FUEL</span>
          <div className="w-32 h-4 bg-surface border border-muted/50 p-[1px]">
            <div className={`h-full transition-all duration-300 ${fuel > 20 ? 'bg-secondary' : 'bg-danger animate-pulse'}`} style={{ width: `${Math.max(0, fuel)}%` }} />
          </div>
        </div>
      </header>

      <canvas 
        ref={canvasRef} 
        className="w-full h-full"
      />

      {/* Screen edge vignette to simulate visor */}
      <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_80px_rgba(0,0,0,0.9)] z-0"></div>

      {fuel <= 0 && (
        <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center z-20 gap-6 backdrop-blur-sm">
          <Image src="/ui/icon-close.svg" alt="Warning" width={48} height={48} className="text-danger animate-pulse filter drop-shadow-[0_0_10px_red]" />
          <h2 className="font-display text-4xl text-danger tracking-widest text-center">OUT OF FUEL</h2>
          <div className="font-mono text-center text-muted text-sm border border-danger/30 p-4 bg-danger/10">
            <p>AUTOPILOT ENGAGED.</p>
            <p className="mt-2 text-white">COLLECTED: {score} SCRAP</p>
          </div>
          <button onClick={() => router.push("/space")} className="bg-surface border-2 border-danger text-danger px-8 py-4 font-mono text-lg mt-4 active:bg-danger active:text-black">
            RETURN TO ORBITAL MAP
          </button>
        </div>
      )}
    </div>
  );
}
