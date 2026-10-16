"use client";

// Leitura fácil: letras maiores, menos letras miúdas em maiúsculas e animações que param.
const KEY = 'norica-leitura-facil';

export function easyReading(): boolean {
  try { return localStorage.getItem(KEY) === '1'; } catch (_e) { return false; }
}

export function applyEasyReading(on = easyReading()) {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('leitura-facil', on);
}

export function setEasyReading(on: boolean) {
  try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (_e) {}
  applyEasyReading(on);
}
