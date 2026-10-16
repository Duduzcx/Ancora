// Planos Gratuito e Pro.
//
// MODO LANÇAMENTO: enquanto o secret NORICA_LAUNCH_ALL_PRO não for "false",
// todo mundo usa o Pro de graça e nenhum limite é aplicado.
// Para ligar os limites do plano Gratuito no futuro:
//   supabase secrets set NORICA_LAUNCH_ALL_PRO=false
//
// Recursos de crise (S.O.S, botão de ajuda, CVV/SAMU) NUNCA têm limite, em nenhum plano.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { billingConfigured, checkSubscription } from "./google-play.ts";

export type Plan = "free" | "pro";
export type UsageKind = "porto_message" | "arena_feedback" | "tts";

export const PLAN_LIMITS: Record<Plan, Record<UsageKind, number>> = {
  free: { porto_message: 30, arena_feedback: 2, tts: 20 }, // por dia
  pro: { porto_message: 300, arena_feedback: 50, tts: 120 }, // uso justo
};

export function launchMode(): boolean {
  return (Deno.env.get("NORICA_LAUNCH_ALL_PRO") ?? "true").toLowerCase() !== "false";
}

function startOfTodayBR(): string {
  // Dia contado no fuso de Brasília (UTC-3).
  const now = new Date(Date.now() - 3 * 3600_000);
  now.setUTCHours(0, 0, 0, 0);
  return new Date(now.getTime() + 3 * 3600_000).toISOString();
}

export async function getPlan(admin: SupabaseClient, userId: string) {
  const { data } = await admin
    .from("user_plans")
    .select("plan, pro_until, pro_interest_at, purchase_token")
    .eq("user_id", userId)
    .maybeSingle();

  let proUntil: string | null = data?.pro_until ?? null;
  let isPro = data?.plan === "pro" && (!proUntil || new Date(proUntil) > new Date());

  // Assinatura venceu? Confere com a Google Play se ela foi renovada (ou cancelada).
  if (data?.plan === "pro" && !isPro && data.purchase_token && billingConfigured()) {
    try {
      const sub = await checkSubscription(data.purchase_token);
      proUntil = sub.expiresAt;
      isPro = sub.active;
      await admin.from("user_plans").update({
        plan: sub.active ? "pro" : "free",
        pro_until: sub.expiresAt,
        updated_at: new Date().toISOString(),
      }).eq("user_id", userId);
    } catch (e) {
      console.error("Falha ao renovar assinatura:", e);
    }
  }

  const plan: Plan = isPro ? "pro" : "free";
  const effective: Plan = launchMode() ? "pro" : plan;
  return {
    plan,
    effective,
    launch: launchMode(),
    proInterest: !!data?.pro_interest_at,
    proUntil: isPro ? proUntil : null,
    billing: billingConfigured(),
  };
}

export async function usageToday(admin: SupabaseClient, userId: string, kind: UsageKind): Promise<number> {
  const { count } = await admin
    .from("usage_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("kind", kind)
    .gte("created_at", startOfTodayBR());
  return count ?? 0;
}

/** Retorna null se pode usar; senão, a mensagem amigável de limite. Registra o uso quando permitido. */
export async function consume(admin: SupabaseClient, userId: string, kind: UsageKind): Promise<string | null> {
  const { effective } = await getPlan(admin, userId);
  const limit = PLAN_LIMITS[effective][kind];
  const used = await usageToday(admin, userId, kind);
  if (used >= limit) {
    if (effective === "pro") return "Você usou bastante hoje. Que tal uma pausa e voltar amanhã? 🌊";
    if (kind === "tts") return "A voz natural descansou por hoje. A leitura continua com a voz do celular.";
    return kind === "porto_message"
      ? `Você chegou ao limite de ${limit} mensagens de hoje no plano Gratuito. Amanhã o Porto abre de novo — ou conheça o Pro no seu Perfil. Se precisar de ajuda agora, toque em "Ajuda".`
      : `Você já viu ${limit} retornos da Arena hoje no plano Gratuito. Volte amanhã ou conheça o Pro no seu Perfil.`;
  }
  await admin.from("usage_events").insert({ user_id: userId, kind });
  return null;
}
