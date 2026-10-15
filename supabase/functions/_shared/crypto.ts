// Criptografia AES-256-GCM do conteúdo sensível (mensagens, títulos, Cofre).
// A chave fica só no servidor, no secret NORICA_ENCRYPTION_KEY (32 bytes em base64).
// Gere uma com:  openssl rand -base64 32

const PREFIX = "enc:v1:";
let cachedKey: CryptoKey | null = null;

function b64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToB64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

async function getKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;
  const raw = Deno.env.get("NORICA_ENCRYPTION_KEY");
  if (!raw) throw new Error("NORICA_ENCRYPTION_KEY não configurada");
  const bytes = b64ToBytes(raw.trim());
  if (bytes.length !== 32) throw new Error("NORICA_ENCRYPTION_KEY precisa ter 32 bytes (base64)");
  cachedKey = await crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["encrypt", "decrypt"]);
  return cachedKey;
}

export async function encrypt(plain: string): Promise<string> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plain)),
  );
  const packed = new Uint8Array(iv.length + cipher.length);
  packed.set(iv, 0);
  packed.set(cipher, iv.length);
  return PREFIX + bytesToB64(packed);
}

// Textos antigos (antes desta versão) estão em texto puro: são devolvidos como estão.
export async function decrypt(value: string | null | undefined): Promise<string> {
  if (!value) return "";
  if (!value.startsWith(PREFIX)) return value;
  try {
    const key = await getKey();
    const packed = b64ToBytes(value.slice(PREFIX.length));
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: packed.slice(0, 12) },
      key,
      packed.slice(12),
    );
    return new TextDecoder().decode(plain);
  } catch (_e) {
    return "";
  }
}
