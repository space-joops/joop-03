// 게임 사운드 엔진 — WebAudio 실시간 합성. **오디오 파일 0개**(네트워크로 음원을
// 들여올 수 없는 환경이고, 카세트퓨처리즘 톤과도 맞는다). 무의존 모듈.
//
// 설계의 핵심: **음소거는 이 파일 안에서 강제한다**(play 계열 진입점의 early-return).
// 게임 루프는 sfx.xxx() 를 조건 없이 호출하고 뮤트 상태를 읽지 않는다 →
//   ① 게임 컴포넌트의 effect deps 가 하나도 늘지 않는다(rAF 루프 재시작 함정 회피)
//   ② "뮤트 시 오실레이터 생성 0" 이라는 검증 가능한 지표가 생긴다.
//
// AudioContext 는 모듈 싱글턴이다. 발사 화면은 자체 사용자 제스처가 없어서
// 직전 화면(대시보드 버튼)의 클릭으로 언락된 컨텍스트를 물려받아야 한다.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
let muted = false;

const MASTER_GAIN = 0.32;
/** 동시 재생 상한 — 16× 배속에서 이벤트가 몰려도 클리핑되지 않게. */
const MAX_VOICES = 8;
let voices = 0;

/** 연타 억제 게이트: id → 마지막 재생 시각(ctx.currentTime) */
const gates = new Map<string, number>();
/** 루프 핸들 — 뮤트·언마운트 시 일괄 정지 */
const loops = new Map<string, { stop: () => void; gain: GainNode; extra?: BiquadFilterNode }>();

function ensure(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  const AC: typeof AudioContext | undefined =
    window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : MASTER_GAIN;
  master.connect(ctx.destination);
  // 전역 화이트노이즈 버퍼 1개를 모든 노이즈 소스가 공유한다(생성 비용 절감).
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return ctx;
}

/**
 * 사용자 제스처 안에서 호출 — resume + 1샘플 무음 재생(iOS 언락 의식).
 * 뮤트 상태라도 컨텍스트는 열어둔다(토글을 켰을 때 즉시 소리가 나야 한다).
 */
export function unlockAudio(): void {
  const c = ensure();
  if (!c) return;
  if (c.state === "suspended") void c.resume();
  try {
    const s = c.createBufferSource();
    s.buffer = c.createBuffer(1, 1, c.sampleRate);
    s.connect(c.destination);
    s.start(0);
  } catch {
    /* 언락 실패는 무시 — 다음 제스처에서 재시도된다 */
  }
}

let autoUnlockInstalled = false;
/** 문서 최초 포인터다운 1회로 언락(3중 방어의 1선 — 버튼·토글이 2·3선). */
export function installAutoUnlock(): void {
  if (autoUnlockInstalled || typeof document === "undefined") return;
  autoUnlockInstalled = true;
  document.addEventListener("pointerdown", () => unlockAudio(), { once: true, capture: true });
}

export function isMuted(): boolean {
  return muted;
}

/** 음소거 전환 — 0.02초 램프로 클릭 노이즈를 없애고, 켜질 때 루프를 모두 끊는다. */
export function setMuted(next: boolean): void {
  muted = next;
  if (!ctx || !master) return;
  const t = ctx.currentTime;
  master.gain.cancelScheduledValues(t);
  master.gain.setValueAtTime(master.gain.value, t);
  master.gain.linearRampToValueAtTime(next ? 0 : MASTER_GAIN, t + 0.02);
  if (next) stopAll();
}

/** 모든 루프 정지 — 화면 이탈(cleanup)·게임오버·뮤트 시 호출. */
export function stopAll(): void {
  for (const [, h] of loops) h.stop();
  loops.clear();
}

/** 재생 가능 여부 + 보이스 확보. 뮤트면 여기서 끊긴다(오실레이터 생성 0). */
function take(): AudioContext | null {
  if (muted) return null;
  const c = ensure();
  if (!c || !master) return null;
  if (c.state === "suspended") void c.resume();
  if (voices >= MAX_VOICES) return null;
  voices += 1;
  return c;
}

const release = () => {
  voices = Math.max(0, voices - 1);
};

