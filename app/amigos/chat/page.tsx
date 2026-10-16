"use client";

// Chat entre amigos do foguinho. Pensado para ser seguro:
// - só conversa quem já acendeu um foguinho junto (por código);
// - as mensagens ficam criptografadas no servidor e podem ser apagadas a qualquer hora;
// - se alguém escrever algo de risco, quem escreveu vê o CVV 188 na hora,
//   e o amigo recebe dicas de como acolher;
// - bloquear e denunciar levam um toque.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Send, Mic, Square, Loader2, MoreVertical, Trash2, ShieldOff, Flag, Phone, Heart, ShieldCheck, Archive, Check } from 'lucide-react';
import { noricaApi, type ChatMessage, type FriendsState } from '@/lib/norica-api';
import { getAuthState } from '@/lib/auth-store';
import { cacheGet, cacheSet } from '@/lib/cache';
import { addCalm } from '@/lib/calma';
import { HelpSheet } from '@/components/AjudaAgora';

const QUICK = ['Tô aqui com você 💛', 'Quer conversar?', 'Respira comigo 🌬️', 'Tenho orgulho de você', 'Como você está hoje?'];
const SUPPORT_188 = 'Se precisar, o CVV atende 24h pelo 188 (ligação grátis). E eu tô aqui com você 💛';
const REASONS = ['Mensagens ofensivas ou ameaças', 'Assédio ou conteúdo sexual', 'Não conheço essa pessoa', 'Outro motivo'];
const MAX_AUDIO = 30;

function hhmm(iso: string) {
  try { return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); } catch (_e) { return ''; }
}

function blobToBase64(b: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(b);
  });
}

