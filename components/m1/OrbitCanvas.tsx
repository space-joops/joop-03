"use client";

import { useEffect, useRef, useState } from "react";
import { calculatePosition, generateMockSnapshot, OrbitalSnapshot } from "@/lib/orbit";

export default function OrbitCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [snapshot, setSnapshot] = useState<OrbitalSnapshot | null>(null);

  // Fetch or generate snapshot on mount
  useEffect(() => {
    // In a real app, this would be a fetch to /api/orbital
    setSnapshot(generateMockSnapshot());
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !snapshot) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Handle high DPI displays
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    let animationFrameId: number;

    const render = () => {
      ctx.clearRect(0, 0, rect.width, rect.height);

      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const earthRadius = Math.min(rect.width, rect.height) * 0.25;

      // --- Draw Wireframe Globe (Earth) ---
      ctx.strokeStyle = "rgba(26, 77, 46, 0.8)"; // --grid color
      ctx.lineWidth = 1;
      
      // Outline
      ctx.beginPath();
      ctx.arc(centerX, centerY, earthRadius, 0, Math.PI * 2);
      ctx.stroke();

      // Lat/Lng lines
      for (let i = 1; i <= 3; i++) {
        ctx.beginPath();
        ctx.ellipse(centerX, centerY, earthRadius, earthRadius * (i / 4), 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(centerX, centerY, earthRadius * (i / 4), earthRadius, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      // --- Draw Joops ---
      const currentTime = Date.now();
      const elapsedTimeMs = currentTime - snapshot.serverTime;

      // Sort by Z to draw distant ones first
      const positions = snapshot.joops.map(joop => {
        const pos = calculatePosition(joop.orbit, elapsedTimeMs, earthRadius);
        return { joop, pos };
      });
      positions.sort((a, b) => a.pos.z - b.pos.z);

      positions.forEach(({ joop, pos }) => {
        const dotX = centerX + pos.x;
        const dotY = centerY + pos.y;
        
        // Depth cueing: smaller and dimmer if behind Earth
        const isBehind = pos.z < 0;
        const alpha = isBehind ? 0.3 : 1.0;
        const size = isBehind ? 2 : 3;

        ctx.beginPath();
        ctx.arc(dotX, dotY, size, 0, Math.PI * 2);
        ctx.fillStyle = joop.color;
        
        // Apply alpha to fillStyle
        ctx.globalAlpha = alpha;
        ctx.fill();
        
        // Glow effect only for foreground
        if (!isBehind) {
          ctx.shadowBlur = 8;
          ctx.shadowColor = joop.color;
          ctx.fill(); // Fill again with shadow
          ctx.shadowBlur = 0; // Reset
        }
      });
      ctx.globalAlpha = 1.0; // Reset alpha

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [snapshot]);

  return (
    <div className="relative w-full aspect-square flex items-center justify-center overflow-hidden my-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-surface/50 to-transparent pointer-events-none"></div>
      <canvas
        ref={canvasRef}
        className="w-full h-full z-10"
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
}