/** 같은 id 를 minGap 초 안에 다시 울리지 않게(연타·16× 배속 대비). */
function gate(id: string, minGap: number): boolean {
  const c = ensure();
  if (!c) return false;
  const last = gates.get(id) ?? -Infinity;
  if (c.currentTime - last < minGap) return false;
  gates.set(id, c.currentTime);
  return true;
}

// ── 프리미티브 ──────────────────────────────────────────────────────────────

type BlipOpts = {
  f0: number;
  /** 없으면 f0 유지 */
  f1?: number;
  dur?: number;
  type?: OscillatorType;
  gain?: number;
  /** 어택 비율(0~1) */
  attack?: number;
  delay?: number;
};

/** 오실레이터 1개 + 지수 감쇠 엔벨로프. 대부분의 효과음의 뼈대. */
export function blip({
  f0,
  f1,
  dur = 0.12,
  type = "square",
  gain = 0.5,
  attack = 0.06,
  delay = 0,
}: BlipOpts): void {
  const c = take();
  if (!c || !master) return;
  const t = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(f0, t);
  if (f1 != null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + dur * attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.02);
  osc.onended = release;
}

/** 노이즈 + Biquad 주파수 스윕 — 폭발·분사·피격의 재료. */
export function sweepNoise({
  dur = 0.3,
  f0 = 2400,
  f1 = 320,
  gain = 0.4,
  type = "bandpass",
  q = 1.2,
  delay = 0,
}: {
  dur?: number;
  f0?: number;
  f1?: number;
  gain?: number;
  type?: BiquadFilterType;
  q?: number;
  delay?: number;
} = {}): void {
  const c = take();
  if (!c || !master || !noiseBuf) return;
  const t = c.currentTime + delay;
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  const flt = c.createBiquadFilter();
  flt.type = type;
  flt.Q.value = q;
  flt.frequency.setValueAtTime(f0, t);
  flt.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + dur * 0.08);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(flt).connect(g).connect(master);
  src.start(t);
  src.stop(t + dur + 0.02);
  src.onended = release;
}

/** 음 3~4개 아르페지오 — 시작·승리·징글용. */
export function arp(freqs: number[], step = 0.08, opts: Partial<BlipOpts> = {}): void {
  freqs.forEach((f, i) => blip({ f0: f, dur: step * 1.6, gain: 0.35, ...opts, delay: i * step }));
}

/** 지속 노이즈 루프(분사·럼블). 같은 id 로 다시 부르면 무시된다. */
function noiseLoop(id: string, f: number, q: number, gain: number, type: BiquadFilterType): void {
  if (muted || loops.has(id)) return;
  const c = ensure();
  if (!c || !master || !noiseBuf) return;
  if (c.state === "suspended") void c.resume();
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const flt = c.createBiquadFilter();
  flt.type = type;
  flt.frequency.value = f;
  flt.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, c.currentTime);
  g.gain.linearRampToValueAtTime(gain, c.currentTime + 0.08);
  src.connect(flt).connect(g).connect(master);
  src.start();
  loops.set(id, {
    gain: g,
    extra: flt,
    stop: () => {
      const t = c.currentTime;
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.linearRampToValueAtTime(0.0001, t + 0.08);
      try {
        src.stop(t + 0.12);
      } catch {
        /* 이미 정지 */
      }
    },
  });
}

/** 디튠 2오실 + LFO 트레몰로 루프(엔진·자석 같은 "기계음"). */
function toneLoop(id: string, f: number, detune: number, lfoHz: number, gain: number, type: OscillatorType): void {
  if (muted || loops.has(id)) return;
  const c = ensure();
  if (!c || !master) return;
  if (c.state === "suspended") void c.resume();
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, c.currentTime);
  g.gain.linearRampToValueAtTime(gain, c.currentTime + 0.1);
  const oscs = [0, detune].map((d) => {
    const o = c.createOscillator();
    o.type = type;
    o.frequency.value = f;
    o.detune.value = d;
    o.connect(g);
    o.start();
    return o;
  });
  const lfo = c.createOscillator();
  const lfoGain = c.createGain();
  lfo.frequency.value = lfoHz;
  lfoGain.gain.value = gain * 0.45;
  lfo.connect(lfoGain).connect(g.gain);
  lfo.start();
  g.connect(master);
  loops.set(id, {
    gain: g,
    stop: () => {
      const t = c.currentTime;
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.linearRampToValueAtTime(0.0001, t + 0.1);
      for (const o of [...oscs, lfo]) {
        try {
          o.stop(t + 0.14);
        } catch {
          /* 이미 정지 */
        }
      }
    },
  });
}

