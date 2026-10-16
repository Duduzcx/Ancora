"use client";

// "Ouvir resposta": a Nórica lê a mensagem em voz alta com a melhor voz em português
// disponível no celular. Prefere as vozes "naturais" (que usam internet) e lê parágrafo
// por parágrafo, com pausas, num ritmo calmo. A pessoa pode escolher a voz e a velocidade
// em Perfil → Voz da Nórica.

import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { noricaApi } from '@/lib/norica-api';

export type VoiceOption = { index: number; id: string; label: string; natural: boolean };
export type Engine = 'natural' | 'device';
type VoicePrefs = { id: string | null; rate: number; engine: Engine; natural: string };
const DEFAULT_PREFS: VoicePrefs = { id: null, rate: 0.95, engine: 'natural', natural: 'serena' };

const PREFS_KEY = 'norica-voice';
export const RATES = [
  { value: 0.85, label: 'Mais devagar' },
  { value: 0.95, label: 'Normal' },
  { value: 1.05, label: 'Mais rápido' },
];

let speakingId: string | null = null;
let runToken = 0;
const listeners = new Set<(id: string | null) => void>();

function setSpeaking(id: string | null) {
  speakingId = id;
  listeners.forEach((l) => l(id));
}

export function onSpeakingChange(listener: (id: string | null) => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const currentlySpeaking = () => speakingId;

export function getVoicePrefs(): VoicePrefs {
  try {
    return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') };
  } catch (_e) {
    return DEFAULT_PREFS;
  }
}

export function setVoicePrefs(prefs: Partial<VoicePrefs>) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ ...getVoicePrefs(), ...prefs }));
  } catch (_e) {}
}

let voicesCache: VoiceOption[] | null = null;

/** Vozes em português do Brasil, das mais naturais para as mais simples. */
export async function listPortugueseVoices(): Promise<VoiceOption[]> {
  if (voicesCache) return voicesCache;
  try {
    const { voices } = await TextToSpeech.getSupportedVoices();
    const pt = voices
      .map((v: any, index: number) => ({ v, index }))
      .filter(({ v }) => /^pt[-_](BR|br)/.test(v.lang || ''))
      .map(({ v, index }) => {
        const id = String(v.voiceURI || v.name || index);
        const natural = /network/i.test(id) || v.localService === false;
        return { index, id, natural, label: '' };
      })
      .sort((a, b) => Number(b.natural) - Number(a.natural) || a.id.localeCompare(b.id));
    let n = 0;
    let m = 0;
    voicesCache = pt.map((o) => ({ ...o, label: o.natural ? `Voz natural ${++n}` : `Voz do aparelho ${++m}` }));
    return voicesCache;
  } catch (_e) {
    return [];
  }
}

async function pickVoiceIndex(): Promise<number | undefined> {
  const voices = await listPortugueseVoices();
  if (!voices.length) return undefined;
  const prefs = getVoicePrefs();
  const saved = prefs.id ? voices.find((v) => v.id === prefs.id) : undefined;
  if (saved) return saved.index;
  const online = typeof navigator === 'undefined' || navigator.onLine !== false;
  return (online ? voices.find((v) => v.natural) : voices.find((v) => !v.natural))?.index ?? voices[0].index;
}

/** Tira markdown, links e emojis para a leitura soar natural. */
export function toSpeakable(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_#>`~]/g, '')
    .replace(/^\s*[-•]\s+/gm, '')
    .replace(/^\s*\d+[.)]\s+/gm, '')
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu, '')
    .replace(/\b188\b/g, '1 8 8')
    .replace(/\b192\b/g, '1 9 2')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

// ---------------------------------------------------------------------
// Voz natural (IA no servidor): soa como uma pessoa de verdade.
// Se não estiver disponível (sem internet, limite do dia, servidor sem chave),
// a leitura continua com a voz do celular, sem a pessoa precisar fazer nada.
// ---------------------------------------------------------------------

export type NaturalVoice = { id: string; label: string };
const INFO_KEY = 'norica-tts-info';
let info: { available: boolean; voices: NaturalVoice[]; at: number } | null = null;

export async function naturalVoices(force = false): Promise<{ available: boolean; voices: NaturalVoice[] }> {
  if (!info) {
    try { info = JSON.parse(localStorage.getItem(INFO_KEY) || 'null'); } catch (_e) {}
  }
  if (!force && info && Date.now() - info.at < 6 * 3600_000) return info;
  try {
    const r = await noricaApi.ttsInfo();
    info = { ...r, at: Date.now() };
    try { localStorage.setItem(INFO_KEY, JSON.stringify(info)); } catch (_e) {}
  } catch (_e) {
    if (!info) return { available: false, voices: [] };
  }
  return info!;
}

