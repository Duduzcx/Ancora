"use client";

// Sons para acalmar e dormir: ondas do mar, chuva, ruído branco e ruído marrom.
// Gerados no próprio celular (Web Audio), sem baixar arquivos: funcionam sem internet
// e não pesam no app. Continuam tocando ao trocar de tela; param sozinhos no timer.

import { useSyncExternalStore } from 'react';

export type SoundId = 'mar' | 'chuva' | 'branco' | 'marrom';
export const SOUNDS: { id: SoundId; label: string; hint: string }[] = [
  { id: 'mar', label: 'Ondas do mar', hint: 'Vai e vem lento das ondas' },
  { id: 'chuva', label: 'Chuva', hint: 'Chuva constante na janela' },
  { id: 'branco', label: 'Ruído branco', hint: 'Abafa barulhos de fora' },
  { id: 'marrom', label: 'Ruído marrom', hint: 'Grave e profundo, para dormir' },
];

type State = { playing: SoundId | null; volume: number; endsAt: number | null };
let state: State = { playing: null, volume: 0.6, endsAt: null };
const listeners = new Set<() => void>();
const set = (next: Partial<State>) => { state = { ...state, ...next }; listeners.forEach((l) => l()); };

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let nodes: AudioNode[] = [];
let stopTimer: ReturnType<typeof setTimeout> | null = null;
const buffers: Partial<Record<'white' | 'pink' | 'brown', AudioBuffer>> = {};

function audio(): AudioContext {
  if (!ctx) {
    const AC = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
  }
  return ctx;
}

function noise(kind: 'white' | 'pink' | 'brown'): AudioBuffer {
  if (buffers[kind]) return buffers[kind]!;
  const c = audio();
  const len = c.sampleRate * 6;
  const buf = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'white') d[i] = w * 0.5;
      else if (kind === 'pink') {
        // Paul Kellet: ruído rosa (mais suave que o branco)
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      } else {
        last = (last + 0.02 * w) / 1.02; // ruído marrom (grave)
        d[i] = last * 3.5;
      }
    }
    // Emenda suave no fim do loop
    const fade = Math.floor(c.sampleRate * 0.05);
    for (let i = 0; i < fade; i++) { d[i] *= i / fade; d[len - 1 - i] *= i / fade; }
  }
  buffers[kind] = buf;
  return buf;
}

function source(kind: 'white' | 'pink' | 'brown') {
  const s = audio().createBufferSource();
  s.buffer = noise(kind);
  s.loop = true;
  s.loopStart = Math.random() * 2;
  return s;
}

/** Oscilador bem lento que faz o volume subir e descer (como uma onda). */
function swell(target: AudioParam, base: number, depth: number, hz: number) {
  const c = audio();
  const lfo = c.createOscillator();
  lfo.frequency.value = hz;
  const amount = c.createGain();
  amount.gain.value = depth;
  target.value = base;
  lfo.connect(amount).connect(target);
  lfo.start();
  return [lfo, amount];
}

function build(id: SoundId): AudioNode[] {
  const c = audio();
  const out = master!;
  const made: AudioNode[] = [];
  const chain = (src: AudioBufferSourceNode, filters: BiquadFilterNode[], gain: GainNode) => {
    let node: AudioNode = src;
    for (const f of filters) { node.connect(f); node = f; }
    node.connect(gain).connect(out);
    src.start();
    made.push(src, ...filters, gain);
  };
  const filter = (type: BiquadFilterType, freq: number, q = 0.7) => {
    const f = c.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    return f;
  };

  if (id === 'mar') {
    // Corpo da onda (grave) + espuma (agudo), com vai e vem em ritmos diferentes.
    const body = c.createGain();
    const lp = filter('lowpass', 520);
    chain(source('brown'), [lp], body);
    made.push(...swell(body.gain, 0.55, 0.45, 0.085));
    made.push(...swell(lp.frequency, 520, 260, 0.085));
    const foam = c.createGain();
    chain(source('pink'), [filter('highpass', 900), filter('lowpass', 5200)], foam);
    made.push(...swell(foam.gain, 0.16, 0.15, 0.085));
    const far = c.createGain();
    chain(source('brown'), [filter('lowpass', 260)], far);
    made.push(...swell(far.gain, 0.35, 0.2, 0.05));
  } else if (id === 'chuva') {
    const rain = c.createGain();
    rain.gain.value = 0.55;
    chain(source('pink'), [filter('highpass', 600), filter('lowpass', 7000)], rain);
    const roof = c.createGain();
    roof.gain.value = 0.25;
    chain(source('brown'), [filter('lowpass', 400)], roof);
  } else if (id === 'branco') {
    const g = c.createGain();
    g.gain.value = 0.35;
    chain(source('white'), [filter('lowpass', 9000)], g);
  } else {
    const g = c.createGain();
    g.gain.value = 0.9;
    chain(source('brown'), [filter('lowpass', 700)], g);
  }
  return made;
}

function teardown() {
  for (const n of nodes) {
    try { (n as AudioScheduledSourceNode).stop?.(); } catch (_e) {}
    try { n.disconnect(); } catch (_e) {}
  }
  nodes = [];
}

/** Toca um som. minutes = 0 → sem timer. */
export async function playSound(id: SoundId, minutes = 0) {
  const c = audio();
  await c.resume().catch(() => {});
  teardown();
  nodes = build(id);
  const g = master!.gain;
  g.cancelScheduledValues(c.currentTime);
  g.setValueAtTime(0, c.currentTime);
  g.linearRampToValueAtTime(state.volume, c.currentTime + 2.5); // entra devagar
  setTimer(minutes);
  set({ playing: id });
}

export function setTimer(minutes: number) {
  if (stopTimer) clearTimeout(stopTimer);
  stopTimer = null;
  if (minutes > 0) {
    stopTimer = setTimeout(() => stopSound(20), minutes * 60_000);
    set({ endsAt: Date.now() + minutes * 60_000 });
  } else {
    set({ endsAt: null });
  }
}

/** Para com um fade (em segundos), como quem abaixa o som devagar. */
export function stopSound(fadeSeconds = 1.5) {
  if (!ctx || !master) { set({ playing: null, endsAt: null }); return; }
  const g = master.gain;
  g.cancelScheduledValues(ctx.currentTime);
  g.setValueAtTime(g.value, ctx.currentTime);
  g.linearRampToValueAtTime(0, ctx.currentTime + fadeSeconds);
  if (stopTimer) clearTimeout(stopTimer);
  stopTimer = null;
  setTimeout(teardown, fadeSeconds * 1000 + 100);
  set({ playing: null, endsAt: null });
}

export function setVolume(v: number) {
  set({ volume: v });
  if (ctx && master && state.playing) master.gain.setTargetAtTime(v, ctx.currentTime, 0.2);
}

export function useAmbient(): State {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => state, () => state);
}
