// Notificações push pelo Firebase Cloud Messaging (FCM HTTP v1).
// Opcional: só funciona com o secret FCM_SERVICE_ACCOUNT (o JSON da conta de serviço do Firebase).
//   supabase secrets set FCM_SERVICE_ACCOUNT="$(cat chave-firebase.json)"
// Sem o secret, nada é enviado e o app segue funcionando normalmente.
// O texto nunca mostra conteúdo sensível (aparece na tela bloqueada).

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

type ServiceAccount = { project_id: string; client_email: string; private_key: string };
let cached: { token: string; exp: number } | null = null;

export const pushConfigured = () => !!Deno.env.get("FCM_SERVICE_ACCOUNT");

function account(): ServiceAccount | null {
  try {
    const raw = Deno.env.get("FCM_SERVICE_ACCOUNT");
    return raw ? JSON.parse(raw) : null;
  } catch (_e) {
    return null;
  }
}

const b64url = (data: Uint8Array | string) =>
  btoa(typeof data === "string" ? data : String.fromCharCode(...data)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function accessToken(sa: ServiceAccount): Promise<string> {
  if (cached && cached.exp > Date.now() + 60_000) return cached.token;
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const pem = sa.private_key.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${header}.${claim}`)));
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${header}.${claim}.${b64url(sig)}` }),
  });
  if (!res.ok) throw new Error(`oauth ${res.status}`);
  const data = await res.json();
  cached = { token: data.access_token, exp: Date.now() + (data.expires_in ?? 3600) * 1000 };
  return cached.token;
}

/** Envia para todos os aparelhos das pessoas. Nunca lança erro (push é bônus, não pode quebrar nada). */
export async function sendPush(admin: SupabaseClient, userIds: string[], msg: { title: string; body: string; route?: string }) {
  const sa = account();
  if (!sa || !userIds.length) return 0;
  try {
    const { data: rows } = await admin.from("push_tokens").select("token, user_id").in("user_id", userIds);
    if (!rows?.length) return 0;
    const token = await accessToken(sa);
    let sent = 0;
    await Promise.all(rows.map(async (r) => {
      const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          message: {
            token: r.token,
            notification: { title: msg.title, body: msg.body },
            data: { route: msg.route ?? "/" },
            android: { priority: "high", notification: { channel_id: "amigos", icon: "ic_stat_norica", color: "#34d399" } },
          },
        }),
        signal: AbortSignal.timeout(8000),
      }).catch(() => null);
      if (res?.ok) sent++;
      else if (res && (res.status === 404 || res.status === 400)) {
        const txt = await res.text().catch(() => "");
        if (/UNREGISTERED|INVALID_ARGUMENT|not a valid FCM/i.test(txt)) await admin.from("push_tokens").delete().eq("token", r.token);
      }
    }));
    return sent;
  } catch (e) {
    console.error("push:", e);
    return 0;
  }
}

/** Igual ao sendPush, mas sem fazer a pessoa esperar: o envio termina em segundo plano. */
export function pushSoon(admin: SupabaseClient, userIds: string[], msg: { title: string; body: string; route?: string }): Promise<unknown> {
  if (!pushConfigured() || !userIds.length) return Promise.resolve();
  const p = sendPush(admin, userIds, msg);
  const er = (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }).EdgeRuntime;
  if (er?.waitUntil) { er.waitUntil(p); return Promise.resolve(); }
  return p;
}
