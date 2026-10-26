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

// Dados pessoais guardados no aparelho fora do cache (humor de hoje, tarefas, sequência, fase difícil).
// Saem ao sair da conta, para a próxima pessoa no mesmo celular não ver nada.
const PERSONAL_KEYS = /^norica-(first-name|hoje|last-date|last-logged-date|last-mood|log-insight|log-insight-time|prev-last-logged|progress|streak|tasks|fase:)/;

export async function clearPersonalLocal() {
  if (typeof window === 'undefined') return;
  try {
    Object.keys(localStorage).filter((k) => PERSONAL_KEYS.test(k)).forEach((k) => localStorage.removeItem(k));
  } catch (_e) {}
  // Relatórios em PDF/CSV que foram compartilhados ficam na pasta temporária do app.
  try {
    const [{ Capacitor }, { Filesystem, Directory }] = await Promise.all([import('@capacitor/core'), import('@capacitor/filesystem')]);
    if (!Capacitor.isNativePlatform()) return;
    const { files } = await Filesystem.readdir({ path: '', directory: Directory.Cache });
    await Promise.all(files.filter((f) => /^norica.*\.(pdf|csv)$/i.test(f.name)).map((f) => Filesystem.deleteFile({ path: f.name, directory: Directory.Cache }).catch(() => {})));
  } catch (_e) {}
}
