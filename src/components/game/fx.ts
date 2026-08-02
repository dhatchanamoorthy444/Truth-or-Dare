/** Canvas confetti + fireworks, plus sound effects and haptics. */

type P = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
  shape: "rect" | "dot";
};

const COLORS = ["#ff3ea5", "#22d3ee", "#a855f7", "#fbbf24", "#34d399", "#f43f5e"];

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let parts: P[] = [];
let raf = 0;

function ensureCanvas() {
  if (typeof document === "undefined") return null;
  if (canvas) return canvas;
  canvas = document.createElement("canvas");
  canvas.style.cssText =
    "position:fixed;inset:0;pointer-events:none;z-index:80;width:100%;height:100%";
  document.body.appendChild(canvas);
  ctx = canvas.getContext("2d");
  const resize = () => {
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  };
  resize();
  window.addEventListener("resize", resize);
  return canvas;
}

function loop() {
  if (!canvas || !ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  parts = parts.filter((p) => p.life > 0);
  parts.forEach((p) => {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.14;
    p.vx *= 0.99;
    p.life -= 1;
    ctx!.globalAlpha = Math.max(0, Math.min(1, p.life / 60));
    ctx!.fillStyle = p.color;
    if (p.shape === "rect") {
      ctx!.fillRect(p.x, p.y, p.size, p.size * 1.8);
    } else {
      ctx!.beginPath();
      ctx!.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
      ctx!.fill();
    }
  });
  ctx.globalAlpha = 1;
  if (parts.length) {
    raf = requestAnimationFrame(loop);
  } else {
    cancelAnimationFrame(raf);
    raf = 0;
  }
}

function start() {
  if (!raf) raf = requestAnimationFrame(loop);
}

export function confetti(count = 120) {
  if (!ensureCanvas() || !canvas) return;
  const w = canvas.width;
  for (let i = 0; i < count; i++) {
    parts.push({
      x: Math.random() * w,
      y: -20 - Math.random() * 120,
      vx: (Math.random() - 0.5) * 4,
      vy: 2 + Math.random() * 4,
      life: 90 + Math.random() * 60,
      color: COLORS[Math.floor(Math.random() * COLORS.length)]!,
      size: 4 + Math.random() * 5,
      shape: Math.random() > 0.4 ? "rect" : "dot",
    });
  }
  start();
}

export function fireworks(bursts = 4) {
  if (!ensureCanvas() || !canvas) return;
  const w = canvas.width;
  const h = canvas.height;
  for (let b = 0; b < bursts; b++) {
    setTimeout(() => {
      const cx = w * (0.2 + Math.random() * 0.6);
      const cy = h * (0.15 + Math.random() * 0.35);
      const color = COLORS[Math.floor(Math.random() * COLORS.length)]!;
      for (let i = 0; i < 70; i++) {
        const a = (Math.PI * 2 * i) / 70;
        const sp = 2 + Math.random() * 5;
        parts.push({
          x: cx,
          y: cy,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp - 1,
          life: 60 + Math.random() * 40,
          color,
          size: 3 + Math.random() * 3,
          shape: "dot",
        });
      }
      start();
    }, b * 260);
  }
}

/* ---------------- Sound + haptics ---------------- */
let audioCtx: AudioContext | null = null;

function getCtx() {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;
    audioCtx = new Ctor();
  }
  return audioCtx;
}

type SfxName = "tap" | "flip" | "win" | "skip" | "spin";

const TONES: Record<SfxName, { f: number[]; type: OscillatorType; dur: number }> = {
  tap: { f: [520], type: "triangle", dur: 0.08 },
  flip: { f: [420, 660], type: "sine", dur: 0.14 },
  win: { f: [523, 659, 784, 1047], type: "sine", dur: 0.12 },
  skip: { f: [320, 200], type: "sawtooth", dur: 0.12 },
  spin: { f: [300, 420, 300, 480], type: "square", dur: 0.07 },
};

export function sfx(name: SfxName, enabled = true) {
  if (!enabled) return;
  const ac = getCtx();
  if (!ac) return;
  if (ac.state === "suspended") void ac.resume();
  const spec = TONES[name];
  spec.f.forEach((freq, i) => {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = spec.type;
    osc.frequency.value = freq;
    const t = ac.currentTime + i * spec.dur;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.14, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + spec.dur);
    osc.connect(gain).connect(ac.destination);
    osc.start(t);
    osc.stop(t + spec.dur + 0.02);
  });
}

export function vibrate(pattern: number | number[], enabled = true) {
  if (!enabled || typeof navigator === "undefined" || !("vibrate" in navigator))
    return;
  navigator.vibrate(pattern);
}

/* Ambient background music: a soft looping arpeggio (no asset downloads). */
let musicNodes: { osc: OscillatorNode; gain: GainNode; timer: number } | null = null;

export function toggleMusic(on: boolean) {
  const ac = getCtx();
  if (!ac) return;
  if (!on) {
    if (musicNodes) {
      clearInterval(musicNodes.timer);
      musicNodes.gain.gain.setTargetAtTime(0, ac.currentTime, 0.2);
      musicNodes.osc.stop(ac.currentTime + 1);
      musicNodes = null;
    }
    return;
  }
  if (musicNodes) return;
  if (ac.state === "suspended") void ac.resume();
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = "sine";
  gain.gain.value = 0.03;
  osc.connect(gain).connect(ac.destination);
  osc.start();
  const notes = [220, 277, 330, 415, 330, 277];
  let i = 0;
  const timer = window.setInterval(() => {
    osc.frequency.setTargetAtTime(notes[i % notes.length]!, ac.currentTime, 0.08);
    i++;
  }, 700);
  musicNodes = { osc, gain, timer };
}