function stopLoop(id: string): void {
  const h = loops.get(id);
  if (!h) return;
  h.stop();
  loops.delete(id);
}

/** 루프의 세기(0~1)를 실시간 조절 — 분사 강도 같은 연속값. */
function tuneLoop(id: string, gain: number, freq?: number): void {
  const h = loops.get(id);
  if (!h || !ctx) return;
  const t = ctx.currentTime;
  h.gain.gain.cancelScheduledValues(t);
  h.gain.gain.linearRampToValueAtTime(Math.max(0.0001, gain), t + 0.06);
  if (freq != null && h.extra) h.extra.frequency.linearRampToValueAtTime(freq, t + 0.06);
}

// ── 카탈로그: 지상 훈련 ─────────────────────────────────────────────────────

/** 수거 — 연속 수거(streak)마다 반음씩 올라간다. */
export function gndCollect(streak: number): void {
  const step = Math.min(7, streak);
  blip({ f0: 660 * Math.pow(2, step / 12), f1: 990 * Math.pow(2, step / 12), dur: 0.1, gain: 0.4 });
}
export function gndHit(): void {
  if (!gate("gndHit", 0.12)) return;
  blip({ f0: 180, f1: 60, dur: 0.28, type: "sawtooth", gain: 0.45 });
  sweepNoise({ dur: 0.22, f0: 900, f1: 120, gain: 0.3 });
}
export function gndMiss(): void {
  if (!gate("gndMiss", 0.12)) return;
  blip({ f0: 300, f1: 190, dur: 0.14, type: "triangle", gain: 0.28 });
}
/** 남은 10초 경고 틱 — 정수 초가 바뀔 때마다. */
export function gndWarnTick(): void {
  if (!gate("gndWarn", 0.4)) return;
  blip({ f0: 880, dur: 0.07, type: "square", gain: 0.3 });
}
export function gndStart(): void {
  arp([392, 523, 659], 0.09, { type: "triangle" });
}
export function gndWin(): void {
  arp([523, 659, 784, 1047], 0.1, { type: "triangle", gain: 0.4 });
}
export function gndLose(): void {
  arp([392, 330, 262], 0.12, { type: "sawtooth", gain: 0.3 });
}
export function gndSaved(): void {
  blip({ f0: 784, f1: 1175, dur: 0.16, type: "sine", gain: 0.32 });
}

// ── 카탈로그: 아케이드 ──────────────────────────────────────────────────────

/** 수거 — 4음 순환(단조로움 방지). */
export function arcCollect(n: number): void {
  const scale = [523, 659, 784, 988];
  blip({ f0: scale[n % 4], f1: scale[n % 4] * 1.5, dur: 0.1, gain: 0.38 });
}
export function arcFuel(): void {
  blip({ f0: 440, f1: 880, dur: 0.18, type: "triangle", gain: 0.34 });
}
/** 분사 루프 — strength(0~1)로 필터·게인을 실시간 조절. */
export function arcThrust(strength: number): void {
  noiseLoop("thrust", 700, 0.9, 0.14, "lowpass");
  tuneLoop("thrust", 0.06 + strength * 0.16, 420 + strength * 900);
}
export function arcThrustStop(): void {
  stopLoop("thrust");
}
/** 자석 팔 루프 — LFO 가 도는 "웅~" */
export function arcMagnet(): void {
  toneLoop("magnet", 220, 9, 5.5, 0.07, "sine");
}
export function arcMagnetStop(): void {
  stopLoop("magnet");
}
export function arcFuelWarn(): void {
  if (!gate("arcFuelWarn", 1.2)) return;
  blip({ f0: 330, f1: 220, dur: 0.2, type: "square", gain: 0.3 });
}
export function arcOver(): void {
  stopLoop("thrust");
  stopLoop("magnet");
  arp([440, 349, 262], 0.13, { type: "sawtooth", gain: 0.32 });
}

// ── 카탈로그: 발사 ──────────────────────────────────────────────────────────

