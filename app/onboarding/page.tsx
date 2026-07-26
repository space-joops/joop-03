"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({ code: "", name: "", color: "#39ff14" });

  const handleNext = () => {
    if (step === 1) setStep(2);
    else router.push("/ground");
  };

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground max-w-md mx-auto relative p-6">
      <header className="flex justify-between items-center mb-12 mt-8">
        <Image src="/brand/logo-wordmark.svg" alt="JOOPS" width={120} height={36} />
        <span className="font-mono text-muted text-sm">INIT_SEQ // 0{step}</span>
      </header>

      <main className="flex-1 flex flex-col gap-8">
        {step === 1 ? (
          <div className="panel-bezel p-6 flex flex-col gap-6">
            <h1 className="font-display text-2xl text-primary crt-glow-primary">ACCESS REQUIRED</h1>
            <p className="font-body text-sm text-muted">Enter your invite code to claim a Joop unit and join the orbital cleanup initiative.</p>
            
            <div className="flex flex-col gap-2">
              <label className="font-mono text-xs text-secondary">INVITE CODE</label>
              <input 
                type="text" 
                className="bg-black border-2 border-muted focus:border-primary text-primary font-mono p-3 outline-none uppercase"
                placeholder="XXXX-XXXX"
                value={formData.code}
                onChange={(e) => setFormData({...formData, code: e.target.value})}
              />
            </div>
          </div>
        ) : (
          <div className="panel-bezel p-6 flex flex-col gap-6">
            <h1 className="font-display text-2xl text-primary crt-glow-primary">CONFIGURE JOOP</h1>
            <p className="font-body text-sm text-muted">Initialize your robotic unit's parameters.</p>
            
            <div className="flex flex-col gap-2">
              <label className="font-mono text-xs text-secondary">UNIT ALIAS</label>
              <input 
                type="text" 
                className="bg-black border-2 border-muted focus:border-primary text-primary font-mono p-3 outline-none"
                placeholder="e.g. Orbita-99"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="font-mono text-xs text-secondary">PRIMARY COLOR</label>
              <div className="flex gap-4">
                {["#39ff14", "#00ffff", "#ffb000", "#ff3333", "#ff00ff"].map(c => (
                  <button 
                    key={c}
                    className={`w-10 h-10 rounded-full border-2 ${formData.color === c ? 'border-white scale-110 shadow-[0_0_10px_currentColor]' : 'border-transparent'}`}
                    style={{ backgroundColor: c, color: c }}
                    onClick={() => setFormData({...formData, color: c})}
                  />
                ))}
              </div>
            </div>

            <div className="flex justify-center mt-4 bg-black/50 p-4 rounded-md border border-muted/30">
              <Image src="/game/joop.svg" alt="Preview" width={64} height={64} style={{ filter: `drop-shadow(0 0 10px ${formData.color})` }} />
            </div>
          </div>
        )}

        <button 
          onClick={handleNext}
          className="mt-auto relative bg-surface border-2 border-primary text-primary font-display text-lg py-4 px-6 rounded-sm uppercase tracking-widest active:bg-primary active:text-background crt-glow-primary"
        >
          {step === 1 ? 'VERIFY CODE' : 'INITIALIZE UNIT'}
        </button>
      </main>
    </div>
  );
}
