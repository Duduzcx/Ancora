"use client";

// Caixa de calma: guarde aqui o que te acalma. No S.O.S ela abre primeiro.

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Quote, ImagePlus, Music, Mic, Square, Trash2, Heart, Loader2, Play } from 'lucide-react';
import { addCalm, compressImage, removeCalm, useCalm, type CalmItem } from '@/lib/calma';
import CaixaCalmaViewer from '@/components/CaixaCalmaViewer';

const KIND_LABEL: Record<CalmItem['kind'], string> = { frase: 'Frase', foto: 'Foto', musica: 'Música', audio: 'Áudio' };

export default function CalmaPage() {
  const router = useRouter();
  const items = useCalm();
  const [tab, setTab] = useState<CalmItem['kind']>('frase');
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [viewing, setViewing] = useState(false);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('abrir') === '1') setViewing(true);
  }, []);

  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => setSeconds((s) => { if (s >= 29) stopRec(); return s + 1; }), 1000);
    return () => clearInterval(t);
  }, [recording]);

  const done = (m: string) => { setMsg(m); setText(''); setUrl(''); setTimeout(() => setMsg(null), 3000); };

  const saveFrase = async () => { if (!text.trim()) return; await addCalm({ kind: 'frase', text: text.trim().slice(0, 200) }); done('Frase guardada. 💛'); };
  const saveMusic = async () => {
    if (!/^https?:\/\//.test(url.trim())) { setMsg('Cole o link da música (Spotify, YouTube…).'); return; }
    await addCalm({ kind: 'musica', url: url.trim(), text: text.trim().slice(0, 80) || 'Minha música' });
    done('Música guardada. 🎵');
  };
  const onPhoto = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    try { await addCalm({ kind: 'foto', blob: await compressImage(f), text: text.trim().slice(0, 80) || undefined }); done('Foto guardada. 💛'); }
    catch (_e) { setMsg('Não foi possível usar essa foto.'); }
    finally { setBusy(false); }
  };

  const startRec = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunks.current = [];
      rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks.current, { type: rec.mimeType || 'audio/webm' });
        await addCalm({ kind: 'audio', blob, text: text.trim().slice(0, 80) || 'Um áudio para você' });
        done('Áudio guardado. 💛');
      };
      recRef.current = rec;
      rec.start();
      setSeconds(0);
      setRecording(true);
    } catch (_e) {
      setMsg('Precisamos do microfone para gravar. Libere nas permissões do app.');
    }
  };
  const stopRec = () => { recRef.current?.state === 'recording' && recRef.current.stop(); setRecording(false); };

  const tabs: { id: CalmItem['kind']; icon: any }[] = [{ id: 'frase', icon: Quote }, { id: 'foto', icon: ImagePlus }, { id: 'musica', icon: Music }, { id: 'audio', icon: Mic }];

  return (
    <main className="min-h-[100dvh] bg-[#06121a] text-white relative overflow-x-hidden pb-40 font-sans" data-testid="calma">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(252,211,77,0.10)_0%,transparent_60%)]" />
      <div className="relative z-10 max-w-md mx-auto px-6 pt-[calc(env(safe-area-inset-top)+1.5rem)] space-y-6">
        <div className="flex items-center justify-between">
          <button onClick={() => router.back()} className="p-3 bg-white/5 border border-white/10 rounded-full text-amber-200" aria-label="Voltar"><ArrowLeft size={20} /></button>
          <span className="text-[9px] font-black text-amber-200/80 uppercase tracking-[0.25em]">Caixa de calma</span>
        </div>
        <div className="space-y-2 page-enter">
          <h1 className="text-4xl font-black tracking-tighter leading-none">O que te <span className="text-amber-200 italic">acalma?</span></h1>
          <p className="text-sm text-white/55 font-semibold leading-relaxed">Uma frase, a foto do seu cachorro, uma música, um áudio de quem você ama. No S.O.S, sua caixa abre primeiro. Fica só no seu celular.</p>
        </div>

        {items && items.length > 0 && (
          <button onClick={() => setViewing(true)} className="w-full py-4 rounded-2xl bg-amber-300 text-slate-950 font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-2">
            <Heart size={14} /> Abrir minha caixa ({items.length})
          </button>
        )}

        <section className="p-5 rounded-[2rem] bg-white/5 border border-white/10 space-y-4">
          <div className="grid grid-cols-4 gap-2">
            {tabs.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)} className={`py-3 rounded-2xl border flex flex-col items-center gap-1 text-[10px] font-black ${tab === t.id ? 'bg-amber-300/15 border-amber-200/40 text-amber-100' : 'bg-black/20 border-white/5 text-white/50'}`}>
                <t.icon size={18} /> {KIND_LABEL[t.id]}
              </button>
            ))}
          </div>

          {tab === 'frase' && (
            <>
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={200} placeholder='Ex.: "Isso também vai passar."' className="w-full bg-black/30 border border-white/10 rounded-2xl p-4 text-sm outline-none focus:border-amber-200/40 placeholder:text-white/25 resize-none" />
              <button onClick={saveFrase} disabled={!text.trim()} className="w-full py-3.5 rounded-2xl bg-white/10 border border-white/15 disabled:opacity-40 text-[10px] font-black uppercase tracking-widest">Guardar frase</button>
            </>
          )}
          {tab === 'foto' && (
            <>
              <input value={text} onChange={(e) => setText(e.target.value)} maxLength={80} placeholder="Legenda (opcional)" className="w-full bg-black/30 border border-white/10 rounded-2xl px-4 py-3 text-sm outline-none focus:border-amber-200/40 placeholder:text-white/25" />
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onPhoto(e.target.files?.[0])} />
              <button onClick={() => fileRef.current?.click()} disabled={busy} className="w-full py-3.5 rounded-2xl bg-white/10 border border-white/15 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2">
                {busy ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />} Escolher foto
              </button>
            </>
          )}
          {tab === 'musica' && (
            <>
              <input value={text} onChange={(e) => setText(e.target.value)} maxLength={80} placeholder="Nome da música" className="w-full bg-black/30 border border-white/10 rounded-2xl px-4 py-3 text-sm outline-none focus:border-amber-200/40 placeholder:text-white/25" />
              <input value={url} onChange={(e) => setUrl(e.target.value)} inputMode="url" placeholder="Link (Spotify, YouTube…)" className="w-full bg-black/30 border border-white/10 rounded-2xl px-4 py-3 text-sm outline-none focus:border-amber-200/40 placeholder:text-white/25" />
              <button onClick={saveMusic} className="w-full py-3.5 rounded-2xl bg-white/10 border border-white/15 text-[10px] font-black uppercase tracking-widest">Guardar música</button>
            </>
          )}
          {tab === 'audio' && (
            <>
              <p className="text-xs text-white/55 font-semibold leading-relaxed">Peça para alguém que você ama gravar até 30 segundos aqui no seu celular. Ex.: "Ei, respira. Eu tô aqui com você."</p>
              <input value={text} onChange={(e) => setText(e.target.value)} maxLength={80} placeholder="Quem gravou? (ex.: Mãe)" className="w-full bg-black/30 border border-white/10 rounded-2xl px-4 py-3 text-sm outline-none focus:border-amber-200/40 placeholder:text-white/25" />
              {recording ? (
                <button onClick={stopRec} className="w-full py-3.5 rounded-2xl bg-rose-500 text-white text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2"><Square size={14} /> Parar (0:{String(seconds).padStart(2, '0')})</button>
              ) : (
                <button onClick={startRec} className="w-full py-3.5 rounded-2xl bg-white/10 border border-white/15 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2"><Mic size={14} /> Gravar áudio</button>
              )}
            </>
          )}
          {msg && <p className="text-xs font-bold text-amber-100/80">{msg}</p>}
        </section>

        {items && items.length > 0 && (
          <ul className="space-y-2">
            {items.map((it) => (
              <li key={it.id} className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/10">
                <span className="text-[9px] font-black uppercase tracking-widest text-amber-200/70 w-14">{KIND_LABEL[it.kind]}</span>
                <span className="flex-1 text-sm font-semibold text-white/80 truncate">{it.text || (it.kind === 'foto' ? 'Foto' : it.url)}</span>
                <button onClick={() => removeCalm(it.id)} aria-label="Remover" className="p-1.5 text-white/30"><Trash2 size={14} /></button>
              </li>
            ))}
          </ul>
        )}
        {items && items.length === 0 && <p className="text-sm text-white/40 font-semibold text-center">Sua caixa ainda está vazia. Comece com uma frase. 🌱</p>}

        <button onClick={() => router.push('/toque/')} className="w-full flex items-center justify-center gap-2 py-3 text-[10px] font-black uppercase tracking-widest text-white/50">
          <Play size={12} /> Modo "não quero falar": acalmar só com toques
        </button>
      </div>
      {viewing && items && items.length > 0 && <CaixaCalmaViewer items={items} onClose={() => setViewing(false)} />}
    </main>
  );
}