export function lnchCountdown(n: number): void {
  blip({ f0: 520 + (3 - Math.min(3, n)) * 90, dur: 0.09, type: "square", gain: 0.34 });
}
export function lnchLiftoff(): void {
  sweepNoise({ dur: 1.6, f0: 220, f1: 70, gain: 0.5, type: "lowpass", q: 0.7 });
  blip({ f0: 90, f1: 42, dur: 1.4, type: "sawtooth", gain: 0.3 });
}
/** 엔진 루프 — 1단은 낮고 거친 럼블, 2단은 높고 얇은 진공 엔진. */
export function lnchEngine(second: boolean): void {
  const id = second ? "eng2" : "eng1";
  if (loops.has(id)) return;
  stopLoop(second ? "eng1" : "eng2");
  noiseLoop(id, second ? 900 : 180, second ? 1.4 : 0.6, second ? 0.06 : 0.12, "lowpass");
}
export function lnchEngineStop(): void {
  stopLoop("eng1");
  stopLoop("eng2");
}
export function lnchMaxQ(): void {
  sweepNoise({ dur: 0.9, f0: 1400, f1: 300, gain: 0.34, type: "bandpass", q: 0.8 });
}
export function lnchMeco(): void {
  blip({ f0: 240, f1: 90, dur: 0.5, type: "sawtooth", gain: 0.32 });
}
export function lnchSeparation(): void {
  sweepNoise({ dur: 0.35, f0: 2600, f1: 400, gain: 0.38 });
  blip({ f0: 160, f1: 70, dur: 0.3, type: "square", gain: 0.24 });
}
export function lnchIgnition(): void {
  blip({ f0: 120, f1: 420, dur: 0.6, type: "sawtooth", gain: 0.3 });
}
export function lnchLanding(): void {
  sweepNoise({ dur: 0.7, f0: 500, f1: 90, gain: 0.34, type: "lowpass", q: 0.6 });
  blip({ f0: 300, f1: 150, dur: 0.25, type: "triangle", gain: 0.26, delay: 0.55 });
}
export function lnchSeco(): void {
  blip({ f0: 500, f1: 180, dur: 0.45, type: "triangle", gain: 0.28 });
}
export function lnchFairing(): void {
  sweepNoise({ dur: 0.45, f0: 3200, f1: 700, gain: 0.34, type: "highpass", q: 0.7 });
}
export function lnchCubesat(): void {
  blip({ f0: 700, f1: 380, dur: 0.18, type: "square", gain: 0.3 });
  sweepNoise({ dur: 0.2, f0: 1800, f1: 600, gain: 0.22, delay: 0.02 });
}
/**
 * "삐링~" — 줍스가 큐브샛에서 나오는 순간(사용자 요구 그대로).
 * triangle 아르페지오 C6→F6→C7 에 square 를 겹쳐 밝기를 주고, 마지막 음에
 * 비브라토 꼬리를 붙여 ≈0.6초 동안 "삐-링~" 으로 들리게 한다.
 */
export function lnchDeployPing(): void {
  if (!gate("ping", 1)) return;
  const notes = [1046.5, 1396.9, 2093];
  notes.forEach((f, i) => {
    blip({ f0: f, dur: 0.2, type: "triangle", gain: 0.42, delay: i * 0.09 });
    blip({ f0: f, dur: 0.14, type: "square", gain: 0.14, delay: i * 0.09 });
  });
  const c = take();
  if (!c || !master) return;
  const t = c.currentTime + 0.27;
  const osc = c.createOscillator();
  const g = c.createGain();
  const lfo = c.createOscillator();
  const lfoGain = c.createGain();
  osc.type = "triangle";
  osc.frequency.value = 2093;
  lfo.frequency.value = 11;
  lfoGain.gain.value = 26; // 비브라토 폭(cent 아닌 Hz)
  lfo.connect(lfoGain).connect(osc.frequency);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.3, t + 0.03);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
  osc.connect(g).connect(master);
  osc.start(t);
  lfo.start(t);
  osc.stop(t + 0.36);
  lfo.stop(t + 0.36);
  osc.onended = release;
}
export function lnchOrbitJingle(): void {
  lnchEngineStop();
  arp([523, 659, 784, 1047, 1319], 0.11, { type: "triangle", gain: 0.4 });
}
