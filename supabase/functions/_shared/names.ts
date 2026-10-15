// Primeiro nome da pessoa, para a IA chamar pelo nome (nunca o e-mail inteiro).

function capitalize(word: string): string {
  return word ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : word;
}

export function firstNameFrom(
  meta: Record<string, unknown> | null | undefined,
  profileName?: string | null,
  email?: string | null,
): string | null {
  const candidates = [
    profileName,
    meta?.display_name,
    meta?.given_name,
    meta?.full_name,
    meta?.name,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim() && !c.includes("@")) {
      return capitalize(c.trim().split(/\s+/)[0]);
    }
  }
  if (email) {
    const local = email.split("@")[0].split(/[._\-+0-9]/).find((p) => p.length >= 2);
    if (local) return capitalize(local);
  }
  return null;
}
