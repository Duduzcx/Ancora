// Verificação de assinaturas na Google Play Developer API.
// O servidor nunca confia no app: toda compra é conferida direto com o Google.
//
// Secrets necessários:
//   GOOGLE_SERVICE_ACCOUNT_JSON  — JSON da conta de serviço com acesso ao Play Console
//   PLAY_PACKAGE_NAME            — opcional (padrão: com.zcx.ancora)

export const PACKAGE_NAME = Deno.env.get("PLAY_PACKAGE_NAME") ?? "com.zcx.ancora";
export const PRO_PRODUCT_ID = Deno.env.get("PLAY_PRO_PRODUCT_ID") ?? "norica_pro_mensal";

type ServiceAccount = { client_email: string; private_key: string; token_uri?: string };

let cachedToken: { value: string; expiresAt: number } | null = null;

function b64url(input: Uint8Array | string): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToBytes(pem: string): Uint8Array<ArrayBuffer> {
  const b64 = pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const bin = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function serviceAccount(): ServiceAccount {
  const raw = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON não configurada");
  return JSON.parse(raw);
}

export function billingConfigured(): boolean {
  return !!Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
}

async function accessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  const sa = serviceAccount();
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/androidpublisher",
    aud: sa.token_uri ?? "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToBytes(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${header}.${claim}`)),
  );
  const res = await fetch(sa.token_uri ?? "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claim}.${b64url(signature)}`,
    }),
  });
  if (!res.ok) throw new Error(`Google OAuth ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  cachedToken = { value: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 };
  return cachedToken.value;
}

export type SubscriptionCheck = {
  active: boolean;
  expiresAt: string | null;
  productId: string | null;
  accountId: string | null; // obfuscatedExternalAccountId (= id do usuário no Supabase)
  state: string;
};

const ACTIVE_STATES = new Set([
  "SUBSCRIPTION_STATE_ACTIVE",
  "SUBSCRIPTION_STATE_IN_GRACE_PERIOD",
  "SUBSCRIPTION_STATE_CANCELED", // cancelada, mas vale até o fim do período pago
]);

export async function checkSubscription(purchaseToken: string): Promise<SubscriptionCheck> {
  const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE_NAME}` +
    `/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${await accessToken()}` } });
  if (!res.ok) throw new Error(`Google Play ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const items: { productId?: string; expiryTime?: string }[] = data.lineItems ?? [];
  const pro = items.find((i) => i.productId === PRO_PRODUCT_ID) ?? items[0];
  const expiresAt = pro?.expiryTime ?? null;
  const state: string = data.subscriptionState ?? "UNKNOWN";
  const notExpired = !!expiresAt && new Date(expiresAt) > new Date();
  return {
    active: ACTIVE_STATES.has(state) && notExpired,
    expiresAt,
    productId: pro?.productId ?? null,
    accountId: data.externalAccountIdentifiers?.obfuscatedExternalAccountId ?? null,
    state,
  };
}