const audioCache = new Map<string, string>();
let currentAudio: HTMLAudioElement | null = null;

async function naturalClip(text: string, voice: string): Promise<string> {
  const key = `${voice}|${text}`;
  const hit = audioCache.get(key);
  if (hit) return hit;
  const r = await noricaApi.tts(text, voice);
  const url = `data:${r.mime};base64,${r.audio}`;
  audioCache.set(key, url);
  if (audioCache.size > 24) audioCache.delete(audioCache.keys().next().value!);
  return url;
}

function playClip(url: string, rate: number, token: number): Promise<void> {
  return new Promise((resolve, reject) => {
    if (token !== runToken) return resolve();
    const a = new Audio(url);
    a.playbackRate = Math.max(0.8, Math.min(1.2, rate / 0.95));
    currentAudio = a;
    a.onended = () => resolve();
    a.onpause = () => resolve();
    a.onerror = () => reject(new Error('audio'));
    a.play().catch(reject);
  });
}

/** Junta parágrafos em blocos de até ~600 caracteres: menos espera entre as partes. */
function chunks(parts: string[], max = 600) {
  const out: string[] = [];
  for (const p of parts) {
    const last = out[out.length - 1];
    if (last && last.length + p.length + 1 <= max) out[out.length - 1] = `${last}\n${p}`;
    else out.push(p.slice(0, 1700));
  }
  return out;
}

/** Tenta ler com a voz natural. Devolve quantas partes conseguiu ler (o resto vai para a voz do celular). */
async function speakNatural(parts: string[], voice: string, rate: number, token: number): Promise<number> {
  const blocks = chunks(parts);
  let done = 0;
  let next: Promise<string> | null = naturalClip(blocks[0], voice);
  for (let i = 0; i < blocks.length; i++) {
    if (token !== runToken) return parts.length;
    const url = await next!;
    next = i + 1 < blocks.length ? naturalClip(blocks[i + 1], voice) : null; // já busca a próxima enquanto toca
    next?.catch(() => {});
    await playClip(url, rate, token);
    done += blocks[i].split('\n').length;
  }
  return done;
}

/** Lê o texto em partes (parágrafos/itens), com uma pausa natural entre elas. */
export async function speak(id: string, text: string, opts: { voiceId?: string; rate?: number; engine?: Engine; natural?: string } = {}) {
  const clean = toSpeakable(text);
  if (!clean) return;
  const token = ++runToken;
  try {
    await TextToSpeech.stop().catch(() => {});
    currentAudio?.pause();
    setSpeaking(id);
    const prefs = getVoicePrefs();
    const rate = opts.rate ?? prefs.rate;
    let parts = clean.split(/\n+/).map((p) => p.trim()).filter(Boolean);
    const engine = opts.voiceId ? 'device' : opts.engine ?? prefs.engine;
    const online = typeof navigator === 'undefined' || navigator.onLine !== false;
    if (engine === 'natural' && online) {
      try {
        if ((await naturalVoices()).available) {
          const read = await speakNatural(parts, opts.natural ?? prefs.natural, rate, token);
          parts = parts.slice(read);
        }
      } catch (e) {
        console.warn('Voz natural indisponível, usando a do celular:', e);
      }
    }
    if (!parts.length || token !== runToken) return;
    const voices = opts.voiceId ? await listPortugueseVoices() : [];
    const voice = opts.voiceId ? voices.find((v) => v.id === opts.voiceId)?.index : await pickVoiceIndex();
    for (const part of parts) {
      if (token !== runToken) return; // a pessoa tocou em "parar" ou pediu outra leitura
      await TextToSpeech.speak({ text: part, lang: 'pt-BR', rate, pitch: 1.0, volume: 1.0, voice, category: 'playback' });
    }
  } catch (e) {
    console.error('Voz:', e);
  } finally {
    if (token === runToken && speakingId === id) setSpeaking(null);
  }
}

export async function stopSpeaking() {
  runToken++;
  try { currentAudio?.pause(); } catch (_e) {}
  currentAudio = null;
  try {
    await TextToSpeech.stop();
  } catch (_e) {}
  setSpeaking(null);
}

/** Abre a tela do Android para instalar vozes (quando o celular não tem voz em português). */
export async function openVoiceInstall() {
  try {
    await TextToSpeech.openInstall();
  } catch (_e) {}
}
