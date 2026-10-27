// Mensagens do login em português (o Supabase responde em inglês).
// Cada erro diz o que aconteceu E o que a pessoa pode fazer.

export type AuthProblem =
  | 'credenciais'
  | 'nao-confirmado'
  | 'ja-existe'
  | 'senha-fraca'
  | 'muitas-tentativas'
  | 'email-invalido'
  | 'link-expirado'
  | 'mesma-senha'
  | 'sem-internet'
  | 'envio-email'
  | 'outro';

export function authProblem(err: unknown): AuthProblem {
  const e = (err ?? {}) as { message?: string; code?: string; status?: number; name?: string };
  const msg = `${e.code ?? ''} ${e.message ?? ''}`.toLowerCase();
  if (/invalid_credentials|invalid login credentials/.test(msg)) return 'credenciais';
  if (/email_address_not_authorized|not authorized|error sending|sending (confirmation|recovery|magic)|smtp|over_email_send_rate_limit|email rate limit/.test(msg)) return 'envio-email';
  if (/email_not_confirmed|email not confirmed/.test(msg)) return 'nao-confirmado';
  if (/user_already_exists|already registered|already been registered|email_exists/.test(msg)) return 'ja-existe';
  if (/weak_password|password should|password is too|at least \d+ characters|pwned|leaked/.test(msg)) return 'senha-fraca';
  if (/same_password|should be different/.test(msg)) return 'mesma-senha';
  if (/rate limit|over_request_rate_limit|too many|security purposes|after \d+ seconds/.test(msg) || e.status === 429) return 'muitas-tentativas';
  if (/email_address_invalid|invalid format|unable to validate email|invalid email/.test(msg)) return 'email-invalido';
  if (/otp_expired|expired|invalid flow state|code verifier|flow_state/.test(msg)) return 'link-expirado';
  if (/failed to fetch|network|load failed|fetch/.test(msg) || e.name === 'AuthRetryableFetchError') return 'sem-internet';
  return 'outro';
}

/** Texto para mostrar na tela. `detalhe` é a mensagem original, usada para explicar regras de senha. */
export function authMessage(err: unknown): string {
  const raw = String((err as { message?: string })?.message ?? '');
  switch (authProblem(err)) {
    case 'credenciais':
      return 'E-mail ou senha não conferem. Confira se o teclado não colocou letra maiúscula ou espaço. Se esqueceu, toque em "Esqueci a senha".';
    case 'nao-confirmado':
      return 'Falta confirmar seu e-mail. Abra o e-mail da Nórica (veja também o spam) e toque no link — ou peça um novo abaixo.';
    case 'ja-existe':
      return 'Este e-mail já tem conta na Nórica. Volte e entre com ele — ou toque em "Esqueci a senha".';
    case 'senha-fraca': {
      const n = raw.match(/at least (\d+)/i)?.[1];
      if (/pwned|leaked|known to be/i.test(raw)) return 'Essa senha é muito comum e já apareceu em vazamentos. Escolha outra.';
      if (/one character of each|lowercase|uppercase|digits|symbols/i.test(raw)) {
        return 'A senha precisa ter letra minúscula, letra maiúscula, número' + (/symbol/i.test(raw) ? ' e símbolo (ex.: ! @ #)' : '') + (n ? `, com pelo menos ${n} caracteres` : '') + '.';
      }
      return `A senha precisa ter pelo menos ${n ?? 6} caracteres.`;
    }
    case 'mesma-senha':
      return 'A nova senha precisa ser diferente da antiga.';
    case 'muitas-tentativas':
      return 'Muitas tentativas seguidas. Espere 1 minuto e tente de novo.';
    case 'email-invalido':
      return 'Esse e-mail não parece certo. Confira se não ficou espaço ou letra faltando.';
    case 'link-expirado':
      return 'Esse link expirou ou já foi usado. Peça um novo e abra no mesmo celular em que a Nórica está instalada.';
    case 'envio-email':
      return 'Não conseguimos enviar o e-mail agora. Tente de novo mais tarde ou entre com o Google — e, se puder, avise a gente pelo Instagram.';
    case 'sem-internet':
      return 'Sem conexão com a internet. Confira o Wi-Fi ou os dados móveis e tente de novo.';
    default:
      return 'Não deu certo agora. Tente de novo em instantes.';
  }
}

/** Atributos para campos de senha: sem maiúscula automática, sem corretor, sem espaço do teclado. */
export const passwordInputProps = {
  autoCapitalize: 'none',
  autoCorrect: 'off',
  spellCheck: false,
} as const;

export const emailInputProps = {
  autoCapitalize: 'none',
  autoCorrect: 'off',
  spellCheck: false,
  inputMode: 'email',
  autoComplete: 'email',
} as const;