export default function ChatAmigoPage() {
  const router = useRouter();
  const uid = getAuthState().user?.id;
  const [pairId, setPairId] = useState<string | null>(null);
  const [name, setName] = useState('Amigo');
  const [msgs, setMsgs] = useState<ChatMessage[] | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [crisis, setCrisis] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [rec, setRec] = useState<'idle' | 'recording' | 'sending'>('idle');
  const [secs, setSecs] = useState(0);
  const [saved, setSaved] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const bottom = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('pair');
    setPairId(id);
    const f = cacheGet<FriendsState>(uid, 'friends')?.friends?.find((x) => x.pairId === id);
    if (f) setName(f.name);
    // Abrir o chat é um bom momento para ligar as mensagens na hora (se o Firebase estiver pronto).
    import('@/lib/push').then((m) => m.initPush((r) => router.push(r), true)).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    if (!pairId) return;
    try {
      const r = await noricaApi.chatList(pairId);
      if (!Array.isArray(r?.messages)) return;
      setMsgs((prev) => (prev && prev.length === r.messages.length && prev[prev.length - 1]?.id === r.messages[r.messages.length - 1]?.id ? prev : r.messages));
    } catch (e: any) {
      if (/não encontrado/i.test(e?.message || '')) { setError('Esse foguinho não existe mais.'); setMsgs([]); }
      else setMsgs((p) => p ?? []);
    }
  }, [pairId]);

  // Atualiza sozinho: a cada 5 s com a tela aberta, e na hora quando chega um push.
  useEffect(() => {
    if (!pairId) return;
    load();
    const t = setInterval(() => { if (document.visibilityState === 'visible') load(); }, 5000);
    const onPush = () => load();
    window.addEventListener('norica-push', onPush);
    return () => { clearInterval(t); window.removeEventListener('norica-push', onPush); };
  }, [pairId, load]);

  useEffect(() => { bottom.current?.scrollIntoView({ block: 'end' }); }, [msgs?.length]);

  // Marcar como lido também na lista de amigos guardada no aparelho.
  useEffect(() => {
    if (!pairId || !msgs) return;
    const st = cacheGet<FriendsState>(uid, 'friends');
    if (st?.friends?.some((f) => f.pairId === pairId && f.unread)) {
      cacheSet(uid, 'friends', { ...st, friends: st.friends.map((f) => (f.pairId === pairId ? { ...f, unread: 0 } : f)) });
    }
  }, [pairId, msgs, uid]);

  const send = async (value: string) => {
    const t = value.trim();
    if (!t || !pairId || sending) return;
    setSending(true); setError(null);
    try {
      const r = await noricaApi.chatSend(pairId, t);
      setMsgs((m) => [...(m ?? []), r.message]);
      setText('');
      if (r.crisis) setCrisis(true);
    } catch (e: any) { setError(e?.message || 'Não foi possível enviar agora.'); } finally { setSending(false); }
  };

  const startRec = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find((t) => MediaRecorder.isTypeSupported(t)) || '';
      const r = new MediaRecorder(stream, mimeType ? { mimeType, audioBitsPerSecond: 32000 } : undefined);
      chunks.current = [];
      r.ondataavailable = (e) => { if (e.data.size > 0) chunks.current.push(e.data); };
      r.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks.current, { type: r.mimeType || 'audio/webm' });
        if (!pairId || blob.size < 800) { setRec('idle'); return; }
        setRec('sending');
        try {
          const res = await noricaApi.chatAudio(pairId, await blobToBase64(blob), blob.type);
          setMsgs((m) => [...(m ?? []), res.message]);
        } catch (e: any) { setError(e?.message || 'Não foi possível enviar o áudio.'); }
        setRec('idle');
      };
      recorder.current = r;
      r.start();
      setSecs(0);
      setRec('recording');
      timer.current = setInterval(() => setSecs((s) => s + 1), 1000);
    } catch (_e) {
      setError('Não consegui acessar o microfone. Libere a permissão nas configurações do celular.');
    }
  };
  const stopRec = () => {
    if (timer.current) { clearInterval(timer.current); timer.current = null; }
    if (recorder.current && recorder.current.state !== 'inactive') recorder.current.stop();
  };
  useEffect(() => { if (rec === 'recording' && secs >= MAX_AUDIO) stopRec(); }, [secs, rec]);
  useEffect(() => () => stopRec(), []);

  const saveToCalm = async (m: ChatMessage) => {
    if (!m.audioUrl) return;
    try {
      const blob = await (await fetch(m.audioUrl)).blob();
      await addCalm({ kind: 'audio', text: `Áudio de ${name}`, blob });
      setSaved(m.id);
    } catch (_e) { setError('Não foi possível salvar o áudio agora.'); }
  };

  const clearChat = async () => {
    setMenu(false);
    if (!pairId || !window.confirm('Apagar toda a conversa? Ela some para vocês dois.')) return;
    try { await noricaApi.chatClear(pairId); setMsgs([]); } catch (e: any) { setError(e?.message || 'Não foi possível apagar.'); }
  };
  const block = async (reason?: string) => {
    setMenu(false); setReporting(false);
    if (!pairId) return;
    if (!reason && !window.confirm(`Bloquear ${name}? O foguinho e a conversa somem e essa pessoa não consegue te adicionar de novo.`)) return;
    try {
      const st = await noricaApi.friendsBlock(pairId, reason);
      if (Array.isArray(st?.friends)) cacheSet(uid, 'friends', st);
      router.replace('/amigos/');
    } catch (e: any) { setError(e?.message || 'Não foi possível bloquear agora.'); }
  };

  const friendRisk = (msgs ?? []).some((m) => !m.mine && m.risk);

  return (
    <main className="h-[100dvh] bg-[#0f0906] text-white relative overflow-hidden flex flex-col font-sans" data-testid="chat-amigo">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(251,146,60,0.12)_0%,transparent_60%)]" />

      <header className="relative z-20 shrink-0 max-w-md w-full mx-auto px-5 pt-[calc(env(safe-area-inset-top)+1rem)] pb-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="p-3 bg-white/5 border border-white/10 rounded-full text-orange-200" aria-label="Voltar"><ArrowLeft size={20} /></button>
        <div className="flex-1 min-w-0">
          <p className="text-lg font-black truncate">{name}</p>
          <p className="text-[10px] text-white/40 font-bold flex items-center gap-1"><ShieldCheck size={11} /> Conversa criptografada</p>
        </div>
        <button onClick={() => setMenu((v) => !v)} className="p-3 bg-white/5 border border-white/10 rounded-full text-white/60" aria-label="Opções"><MoreVertical size={18} /></button>
        {menu && (
          <div className="absolute right-5 top-[calc(env(safe-area-inset-top)+4.5rem)] w-60 p-2 rounded-2xl bg-[#1a120c] border border-white/10 shadow-2xl space-y-1" data-testid="chat-menu">
            <button onClick={clearChat} className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-bold hover:bg-white/5"><Trash2 size={16} className="text-white/50" /> Apagar conversa</button>
            <button onClick={() => block()} className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-bold hover:bg-white/5"><ShieldOff size={16} className="text-white/50" /> Bloquear {name}</button>
            <button onClick={() => { setMenu(false); setReporting(true); }} className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-bold text-rose-300 hover:bg-white/5"><Flag size={16} /> Denunciar e bloquear</button>
          </div>
        )}
      </header>

      <div className="relative z-10 flex-1 overflow-y-auto max-w-md w-full mx-auto px-5 space-y-3 pb-4" data-testid="chat-lista">
        {friendRisk && (
          <div className="p-4 rounded-2xl bg-sky-400/10 border border-sky-300/25 space-y-2" data-testid="dicas-acolher">
            <p className="text-sm font-black text-sky-100 flex items-center gap-2"><Heart size={15} /> {name} pode estar num momento difícil</p>
            <ul className="text-[12px] text-white/70 font-semibold space-y-1 leading-snug list-disc pl-4">
              <li>Escute sem julgar e sem pressa. Você não precisa ter as respostas.</li>
              <li>Pode perguntar com carinho e direto: &quot;você está seguro agora?&quot;</li>
              <li>Incentive a ligar para o CVV (188) ou a falar com alguém de confiança.</li>
              <li>Se houver perigo agora, ligue 192 (SAMU). Cuidar de você também importa.</li>
            </ul>
            <button onClick={() => send(SUPPORT_188)} disabled={sending} className="w-full py-2.5 rounded-xl bg-sky-300 text-slate-950 text-[10px] font-black uppercase tracking-widest">Mandar o 188 com carinho</button>
          </div>
        )}

        {msgs === null && <div className="space-y-3 pt-4"><div className="skeleton h-12 w-2/3 rounded-2xl" /><div className="skeleton h-12 w-1/2 rounded-2xl ml-auto" /></div>}
        {msgs?.length === 0 && !error && (
          <div className="text-center pt-10 space-y-2">
            <p className="text-3xl">💬</p>
            <p className="text-sm font-black">Comece com um carinho</p>
            <p className="text-[12px] text-white/45 font-semibold">Mande uma das frases abaixo ou um áudio de até 30 segundos.</p>
          </div>
        )}

        {msgs?.map((m) => (
          <div key={m.id} className={`flex ${m.mine ? 'justify-end' : 'justify-start'}`} data-testid="mensagem">
            <div className={`max-w-[80%] px-4 py-3 rounded-2xl ${m.mine ? 'bg-orange-400/90 text-slate-950 rounded-br-md' : 'bg-white/[0.08] border border-white/10 rounded-bl-md'}`}>
              {m.kind === 'audio' ? (
                <div className="space-y-2">
                  {m.audioUrl ? <audio controls src={m.audioUrl} className="w-56 max-w-full h-10" preload="none" /> : <p className="text-xs font-bold">Áudio indisponível</p>}
                  {!m.mine && m.audioUrl && (
                    <button onClick={() => saveToCalm(m)} className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-amber-200">
                      {saved === m.id ? <><Check size={11} /> Salvo na caixa de calma</> : <><Archive size={11} /> Salvar na caixa de calma</>}
                    </button>
                  )}
                </div>
              ) : (
                <p className="text-sm font-semibold leading-snug whitespace-pre-wrap break-words">{m.text}</p>
              )}
              <p className={`text-[9px] font-bold mt-1 ${m.mine ? 'text-slate-900/50 text-right' : 'text-white/35'}`}>{hhmm(m.created_at)}</p>
            </div>
          </div>
        ))}
        <div ref={bottom} />
      </div>

      <footer className="relative z-20 shrink-0 max-w-md w-full mx-auto px-5 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-2 space-y-2 bg-gradient-to-t from-[#0f0906] via-[#0f0906]/95 to-transparent">
        {crisis && (
          <div className="p-4 rounded-2xl bg-rose-400/10 border border-rose-300/25 space-y-2" data-testid="chat-risco">
            <p className="text-sm font-black text-rose-100">Parece que está pesado demais agora. Você não precisa passar por isso sozinho.</p>
            <p className="text-[12px] text-white/65 font-semibold">O CVV atende 24h, de graça, pelo 188. Se estiver em perigo agora, ligue 192.</p>
            <div className="flex gap-2">
              <a href="tel:188" className="flex-1 py-2.5 rounded-xl bg-rose-300 text-slate-950 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5"><Phone size={12} /> Ligar 188</a>
              <button onClick={() => setHelpOpen(true)} className="flex-1 py-2.5 rounded-xl bg-white/10 border border-white/15 text-[10px] font-black uppercase tracking-widest">Mais ajuda</button>
              <button onClick={() => setCrisis(false)} className="px-3 rounded-xl text-white/40 text-[10px] font-black" aria-label="Fechar">✕</button>
            </div>
          </div>
        )}
        {error && <p className="text-xs font-bold text-orange-100/80">{error}</p>}

        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5" data-testid="respostas-prontas">
          {QUICK.map((q) => (
            <button key={q} onClick={() => send(q)} disabled={sending} className="shrink-0 px-3 py-2 rounded-full bg-white/5 border border-white/10 text-[11px] font-bold text-white/75">{q}</button>
          ))}
        </div>

        {rec === 'recording' ? (
          <button onClick={stopRec} className="w-full py-3.5 rounded-2xl bg-rose-400 text-slate-950 text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2" data-testid="parar-audio">
            <Square size={14} /> Gravando {secs}s de {MAX_AUDIO}s · toque para enviar
          </button>
        ) : (
          <div className="flex gap-2 items-end">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(text); } }}
              rows={1}
              maxLength={1000}
              placeholder={`Mensagem para ${name}`}
              className="flex-1 resize-none bg-black/30 border border-white/10 rounded-2xl px-4 py-3 text-sm outline-none focus:border-orange-300/40 placeholder:text-white/25 max-h-32"
              data-testid="chat-input"
            />
            {text.trim() ? (
              <button onClick={() => send(text)} disabled={sending} className="w-12 h-12 shrink-0 rounded-2xl bg-orange-400 text-slate-950 flex items-center justify-center" aria-label="Enviar">
                {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              </button>
            ) : (
              <button onClick={startRec} disabled={rec === 'sending'} className="w-12 h-12 shrink-0 rounded-2xl bg-white/10 border border-white/15 text-orange-200 flex items-center justify-center" aria-label="Gravar áudio de apoio">
                {rec === 'sending' ? <Loader2 size={18} className="animate-spin" /> : <Mic size={18} />}
              </button>
            )}
          </div>
        )}
        <p className="text-[9px] text-white/30 font-semibold leading-snug text-center">
          Só vocês dois veem esta conversa. A Nórica não lê, a não ser trechos que você denunciar. A Nórica é para maiores de 18 anos: converse só com quem você conhece pessoalmente.
        </p>
      </footer>

      {reporting && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end" onClick={() => setReporting(false)}>
          <div className="w-full max-w-md mx-auto p-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] rounded-t-[2rem] bg-[#1a120c] border-t border-white/10 space-y-3" onClick={(e) => e.stopPropagation()} data-testid="denunciar">
            <p className="text-lg font-black">Denunciar {name}</p>
            <p className="text-[12px] text-white/55 font-semibold">A pessoa é bloqueada na hora e nossa equipe recebe as últimas mensagens para analisar. Ela não fica sabendo que foi você.</p>
            {REASONS.map((r) => (
              <button key={r} onClick={() => block(r)} className="w-full text-left px-4 py-3.5 rounded-2xl bg-white/5 border border-white/10 text-sm font-bold">{r}</button>
            ))}
            <button onClick={() => setReporting(false)} className="w-full py-3 text-[10px] font-black uppercase tracking-widest text-white/40">Cancelar</button>
          </div>
        </div>
      )}
      <HelpSheet open={helpOpen} onClose={() => setHelpOpen(false)} />
    </main>
  );
}
