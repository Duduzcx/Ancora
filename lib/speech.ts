"use client";

// "Ouvir resposta": a Nórica lê a mensagem em voz alta com a melhor voz em português
// disponível no celular. Prefere as vozes "naturais" (que usam internet) e lê parágrafo
// por parágrafo, com pausas, num ritmo calmo. A pessoa pode escolher a voz e a velocidade
// em Perfil → Voz da Nórica.

import { TextToSpeech } from '@capacitor-community/text-to-speech';

export type VoiceOption = { index: number; id: string; label: string; natural: boolean };
type VoicePrefs = { id: string | null; rate: number };

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
    return { id: null, rate: 0.95, ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') };
  } catch (_e) {
    return { id: null, rate: 0.95 };
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

/** Lê o texto em partes (parágrafos/itens), com uma pausa natural entre elas. */
export async function speak(id: string, text: string, opts: { voiceId?: string; rate?: number } = {}) {
  const clean = toSpeakable(text);
  if (!clean) return;
  const token = ++runToken;
  try {
    await TextToSpeech.stop().catch(() => {});
    setSpeaking(id);
    const prefs = getVoicePrefs();
    const voices = opts.voiceId ? await listPortugueseVoices() : [];
    const voice = opts.voiceId ? voices.find((v) => v.id === opts.voiceId)?.index : await pickVoiceIndex();
    const rate = opts.rate ?? prefs.rate;
    const parts = clean.split(/\n+/).map((p) => p.trim()).filter(Boolean);
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
