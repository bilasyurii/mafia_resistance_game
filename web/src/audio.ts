/**
 * Short beeps for timers, played with the Web Audio API so no audio asset
 * files are needed. Lazily creates the AudioContext on first use (browsers
 * require a user gesture first - every call site here is reached from a tap
 * handler, so that requirement is always satisfied).
 */

type AudioContextCtor = typeof AudioContext;

let ctx: AudioContext | null = null;

function getContext(): AudioContext | null {
  const Ctor: AudioContextCtor | undefined = window.AudioContext || (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

export type BeepKind = "clock" | "tick" | "final";

/** `clock` is the quiet per-second ticking sound; `tick` is the short beep used at each countdown checkpoint; `final` is the longer, higher-pitched beep played at 0 seconds or when all mission decisions are confirmed. */
export function playBeep(kind: BeepKind): void {
  try {
    const audioCtx = getContext();
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = kind === "clock" ? "square" : "sine";
    osc.frequency.value = kind === "final" ? 920 : kind === "clock" ? 1400 : 660;
    const duration = kind === "final" ? 0.55 : kind === "clock" ? 0.03 : 0.16;
    const peakGain = kind === "clock" ? 0.04 : 0.35;
    const now = audioCtx.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(peakGain, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  } catch {
    // Audio unavailable (headless test environment, autoplay policy, etc.) - never block gameplay on it.
  }
}
