let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function unlockAudio() {
  ac();
}

type ToneOpts = {
  freq: number;
  to?: number;
  dur?: number;
  type?: OscillatorType;
  gain?: number;
  delay?: number;
};

function tone({ freq, to, dur = 0.12, type = "square", gain = 0.08, delay = 0 }: ToneOpts) {
  const a = ac();
  if (!a) return;
  const t0 = a.currentTime + delay;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(a.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise(dur = 0.2, gain = 0.06) {
  const a = ac();
  if (!a) return;
  const len = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = a.createBufferSource();
  const g = a.createGain();
  g.gain.value = gain;
  src.buffer = buf;
  src.connect(g).connect(a.destination);
  src.start();
}

export const sfx = {
  jump: () => tone({ freq: 320, to: 700, dur: 0.16, type: "square", gain: 0.07 }),
  coin: () => {
    tone({ freq: 988, dur: 0.06, type: "square", gain: 0.06 });
    tone({ freq: 1319, dur: 0.12, type: "square", gain: 0.06, delay: 0.06 });
  },
  stomp: () => tone({ freq: 220, to: 60, dur: 0.14, type: "sawtooth", gain: 0.08 }),
  powerup: () => {
    [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, dur: 0.1, type: "triangle", gain: 0.07, delay: i * 0.07 }));
  },
  block: () => noise(0.18, 0.07),
  bump: () => tone({ freq: 160, to: 110, dur: 0.08, type: "square", gain: 0.05 }),
  hurt: () => tone({ freq: 420, to: 90, dur: 0.35, type: "sawtooth", gain: 0.08 }),
  gameover: () => {
    [392, 330, 262, 196].forEach((f, i) => tone({ freq: f, dur: 0.28, type: "triangle", gain: 0.08, delay: i * 0.18 }));
  },
  win: () => {
    [523, 659, 784, 1047, 1319].forEach((f, i) => tone({ freq: f, dur: 0.2, type: "square", gain: 0.07, delay: i * 0.12 }));
  },
  throwA: () => tone({ freq: 700, to: 300, dur: 0.1, type: "triangle", gain: 0.05 }),
};
