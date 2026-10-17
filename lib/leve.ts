"use client";

// Modo leve: em celulares mais simples o fundo fica parado e sem brilhos contínuos,
// para sobrar força para rolar e trocar de tela. Liga sozinho (poucos núcleos ou pouca
// memória) e a pessoa pode ligar/desligar em Perfil → Modo leve.
// Também pausa os enfeites do fundo enquanto a pessoa rola a tela (em qualquer celular).

const KEY = 'norica-leve';

function autoLight(): boolean {
  if (typeof navigator === 'undefined') return false;
  const cores = (navigator as any).hardwareConcurrency ?? 8;
  const mem = (navigator as any).deviceMemory ?? 8;
  return cores <= 4 || mem <= 4;
}

export function lightMode(): boolean {
  try {
    const v = localStorage.getItem(KEY);
    if (v === '1') return true;
    if (v === '0') return false;
  } catch (_e) {}
  return autoLight();
}

export function applyLightMode(on = lightMode()) {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('leve', on);
}

export function setLightMode(on: boolean) {
  try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (_e) {}
  applyLightMode(on);
}

let started = false;
/** Enquanto houver rolagem (em qualquer lista da tela), pausa as animações de enfeite. */
export function pauseDecorOnScroll() {
  if (started || typeof window === 'undefined') return;
  started = true;
  const root = document.documentElement;
  let timer: ReturnType<typeof setTimeout> | null = null;
  window.addEventListener('scroll', () => {
    if (!timer) root.classList.add('rolando');
    else clearTimeout(timer);
    timer = setTimeout(() => { root.classList.remove('rolando'); timer = null; }, 180);
  }, { passive: true, capture: true });
}
