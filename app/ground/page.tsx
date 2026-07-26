"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function GroundMinigamePage() {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [xp, setXp] = useState(0);
  const [level, setLevel] = useState(1);
  const xpNeeded = 100;

  // Images for rendering
  const joopImgRef = useRef<HTMLImageElement | null>(null);
  const debrisImgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const joop = new window.Image();
    joop.src = "/game/joop.svg";
    joop.onload = () => (joopImgRef.current = joop);

    const debris = new window.Image();
    debris.src = "/game/debris.svg";
    debris.onload = () => (debrisImgRef.current = debris);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let lastTime = performance.now();

    // Helper for random pos
    const getRandomPos = () => {
      const cw = canvasRef.current?.clientWidth || window.innerWidth;
      const ch = canvasRef.current?.clientHeight || window.innerHeight;
      return {
        x: Math.random() * (cw - 40) + 20,
        y: Math.random() * (ch - 200) + 100,
      };
    };

    // Game state
    const state = {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
      vx: 0,
      vy: 0,
      debris: Array.from({ length: 5 }).map(() => ({
        ...getRandomPos(),
        active: true,
        scale: 1,
      })),
      particles: [] as {x: number, y: number, vx: number, vy: number, life: number}[],
      inputX: 0,
      inputY: 0,
      isInputting: false,
      currentXp: 0,
    };

    const spawnDebris = () => {
      state.debris.push({
        ...getRandomPos(),
        active: true,
        scale: 0, // for pop-in animation
      });
    };

    const spawnParticles = (x: number, y: number) => {
      for (let i = 0; i < 5; i++) {
        state.particles.push({
          x, y,
          vx: (Math.random() - 0.5) * 10,
          vy: (Math.random() - 0.5) * 10,
          life: 1.0,
        });
      }
    };

    const render = (time: number) => {
      const dt = Math.min((time - lastTime) / 16, 2); // cap dt
      lastTime = time;

      const rect = canvas.getBoundingClientRect();

      // Ensure canvas matches element size, not full window
      if (canvas.width !== rect.width || canvas.height !== rect.height) {
        canvas.width = rect.width;
        canvas.height = rect.height;
      }

      // Draw background (training room grid)
      ctx.fillStyle = "#09090b";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      ctx.strokeStyle = "rgba(57, 255, 20, 0.1)";
      ctx.lineWidth = 1;
      const gridSize = 40;
      for(let i = 0; i < canvas.width; i += gridSize) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke();
      }
      for(let i = 0; i < canvas.height; i += gridSize) {
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(canvas.width, i); ctx.stroke();
      }

      // Stop updating physics if level 2 is reached
      if (state.currentXp < xpNeeded) {
        // Physics
        const thrust = 0.8;
        const friction = 0.92; // Ground has friction (unlike space)

        if (state.isInputting) {
          state.vx += state.inputX * thrust * dt;
          state.vy += state.inputY * thrust * dt;
          
          // Exhaust particles
          if (Math.random() > 0.5) {
            state.particles.push({
              x: state.x - state.inputX * 10,
              y: state.y - state.inputY * 10,
              vx: -state.inputX * 2 + (Math.random()-0.5)*2,
              vy: -state.inputY * 2 + (Math.random()-0.5)*2,
              life: 1.0,
            });
          }
        }

        state.vx *= Math.pow(friction, dt);
        state.vy *= Math.pow(friction, dt);

        state.x += state.vx * dt;
        state.y += state.vy * dt;

        // Boundaries
        const margin = 20;
        if (state.x < margin) { state.x = margin; state.vx *= -0.5; }
        if (state.x > canvas.width - margin) { state.x = canvas.width - margin; state.vx *= -0.5; }
        if (state.y < margin) { state.y = margin; state.vy *= -0.5; }
        if (state.y > canvas.height - margin) { state.y = canvas.height - margin; state.vy *= -0.5; }

        // Debris collision & animation
        let collectedCount = 0;
        state.debris.forEach(d => {
          if (!d.active) return;
          
          if (d.scale < 1) d.scale += 0.05 * dt;

          const dist = Math.hypot(d.x - state.x, d.y - state.y);
          if (dist < 30) {
            d.active = false;
            collectedCount++;
            spawnParticles(d.x, d.y);
          }
        });

        if (collectedCount > 0) {
          state.currentXp += collectedCount * 10;
          setXp(state.currentXp);
          if (state.currentXp >= xpNeeded) {
            setLevel(2);
          }
          // Spawn new ones to replace
          for(let i=0; i<collectedCount; i++) spawnDebris();
        }
      }

      // Draw Debris
      state.debris.forEach(d => {
        if (!d.active) return;
        ctx.save();
        ctx.translate(d.x, d.y);
        ctx.scale(d.scale, d.scale);
        if (debrisImgRef.current) {
          ctx.drawImage(debrisImgRef.current, -15, -15, 30, 30);
        } else {
          ctx.fillStyle = "#a1a1aa";
          ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI*2); ctx.fill();
        }
        ctx.restore();
      });

      // Draw Particles
      for (let i = state.particles.length - 1; i >= 0; i--) {
        const p = state.particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= 0.05 * dt;
        
        ctx.fillStyle = `rgba(57, 255, 20, ${p.life})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, 2, 0, Math.PI*2); ctx.fill();

        if (p.life <= 0) state.particles.splice(i, 1);
      }

      // Draw Joop
      ctx.save();
      ctx.translate(state.x, state.y);
      // Tilt based on velocity
      ctx.rotate((state.vx * 0.05));
      if (joopImgRef.current) {
        ctx.drawImage(joopImgRef.current, -20, -20, 40, 40);
      } else {
        ctx.fillStyle = "#39ff14";
        ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI*2); ctx.fill();
      }
      ctx.restore();

      // Input visualizer
      if (state.isInputting && state.currentXp < xpNeeded) {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
        ctx.beginPath();
        ctx.moveTo(state.x, state.y);
        ctx.lineTo(state.x + state.inputX * 50, state.y + state.inputY * 50);
        ctx.stroke();
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    const getCanvasPos = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: clientX - rect.left,
        y: clientY - rect.top
      };
    };

    const handlePointerDown = (e: PointerEvent) => {
      state.isInputting = true;
      const pos = getCanvasPos(e.clientX, e.clientY);
      updateInputDirection(pos.x, pos.y);
    };
    const handlePointerMove = (e: PointerEvent) => {
      if (state.isInputting) {
        const pos = getCanvasPos(e.clientX, e.clientY);
        updateInputDirection(pos.x, pos.y);
      }
    };
    const handlePointerUp = () => {
      state.isInputting = false;
      state.inputX = 0;
      state.inputY = 0;
    };

    const updateInputDirection = (tx: number, ty: number) => {
      const dx = tx - state.x;
      const dy = ty - state.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 5) {
        state.inputX = dx / dist;
        state.inputY = dy / dist;
      }
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
  }, [xpNeeded]);

  return (
    <div className="flex flex-col h-screen w-full bg-[#111] relative overflow-hidden text-white max-w-md mx-auto select-none touch-none">
      <header className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-10 bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
        <div className="flex flex-col">
          <span className="font-mono text-secondary text-sm">GROUND TRAINING FACILITY</span>
          <span className="font-mono text-xs text-muted">LEARN CONTROLS (FRICTION ENABLED)</span>
        </div>
        <span className="font-display text-2xl text-primary">LVL {level}</span>
      </header>

      <canvas 
        ref={canvasRef} 
        className="absolute inset-0 w-full h-full z-0"
      />

      {/* Progress UI */}
      <div className="absolute bottom-12 left-4 right-4 z-10 pointer-events-none">
        <div className="flex justify-between mb-2 font-mono text-sm">
          <span className="text-primary">XP</span>
          <span className="text-primary">{xp} / {xpNeeded}</span>
        </div>
        <div className="h-4 bg-black/50 border border-primary/50 rounded-full overflow-hidden backdrop-blur-sm">
          <div 
            className="h-full bg-primary transition-all duration-300" 
            style={{ width: `${Math.min(100, (xp / xpNeeded) * 100)}%`, boxShadow: "0 0 10px #39ff14" }}
          />
        </div>
        {level < 2 && (
          <p className="text-center font-mono text-xs mt-4 text-muted animate-pulse">DRAG TO MOVE • COLLECT DEBRIS</p>
        )}
      </div>

      {level >= 2 && (
        <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center z-20 backdrop-blur-sm">
          <h2 className="font-display text-4xl text-success mb-2 crt-glow-primary">TRAINING COMPLETE</h2>
          <p className="font-mono text-sm text-muted mb-8 text-center px-8">You have mastered basic Joop controls. You are now authorized for orbital deployment.</p>
          
          <button 
            onClick={() => router.push("/arcade")}
            className="bg-surface border-2 border-success text-success font-display text-2xl py-4 px-8 rounded-sm transition-transform active:scale-95 animate-pulse shadow-[0_0_20px_rgba(57,255,20,0.5)]"
          >
            LAUNCH TO ORBIT 🚀
          </button>
        </div>
      )}
    </div>
  );
}
