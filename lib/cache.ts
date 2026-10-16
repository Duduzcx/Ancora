// Cache local por conta (localStorage): as telas mostram na hora o último valor
// conhecido e atualizam em segundo plano quando a resposta do servidor chega.
// A chave inclui o id da conta, então outra pessoa no mesmo aparelho nunca vê os dados.

const PREFIX = 'norica-cache';

export function cacheGet<T>(userId: string | null | undefined, key: string): T | null {
  if (!userId || typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`${PREFIX}:${userId}:${key}`);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch (_e) {
    return null;
  }
}

export function cacheSet(userId: string | null | undefined, key: string, value: unknown) {
  if (!userId || typeof window === 'undefined') return;
  try {
    localStorage.setItem(`${PREFIX}:${userId}:${key}`, JSON.stringify(value));
  } catch (_e) {}
}

/** Apaga tudo do cache (ao sair da conta). */
export function cacheClear() {
  if (typeof window === 'undefined') return;
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(PREFIX))
      .forEach((k) => localStorage.removeItem(k));
  } catch (_e) {}
}
