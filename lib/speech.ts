"use client";

// "Ouvir resposta": a Nórica lê a mensagem em voz alta, devagar, com a voz do próprio celular
// (português do Brasil, funciona sem internet se a voz estiver instalada).

import { TextToSpeech } from '@capacitor-community/text-to-speech';

let speakingId: string | null = null;
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

/** Tira markdown, links e emojis para a leitura soar natural. */
export function toSpeakable(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_#>`~]/g, '')
    .replace(/^\s*[-•]\s+/gm, '')
    .replace(/^\s*\d+[.)]\s+/gm, '')
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function speak(id: string, text: string) {
  const clean = toSpeakable(text);
  if (!clean) return;
  try {
    await TextToSpeech.stop().catch(() => {});
    setSpeaking(id);
    await TextToSpeech.speak({ text: clean, lang: 'pt-BR', rate: 0.92, pitch: 1.0, volume: 1.0, category: 'playback' });
  } catch (e) {
    console.error('Voz:', e);
  } finally {
    if (speakingId === id) setSpeaking(null);
  }
}

export async function stopSpeaking() {
  try {
    await TextToSpeech.stop();
  } catch (_e) {}
  setSpeaking(null);
}
