"use client";

// ⚠️ Antes de publicar: troque CONTACT_EMAIL pelo e-mail oficial de atendimento da ZCX Studios.
const CONTACT_EMAIL = 'contato@zcxstudios.com.br';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ShieldCheck, Lock, HeartHandshake, Trash2, Ban, LifeBuoy, Mail } from 'lucide-react';

type Section = { id: string; title: string; body: React.ReactNode };

const SUMMARY = [
  { icon: Lock, title: 'Criptografado', text: 'Conversas, Cofre, diário e plano de segurança são guardados com AES-256.' },
  { icon: Ban, title: 'Nunca vendemos', text: 'Seus dados não são vendidos nem usados para publicidade.' },
  { icon: HeartHandshake, title: 'Você no controle', text: 'Veja, desligue ou apague a memória da Nórica quando quiser.' },
  { icon: Trash2, title: 'Excluir é fácil', text: 'Perfil → Excluir Minha Conta apaga tudo na hora.' },
];

const SECTIONS: Section[] = [
  {
    id: 'quem',
    title: 'Quem somos',
    body: <p>O Nórica é um aplicativo de apoio emocional, organização de rotina e autoconhecimento desenvolvido pela <strong>ZCX Studios</strong>, controladora dos seus dados pessoais nos termos da Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD). Contato para qualquer assunto de privacidade: <strong>{CONTACT_EMAIL}</strong>.</p>,
  },
  {
    id: 'emergencia',
    title: 'O Nórica não é um serviço de emergência',
    body: <p>O Nórica é uma ferramenta de apoio e não substitui psicólogos, médicos ou serviços de emergência. Se você estiver em sofrimento intenso, ligue para o <strong>CVV — 188</strong> (24h, gratuito) ou, em perigo imediato, para o <strong>SAMU — 192</strong>.</p>,
  },
  {
    id: 'dados',
    title: 'Quais dados coletamos',
    body: (
      <>
        <ul>
          <li><strong>Cadastro:</strong> nome, como prefere ser chamado(a), e-mail, data de nascimento, foto de perfil (no login com Google) e como conheceu o app.</li>
          <li><strong>Dados emocionais (dados pessoais sensíveis):</strong> o estado do seu "mar" (calmo, ansioso, agitado, S.O.S), as conversas com a IA no Porto e os textos guardados no Cofre.</li>
          <li><strong>Rotina:</strong> os hábitos marcados nos Logs e as tarefas que você adiciona a partir do Porto.</li>
          <li><strong>Áudio:</strong> quando você usa o microfone, o áudio é enviado só para virar texto. O arquivo de áudio não é guardado.</li>
          <li><strong>Memória da Nórica:</strong> um resumo curto das conversas (pessoas importantes, temas e o que costuma ajudar). Você vê, desliga e apaga em <strong>Perfil → Memória da Nórica</strong>.</li>
          <li><strong>Diário, exercícios e Modo noite:</strong> o que você grava ou escreve, o resumo semanal e o relatório mensal que a IA escreve para você.</li>
          <li><strong>Cartas para o futuro:</strong> o texto fica criptografado e só é liberado na data que você escolher. A agenda da terapia, a lista do que levar para a sessão e o progresso das trilhas ficam apenas no seu celular.</li>
          <li><strong>Caderno de estudos e ideias:</strong> suas anotações e cartões de revisão ficam criptografados. Guardamos também quando você revisou e o tempo das sessões de foco (com a ansiedade de 1 a 5 que você marcar).</li>
          <li><strong>Faculdade:</strong> matérias, horários, provas, trabalhos, notas, tarefas e a página de cada matéria ficam na sua conta, protegidos pelo seu login (só você acessa), sem criptografia extra para o calendário e os lembretes funcionarem rápido. Não coloque ali informações sensíveis.</li>
          <li><strong>Foguinho com amigos e grupos:</strong> o nome que aparece para seus amigos e se você marcou o dia (nunca o que você escreveu ou sentiu). As conquistas do mês só aparecem para um amigo se você ligar essa opção — e nunca o seu humor.</li>
          <li><strong>Chat entre amigos:</strong> as mensagens de texto ficam criptografadas e os áudios de apoio (até 30 segundos) ficam numa área privada, acessada só por links temporários. Qualquer um dos dois pode apagar a conversa inteira. Se uma mensagem indicar risco, quem escreveu vê na hora o contato do CVV (188).</li>
          <li><strong>Bloqueios e denúncias:</strong> ao denunciar alguém, a pessoa é bloqueada e guardamos o motivo e as últimas mensagens da conversa (criptografadas) só para nossa equipe analisar.</li>
          <li><strong>Notificações em tempo real:</strong> um código do seu aparelho (token do Firebase) para avisar de mensagens e carinhos dos amigos. O aviso na tela de bloqueio diz só quem mandou, nunca o conteúdo.</li>
          <li><strong>Hoje em 1 minuto e modo fase difícil:</strong> o minuto do dia vira um registro normal de humor, hábito e diário. O modo fase difícil (e o motivo escolhido) fica só no seu celular; a Nórica recebe apenas o tipo da fase para responder com mais cuidado.</li>
          <li><strong>Meditações guiadas:</strong> os áudios são os mesmos para todo mundo e não guardam nada sobre você.</li>
          <li><strong>Instituições criadas no app:</strong> nome e tipo da instituição, quem criou e os códigos de convite. O painel continua mostrando só números somados de grupos com 5 pessoas ou mais.</li>
          <li><strong>Página para escolas e empresas:</strong> quando alguém pede contato, guardamos nome, instituição, tamanho, WhatsApp/e-mail e a mensagem, só para responder a esse pedido.</li>
          <li><strong>Plano de segurança:</strong> o que você escrever, incluindo nomes e telefones das suas pessoas de confiança. Só são usados quando você mesmo(a) toca para avisá-las.</li>
          <li><strong>Avaliações e registros técnicos:</strong> nota e motivo quando você toca em 👍/👎 (não o texto da conversa), além de erros e lentidão (tela, versão do app e modelo do celular).</li>
        </ul>
        <p>As conversas da Arena (simulações) não são guardadas. O relatório em PDF é montado no seu próprio celular.</p>
      </>
    ),
  },
  {
    id: 'uso',
    title: 'Por que usamos e com qual base legal',
    body: (
      <ul>
        <li>Para criar e manter sua conta e oferecer as funções do app (execução do serviço).</li>
        <li>Para tratar seus dados emocionais — respostas da IA, mapa emocional, Farol, resumos e relatórios — com base no seu <strong>consentimento específico e destacado</strong>, pedido no primeiro uso (art. 11, I, da LGPD). Você pode retirá-lo a qualquer momento excluindo sua conta.</li>
        <li>Nunca usamos seus dados para publicidade e nunca os vendemos.</li>
      </ul>
    ),
  },
  {
    id: 'compartilhamento',
    title: 'Com quem compartilhamos',
    body: (
      <>
        <p>Somente com fornecedores necessários para o app funcionar, sob contrato e regras de segurança:</p>
        <ul>
          <li><strong>Supabase</strong> — banco de dados, login e servidor do app.</li>
          <li><strong>Groq</strong> — inteligência artificial (respostas do Porto e da Arena, títulos, resumos e transcrição de voz).</li>
          <li><strong>Google</strong> — login com conta Google, pagamento do Pro pela Google Play (não recebemos dados do seu cartão) e, quando você escolhe uma <strong>voz natural</strong>, o texto da resposta é enviado para virar áudio (o áudio não é guardado). O <strong>Firebase Cloud Messaging</strong> (Google) entrega as notificações dos amigos — recebe só o título do aviso, sem o conteúdo das mensagens.</li>
          <li><strong>Instituição parceira</strong> (escola, cursinho ou empresa) — só se você digitar o código dela. Ela vê apenas números somados e anônimos de grupos com pelo menos 5 pessoas ativas, inclusive por setor ou turma, e pode publicar campanhas que aparecem na sua Início. Nunca recebe suas conversas, Cofre, diário, plano de segurança ou o seu humor individual. Você pode sair quando quiser em Perfil → Instituição Parceira.</li>
        </ul>
        <p>Esses fornecedores podem processar dados fora do Brasil (inclusive nos Estados Unidos), apenas para prestar o serviço e com garantias compatíveis com a LGPD.</p>
      </>
    ),
  },
  {
    id: 'protecao',
    title: 'Como protegemos',
    body: (
      <ul>
        <li>Todo o tráfego é criptografado (HTTPS).</li>
        <li>Mensagens do Porto e do chat entre amigos, títulos, Cofre, diário, cartas, memória, plano de segurança, resumos e relatórios são <strong>criptografados no servidor com AES-256</strong> antes de ir para o banco.</li>
        <li>Cada conta só acessa os próprios dados (regras de acesso no banco) e a IA só atende usuários autenticados.</li>
      </ul>
    ),
  },
  {
    id: 'tempo',
    title: 'Por quanto tempo guardamos',
    body: <p>Enquanto sua conta existir. Você pode apagar conversas, itens do Cofre e do diário a qualquer momento. Ao excluir a conta, tudo é apagado na hora dos bancos de produção; cópias de segurança automáticas podem manter os dados por até 30 dias e depois são eliminadas.</p>,
  },
  {
    id: 'direitos',
    title: 'Seus direitos',
    body: <p>Você pode confirmar se tratamos seus dados, acessá-los, corrigi-los, pedir a portabilidade, revogar o consentimento e pedir a eliminação. A exclusão completa está no app em <strong>Perfil → Excluir Minha Conta</strong>. Para os demais pedidos, escreva para <strong>{CONTACT_EMAIL}</strong>.</p>,
  },
  {
    id: 'idade',
    title: 'Idade mínima',
    body: <p>O Nórica é destinado a pessoas com 18 anos ou mais.</p>,
  },
  {
    id: 'alteracoes',
    title: 'Alterações',
    body: <p>Se esta política mudar de forma relevante, avisaremos dentro do app e pediremos seu consentimento novamente quando necessário.</p>,
  },
];

