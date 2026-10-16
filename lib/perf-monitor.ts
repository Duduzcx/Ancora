"use client";

// Mede a fluidez de verdade nos celulares das pessoas: alguns segundos depois de abrir
// cada tela, conta os quadros por segundo. Se ficar travado, registra em app_errors
// (tipo "slow", mensagem "fps baixo", com a tela e o modelo do celular) para sabermos
// exatamente onde e em quais aparelhos o app pesa.

import { reportSlow } from './error-report';

let running = false;

export function sampleFps(page: string) {
  if (typeof window === 'undefined' || running || document.hidden) return;
  running = true;
  setTimeout(() => {
    const times: number[] = [];
    const start = performance.now();
    const tick = (t: number) => {
      times.push(t);
      if (t - start < 4000 && !document.hidden) requestAnimationFrame(tick);
      else finish();
    };
    const finish = () => {
      running = false;
      if (times.length < 10 || document.hidden) return;
      const gaps = times.slice(1).map((x, i) => x - times[i]);
      const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
      const fps = 1000 / avg;
      const long = gaps.filter((g) => g > 50).length;
      if (fps < 45 || long >= 5) reportSlow(`fps baixo: ${Math.round(fps)} fps, ${long} travadas`, avg);
      try { (window as any).__noricaFps = { page, fps: Math.round(fps), long }; } catch (_e) {}
    };
    requestAnimationFrame(tick);
  }, 1500);
}
