"use client";

// Plano de segurança da pessoa: fica criptografado no servidor e com uma cópia no aparelho,
// para abrir na hora no botão de ajuda — inclusive sem internet, que é quando mais pode faltar.

import { noricaApi, type SafetyPlan } from './norica-api';
import { cacheGet, cacheSet } from './cache';
import { getAuthState } from './auth-store';

export const EMPTY_PLAN: SafetyPlan = {
  sinais: '',
  acalma: '',
  distrair: '',
  contatos: [],
  profissionais: 'CVV — ligar 188 (24h, gratuito) ou cvv.org.br\nSAMU — 192 em emergência',
  motivos: '',
};

const uid = () => getAuthState().user?.id ?? null;

export function cachedPlan(): SafetyPlan | null {
  return cacheGet<SafetyPlan>(uid(), 'safetyPlan');
}

/** Cópia do aparelho na hora; depois confere com o servidor. */
export async function loadPlan(onUpdate?: (plan: SafetyPlan | null) => void): Promise<SafetyPlan | null> {
  const local = cachedPlan();
  try {
    const { plan } = await noricaApi.safetyPlanGet();
    cacheSet(uid(), 'safetyPlan', plan);
    onUpdate?.(plan);
    return plan;
  } catch (_e) {
    return local;
  }
}

export async function savePlan(plan: SafetyPlan): Promise<SafetyPlan> {
  cacheSet(uid(), 'safetyPlan', plan); // vale no aparelho mesmo se a internet falhar
  const { plan: saved } = await noricaApi.safetyPlanSave(plan);
  cacheSet(uid(), 'safetyPlan', saved);
  return saved;
}

/** Número para ligar/WhatsApp no formato internacional (Brasil por padrão). */
export function phoneDigits(raw: string): string {
  const d = raw.replace(/\D/g, '');
  if (!d) return '';
  if (raw.trim().startsWith('+')) return d;
  if (d.startsWith('55') && d.length >= 12) return d;
  return `55${d.replace(/^0+/, '')}`;
}

export function trustedMessage(name?: string | null): string {
  return `Oi${name ? `, ${name}` : ''}. Estou passando por um momento difícil e queria muito conversar com você. Pode me ligar ou vir falar comigo?`;
}

export const hasPlan = (p: SafetyPlan | null | undefined) =>
  !!p && !!(p.sinais || p.acalma || p.distrair || p.motivos || p.contatos.length);