export default function Privacidade() {
  const router = useRouter();
  const back = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) router.back();
    else router.push('/');
  };
  const goTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <main className="min-h-[100dvh] bg-[#021013] text-white font-sans relative overflow-x-hidden">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.12)_0%,transparent_60%)]" />

      {/* Cabeçalho fixo com voltar */}
      <header className="sticky top-0 z-30 bg-[#021013]/85 backdrop-blur-xl border-b border-white/5 pt-[env(safe-area-inset-top)]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-3">
          <button onClick={back} className="p-2.5 bg-white/5 border border-white/10 rounded-full text-emerald-300 active:scale-95 transition-transform" aria-label="Voltar">
            <ArrowLeft size={20} />
          </button>
          <div className="min-w-0">
            <p className="text-[9px] font-black text-emerald-400/80 uppercase tracking-[0.25em]">Nórica</p>
            <h1 className="text-sm font-black tracking-tight truncate">Política de Privacidade</h1>
          </div>
        </div>
      </header>

      <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 pt-8 pb-28 space-y-8">
        <div className="space-y-3 page-enter">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center"><ShieldCheck size={26} /></div>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tighter leading-tight">Seus dados, <span className="text-emerald-400 italic">seu porto.</span></h2>
          <p className="text-sm text-white/55 font-semibold">Última atualização: outubro de 2026</p>
        </div>

        {/* Em resumo */}
        <section aria-label="Em resumo" className="grid grid-cols-1 sm:grid-cols-2 gap-3 stagger-in">
          {SUMMARY.map((s) => (
            <div key={s.title} className="flex items-start gap-3 p-5 rounded-[1.75rem] bg-white/5 border border-white/10">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-300 flex items-center justify-center shrink-0"><s.icon size={18} /></div>
              <div>
                <p className="text-sm font-black">{s.title}</p>
                <p className="text-xs text-white/60 font-semibold leading-relaxed mt-0.5">{s.text}</p>
              </div>
            </div>
          ))}
        </section>

        {/* Índice */}
        <nav aria-label="Índice" className="flex flex-wrap gap-2">
          {SECTIONS.map((s, i) => (
            <button key={s.id} onClick={() => goTo(s.id)} className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[11px] font-bold text-white/65 active:scale-95 transition-transform">
              {i + 1}. {s.title}
            </button>
          ))}
        </nav>

        <div className="space-y-4">
          {SECTIONS.map((s, i) => (
            <section key={s.id} id={s.id} className="scroll-mt-24 p-6 sm:p-8 rounded-[2rem] bg-white/[0.04] border border-white/10">
              <div className="flex items-center gap-3 mb-4">
                <span className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-300 text-xs font-black flex items-center justify-center shrink-0">{i + 1}</span>
                <h3 className="text-base sm:text-lg font-black tracking-tight">{s.title}</h3>
              </div>
              <div className="text-sm text-white/70 font-medium leading-relaxed space-y-3 [&_ul]:space-y-2.5 [&_ul]:pl-1 [&_li]:relative [&_li]:pl-4 [&_li]:before:content-[''] [&_li]:before:absolute [&_li]:before:left-0 [&_li]:before:top-[0.6em] [&_li]:before:w-1.5 [&_li]:before:h-1.5 [&_li]:before:rounded-full [&_li]:before:bg-emerald-400/70 [&_strong]:text-white [&_strong]:font-bold">
                {s.body}
              </div>
            </section>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <a href="tel:188" className="flex items-center gap-3 p-5 rounded-[1.75rem] bg-rose-500/10 border border-rose-400/20">
            <LifeBuoy size={20} className="text-rose-300" />
            <span className="text-sm font-black">Precisa de ajuda agora? <span className="text-rose-200">Ligue 188</span></span>
          </a>
          <a href={`mailto:${CONTACT_EMAIL}`} className="flex items-center gap-3 p-5 rounded-[1.75rem] bg-white/5 border border-white/10">
            <Mail size={20} className="text-emerald-300" />
            <span className="text-sm font-black truncate">{CONTACT_EMAIL}</span>
          </a>
        </div>

        <button onClick={back} className="w-full py-4 rounded-2xl bg-emerald-500 text-slate-950 font-black uppercase tracking-widest text-[11px] active:scale-[0.98] transition-transform">
          Voltar
        </button>
      </div>
    </main>
  );
}
