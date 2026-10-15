// Primeiro nome da pessoa para saudações ("Olá, Matheus"), nunca o e-mail inteiro.
// Ordem: nome salvo no Perfil → nome do cadastro → nome da conta Google → parte do e-mail.

function capitalize(word: string): string {
  return word ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : word;
}

export function firstName(user: any, profileName?: string | null, fallback = 'Navegador'): string {
  const meta = user?.user_metadata ?? {};
  const candidates = [profileName, meta.display_name, meta.given_name, meta.full_name, meta.name];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim() && !c.includes('@')) {
      return capitalize(c.trim().split(/\s+/)[0]);
    }
  }
  const email: string | undefined = user?.email;
  if (email) {
    // "joao.silva92@gmail.com" → "Joao"
    const part = email.split('@')[0].split(/[._\-+0-9]/).find(p => p.length >= 2);
    if (part) return capitalize(part);
  }
  return fallback;
}
