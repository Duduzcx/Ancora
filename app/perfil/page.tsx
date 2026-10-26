"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase-client';
import pkg from '@/package.json';
import PermitirNotificacoes from '@/components/PermitirNotificacoes';
import { easyReading, setEasyReading } from '@/lib/leitura';
import { lightMode, setLightMode } from '@/lib/leve';
import { noricaApi, type HealthReport, type OrgInfo } from '@/lib/norica-api';
import { 
  User, Save, CheckCircle2, ArrowLeft, ShieldCheck, 
  Anchor, LifeBuoy, Mail, Calendar, 
  LogOut, Settings, Fingerprint, AlertCircle, Loader2,
  ChevronRight, BadgeCheck, Shield, Key, Sparkles,
  ShipWheel, Compass, Waves, Camera, Crown, Trash2, Bell, Brain, ClipboardList, Building2, Volume2, Type, Gauge } from 'lucide-react';
import { useRouter } from 'next/navigation';
import AnimatedBackground from '@/components/AnimatedBackground';
import { getAuthState, useAuth } from '@/lib/auth-store';
import { cacheGet, cacheSet } from '@/lib/cache';
import { RATES, getVoicePrefs, listPortugueseVoices, naturalVoices, openVoiceInstall, setVoicePrefs, speak, stopSpeaking, type NaturalVoice, type VoiceOption } from '@/lib/speech';
import { DEFAULT_REMINDER, disableReminder, enableReminder, formatTime, getReminder, sendTestNotification, setNotificationPref, type ReminderSettings } from '@/lib/reminder';

// Foto do Google em alta resolução. A URL padrão vem com 96px ("=s96-c"),
// que fica borrada no avatar grande em telas de celular.
function hiResAvatar(url: string | null | undefined, size = 512): string | null {
  if (!url) return null;
  if (url.includes('googleusercontent.com')) {
    if (/=s\d+(-c)?$/.test(url)) return url.replace(/=s\d+(-c)?$/, `=s${size}-c`);
    if (/\/s\d+(-c)?\//.test(url)) return url.replace(/\/s\d+(-c)?\//, `/s${size}-c/`);
    return `${url}=s${size}-c`;
  }
  return url;
}

type CachedProfile = { name: string; birth: string | null };

// Componente para efeito de digitação lenta. Digita só na primeira visita da sessão:
// ao voltar ao Perfil (ou quando o nome chega do servidor) o nome já aparece pronto, sem "piscar".
let nameTyped = false;
const TypingName = ({ text }: { text: string }) => {
  const [displayedText, setDisplayedText] = useState(() => (nameTyped ? text : ""));

  useEffect(() => {
    if (nameTyped) { setDisplayedText(text); return; }
    let i = 0;
    const interval = setInterval(() => {
      setDisplayedText(text.slice(0, i + 1));
      i++;
      if (i >= text.length) { clearInterval(interval); nameTyped = true; }
    }, 70); // digitação suave, sem fazer a pessoa esperar
    return () => clearInterval(interval);
  }, [text]);

  return (
    <motion.span 
      initial={false} 
      animate={{ opacity: 1 }} 
      className="inline-block"
    >
      {displayedText}
      <span className="inline-block ml-1 w-1 h-8 bg-emerald-500 css-blink" />
    </motion.span>
  );
};

export default function PerfilPage() {
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [age, setAge] = useState<number | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const { user: authUser } = useAuth();
  
  const [isExiting, setIsExiting] = useState(false);
  
  const supabase = createClient();
  const router = useRouter();

  const calculateAge = (dateStr: string) => {
    if (!dateStr || dateStr.length !== 10) return;
    const [d, m, y] = dateStr.split('/').map(Number);
    if (isNaN(d) || isNaN(m) || isNaN(y)) return;
    const birth = new Date(y, m - 1, d);
    const today = new Date();
    let ageVal = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      ageVal--;
    }
    setAge(ageVal >= 0 ? ageVal : 0);
  };

  useEffect(() => {
    setIsMounted(true);
    const applyBirth = (iso: string) => {
      const [y, m, d] = iso.split('-');
      const formatted = `${d}/${m}/${y}`;
      setBirthDate(formatted);
      calculateAge(formatted);
      setIsLocked(true);
    };

    const loadProfile = async () => {
      // Usa o login já carregado pelo app (instantâneo) em vez de esperar o getSession.
      const sessionUser = getAuthState().user ?? (await supabase.auth.getSession()).data.session?.user;
      if (!sessionUser) return;
      setUser(sessionUser);

      // Conta Google não tem display_name: usa o nome da conta como ponto de partida.
      const metaName = sessionUser.user_metadata?.display_name || sessionUser.user_metadata?.full_name || sessionUser.user_metadata?.name;
      const metaBirth = sessionUser.user_metadata?.birth_date;
      const metaAvatar = sessionUser.user_metadata?.avatar_url || sessionUser.user_metadata?.picture;

      if (metaAvatar) setAvatarUrl(hiResAvatar(metaAvatar));
      if (metaName) setName(metaName);
      if (metaBirth) applyBirth(metaBirth);

      // Último perfil salvo no aparelho: o nome aparece na hora.
      const cached = cacheGet<CachedProfile>(sessionUser.id, 'profile');
      if (cached?.name) setName(cached.name);
      if (cached?.birth) applyBirth(cached.birth);
      if (cached || metaName) setIsDataLoaded(true);

      const { data: profile } = await supabase.from('profiles')
        .select('display_name, birth_date')
        .eq('id', sessionUser.id)
        .maybeSingle();

      if (profile) {
        if (profile.display_name) setName(profile.display_name);
        if (profile.birth_date) applyBirth(profile.birth_date);
        cacheSet(sessionUser.id, 'profile', {
          name: profile.display_name || metaName || '',
          birth: profile.birth_date || metaBirth || null,
        } satisfies CachedProfile);
      }
      setIsDataLoaded(true);
    };
    loadProfile();
  }, [supabase, authUser?.id]);

  useEffect(() => {
    if (isExiting) {
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
    } else {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    };
  }, [isExiting]);

  const handleBirthDateChange = (val: string) => {
    if (isLocked) return;
    const cleaned = val.replace(/\D/g, '').slice(0, 8);
    let formatted = cleaned;
    if (cleaned.length > 2) formatted = `${cleaned.slice(0, 2)}/${cleaned.slice(2)}`;
    if (cleaned.length > 4) formatted = `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}/${cleaned.slice(4)}`;
    setBirthDate(formatted);
    if (formatted.length === 10) calculateAge(formatted);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || loading || isLocked) return;

    setError(null);
    if (!name.trim()) { setError("Digite seu nome."); return; }
    if (birthDate.length !== 10) { setError("Data de nascimento incompleta."); return; }

    setLoading(true);
    try {
      const [d, m, y] = birthDate.split('/');
      const isoDate = `${y}-${m}-${d}`;
      
      const { error: authError } = await supabase.auth.updateUser({ 
        data: { display_name: name.trim(), birth_date: isoDate } 
      });
      if (authError) throw authError;

      await supabase.from('profiles').upsert({
        id: user.id,
        display_name: name.trim(),
        birth_date: isoDate,
        updated_at: new Date().toISOString(),
        name_changed: true
      });

      cacheSet(user.id, 'profile', { name: name.trim(), birth: isoDate } satisfies CachedProfile);
      cacheSet(user.id, 'profileName', name.trim());
      setSaved(true);
      setIsLocked(true);
      await supabase.auth.refreshSession();
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError("Erro ao salvar dados. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleteText, setDeleteText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Exclusão real da conta (LGPD + política do Google Play).
  const handleDeleteAccount = async () => {
    if (deleteText.trim().toUpperCase() !== 'EXCLUIR' || isDeleting) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await noricaApi.deleteAccount();
      try {
        Object.keys(localStorage).filter(k => k.startsWith('norica')).forEach(k => localStorage.removeItem(k));
      } catch (_e) {}
      await supabase.auth.signOut().catch(() => {});
      setIsDeleteOpen(false);
      router.replace('/');
    } catch (err: any) {
      setDeleteError(err?.message || 'Não foi possível excluir agora.');
      setIsDeleting(false);
    }
  };

  // Lembrete diário
  const [reminder, setReminder] = useState<ReminderSettings>(DEFAULT_REMINDER);
  const [isReminderOpen, setIsReminderOpen] = useState(false);
  const [reminderTime, setReminderTime] = useState('20:00');
  const [reminderMsg, setReminderMsg] = useState<string | null>(null);
  const [reminderBusy, setReminderBusy] = useState(false);
  const [notifKey, setNotifKey] = useState(0);
  const [easy, setEasy] = useState(false);
  const [light, setLight] = useState(false);
  useEffect(() => { setEasy(easyReading()); setLight(lightMode()); }, []);
  useEffect(() => {
    const r = getReminder();
    setReminder(r);
    setReminderTime(formatTime(r));
  }, []);

  const saveReminder = async (on: boolean) => {
    setReminderBusy(true);
    setReminderMsg(null);
    if (!on) {
      await disableReminder();
      setReminder({ ...getReminder() });
      setReminderBusy(false);
      return;
    }
    const [h, m] = reminderTime.split(':').map(Number);
    const STAGE_MSG: Record<string, string> = {
      'esperando resposta': 'Toque em "Permitir" na janela do Android…',
      canal: 'Preparando as notificações…',
      agendar: 'Agendando seus lembretes…',
    };
    // Nunca deixa o botão girando para sempre: em 40s libera e explica.
    const watchdog = new Promise<'error'>((res) => setTimeout(() => res('error'), 40_000));
    const result = await Promise.race([
      enableReminder(h || 20, m || 0, (st) => { if (STAGE_MSG[st]) setReminderMsg(STAGE_MSG[st]); }),
      watchdog,
    ]);
    setReminder({ ...getReminder() });
    setReminderBusy(false);
    if (result === 'ok') setReminderMsg(`Pronto! Todo dia às ${reminderTime} a Nórica te chama. 🌊`);
    else if (result === 'denied') { setReminderMsg('Falta permitir as notificações: toque no botão amarelo acima.'); setNotifKey((k) => k + 1); }
    else if (result === 'unsupported') setReminderMsg('O lembrete funciona no app instalado no celular.');
    else setReminderMsg('O celular não respondeu ao agendar. Toque em "Enviar teste" e, se não chegar, confira em Configurações → Apps → Nórica → Notificações.');
  };

  const testReminder = async () => {
    setReminderBusy(true);
    setReminderMsg(null);
    const r = await sendTestNotification();
    setReminderBusy(false);
    if (r === 'ok') setReminderMsg('Teste enviado! A notificação chega em 5 segundos (pode sair do app).');
    else if (r === 'denied') setReminderMsg('As notificações estão bloqueadas. Libere em Configurações → Apps → Nórica → Notificações.');
    else if (r === 'unsupported') setReminderMsg('O teste funciona no app instalado no celular.');
    else setReminderMsg('O celular não conseguiu mostrar a notificação. Confira as permissões do app.');
  };

  // Memória da Nórica: a pessoa vê o que ela lembra, desliga ou apaga.
  const [isMemoryOpen, setIsMemoryOpen] = useState(false);
  const [memory, setMemory] = useState<{ enabled: boolean; items: string[] } | null>(null);
  const [memoryBusy, setMemoryBusy] = useState(false);
  const [memoryError, setMemoryError] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const openMemory = async () => {
    setIsMemoryOpen(true);
    setMemoryError(null);
    setConfirmClear(false);
    try {
      const m = await noricaApi.memoryGet();
      setMemory({ enabled: m.enabled, items: m.items });
    } catch (err: any) {
      setMemoryError(err?.message || 'Não foi possível carregar agora.');
    }
  };
  const toggleMemory = async () => {
    if (!memory) return;
    setMemoryBusy(true);
    try {
      const r = await noricaApi.memorySet(!memory.enabled);
      setMemory({ ...memory, enabled: r.enabled });
    } catch (err: any) {
      setMemoryError(err?.message || 'Não foi possível salvar agora.');
    } finally {
      setMemoryBusy(false);
    }
  };
  const clearMemory = async () => {
    setMemoryBusy(true);
    try {
      await noricaApi.memoryClear();
      setMemory((m) => (m ? { ...m, items: [] } : m));
      setConfirmClear(false);
    } catch (err: any) {
      setMemoryError(err?.message || 'Não foi possível apagar agora.');
    } finally {
      setMemoryBusy(false);
    }
  };

  // Voz da Nórica (leitura das respostas)
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [voices, setVoices] = useState<VoiceOption[] | null>(null);
  const [voicePrefs, setVoicePrefsState] = useState(getVoicePrefs());
  const SAMPLE = 'Oi! Eu sou a Nórica. Estou aqui para te ouvir, sem pressa. Como está o seu mar hoje?';
  const [natural, setNatural] = useState<NaturalVoice[] | null>(null);
  const openVoice = async () => {
    setIsVoiceOpen(true);
    naturalVoices(true).then((r) => setNatural(r.available ? r.voices : [])).catch(() => setNatural([]));
    setVoices(await listPortugueseVoices());
  };
  const chooseNatural = (v: NaturalVoice) => {
    setVoicePrefs({ engine: 'natural', natural: v.id });
    setVoicePrefsState(getVoicePrefs());
    speak('amostra', SAMPLE, { engine: 'natural', natural: v.id });
  };
  const chooseVoice = (v: VoiceOption) => {
    setVoicePrefs({ id: v.id, engine: 'device' });
    setVoicePrefsState(getVoicePrefs());
    speak('amostra', SAMPLE, { voiceId: v.id });
  };
  const chooseRate = (rate: number) => {
    setVoicePrefs({ rate });
    setVoicePrefsState(getVoicePrefs());
    speak('amostra', SAMPLE, { rate });
  };

  // Instituição parceira (B2B)
  const [isOrgOpen, setIsOrgOpen] = useState(false);
  // Mostra na hora a última informação salva no aparelho e atualiza quando o servidor responder.
  const cachedOrg = cacheGet<{ org: OrgInfo }>(getAuthState().user?.id, 'org');
  const [org, setOrgState] = useState<OrgInfo>(cachedOrg?.org ?? null);
  const [orgLoaded, setOrgLoaded] = useState(!!cachedOrg);
  const setOrg = (o: OrgInfo) => { setOrgState(o); cacheSet(getAuthState().user?.id, 'org', { org: o }); };
  const [orgCode, setOrgCode] = useState('');
  const [orgBusy, setOrgBusy] = useState(false);
  const [orgError, setOrgError] = useState<string | null>(null);
  useEffect(() => {
    noricaApi.orgStatus().then((r) => setOrg(r.org)).catch(() => {}).finally(() => setOrgLoaded(true));
  }, []);
  const joinOrg = async () => {
    setOrgBusy(true);
    setOrgError(null);
    try {
      const r = await noricaApi.orgJoin(orgCode);
      setOrg(r.org);
      setOrgCode('');
    } catch (err: any) {
      setOrgError(err?.message || 'Não foi possível entrar agora.');
    } finally {
      setOrgBusy(false);
    }
  };
  const pickSector = async (sectorId: string | null) => {
    setOrgBusy(true);
    setOrgError(null);
    try {
      const r = await noricaApi.orgSetSector(sectorId);
      setOrg(r.org);
    } catch (err: any) {
      setOrgError(err?.message || 'Não foi possível salvar agora.');
    } finally {
      setOrgBusy(false);
    }
  };

  const toggleSharePsi = async (share: boolean) => {
    if (share && !window.confirm('Compartilhar seu humor com a psicóloga da instituição?\n\nEla verá só o humor dos últimos 14 dias e um aviso se você tocar no S.O.S. Nunca suas conversas, diário ou Cofre. Você pode desligar quando quiser.')) return;
    setOrgBusy(true); setOrgError(null);
    try { setOrg((await noricaApi.orgSharePsi(share)).org); }
    catch (err: any) { setOrgError(err?.message || 'Não foi possível salvar agora.'); }
    finally { setOrgBusy(false); }
  };

  const leaveOrg = async () => {
    if (!window.confirm(`Sair de ${org?.name ?? 'a instituição'}? Você pode entrar de novo depois com o código.`)) return;
    setOrgBusy(true); setOrgError(null);
    try {
      await noricaApi.orgLeave();
      setOrg(null);
    } catch (err: any) {
      setOrgError(err?.message || 'Não foi possível sair agora.');
    } finally {
      setOrgBusy(false);
    }
  };

  const [health, setHealth] = useState<HealthReport | null>(null);
  const [isHealthOpen, setIsHealthOpen] = useState(false);
  const [healthError, setHealthError] = useState<string | null>(null);

  // Diagnóstico: confere banco, criptografia e IA de uma vez.
  const runHealth = async () => {
    setIsHealthOpen(true);
    setHealth(null);
    setHealthError(null);
    try {
      setHealth(await noricaApi.health());
    } catch (err: any) {
      setHealthError(err?.message || 'Não foi possível falar com o servidor. As funções do Supabase já foram publicadas?');
    }
  };

  const handleLogout = async () => {
    setIsExiting(true);
    // Aguarda animação de "afundar" antes de deslogar
    setTimeout(async () => {
      await import('@/lib/push').then((m) => m.stopPush()).catch(() => {});
      await supabase.auth.signOut();
      router.replace('/');
    }, 1500);
  };

  if (!isMounted) return null;

  return (
    <main data-leve="" className="min-h-screen relative overflow-x-hidden pb-40 selection:bg-emerald-500/10 bg-transparent">
      <AnimatedBackground subtle />
      
      <AnimatePresence>
        {isExiting && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-[#050810] flex items-center justify-center overflow-hidden touch-none overscroll-none"
            onWheel={(e) => e.preventDefault()}
            onTouchMove={(e) => e.preventDefault()}
          >
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-emerald-900/20 via-[#050810] to-[#050810]" />
            
            <div className="relative z-10 flex flex-col items-center justify-center">
              <div className="relative flex items-center justify-center mb-8">
                <div className="absolute w-24 h-24 rounded-full border border-emerald-500/20 css-ring" />
                <div className="absolute w-24 h-24 rounded-full border border-emerald-400/40 css-ring" style={{ ['--ring-from' as any]: 0.8, ['--ring-to' as any]: 2, animationDelay: '0.5s' }} />
                <div
                  className="css-pulse-scale w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center backdrop-blur-sm border border-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.3)] relative z-10"
                >
                  <Anchor size={40} className="text-emerald-400" />
                </div>
              </div>
              
              <div className="space-y-2 text-center relative z-10">
                <p className="text-emerald-400 font-black uppercase tracking-[0.4em] text-[11px] css-fade-pulse">
                  Desatracando
                </p>
                <p className="text-white/40 font-bold tracking-widest text-[9px] uppercase">Saindo do porto seguro</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="fixed top-0 inset-x-0 h-20 bg-white/5 backdrop-blur-2xl border-b border-white/10 z-50 flex items-center justify-center px-6 pt-[calc(env(safe-area-inset-top)+0.5rem)]">
        <h2 className="text-[11px] font-black text-emerald-400 uppercase tracking-[0.5em] italic">Seu espaço</h2>
      </header>

      <motion.div
        animate={isExiting ? { scale: 0.8, opacity: 0, y: 100 } : { scale: 1, opacity: 1, y: 0 }}
        transition={{ duration: 1.2, ease: "easeInOut" }}
        className="max-w-md mx-auto px-6 pt-32 relative z-10 space-y-8 stagger-in"
      >
        
        {/* Avatar Card */}
        <motion.div 
          whileTap={{ scale: 0.98 }}
          className="bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[4rem] p-10 shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] text-center space-y-6 relative overflow-hidden cursor-default"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/[0.03] rounded-bl-full -mr-8 -mt-8" />
          
          <div className="relative inline-block">
            {/* Timão Oscilante / Avatar */}
            <motion.div 
              className={`${avatarUrl ? '' : 'css-wobble '}w-32 h-32 bg-gradient-to-br from-emerald-500 via-teal-600 to-emerald-700 rounded-[3.2rem] flex items-center justify-center border-[6px] border-white/10 shadow-2xl relative z-10 overflow-hidden`}
            >
              {avatarUrl && !avatarFailed ? (
                <img
                  src={avatarUrl}
                  alt="Avatar"
                  referrerPolicy="no-referrer"
                  decoding="async"
                  onError={() => setAvatarFailed(true)}
                  className="w-full h-full object-cover pointer-events-none"
                />
              ) : (
                // Iniciais desenhadas no próprio app: nítidas em qualquer tela e sem depender da internet.
                <div className="w-full h-full bg-[#064e3b] flex items-center justify-center pointer-events-none">
                  <span className="text-[#34d399] text-4xl font-black tracking-tight">
                    {(name || 'Marujo').trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('')}
                  </span>
                </div>
              )}
            </motion.div>
          </div>

          <div className="space-y-1">
            <h1 className="text-3xl font-black text-white tracking-tighter uppercase italic min-h-[44px] flex items-center justify-center">
              {isDataLoaded ? <TypingName text={name || "Marujo"} /> : "..."}
            </h1>
            <p className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.4em]">Conta ativa</p>
          </div>
        </motion.div>

        {/* Data Form */}
        <motion.div 
          className="bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[3.5rem] p-8 shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] space-y-8 relative overflow-hidden"
        >
           <form onSubmit={handleUpdate} className="space-y-6 relative z-10">
              {error && (
                <div className="p-4 bg-rose-500/10 text-rose-400 text-xs font-bold rounded-2xl border border-rose-500/20 flex items-center gap-3">
                  <AlertCircle size={16} />
                  {error}
                </div>
              )}

              <div className="space-y-3">
                <label className="text-[10px] font-black text-white/40 uppercase tracking-widest px-2">Seus dados</label>
                <div className="relative group">
                  <div className="absolute left-6 top-1/2 -translate-y-1/2 text-emerald-400 group-focus-within:text-emerald-300 transition-colors">
                    <Fingerprint size={20} />
                  </div>
                  <input
                    disabled={isLocked || !isDataLoaded}
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Seu nome..."
                    className="w-full bg-white/5 border border-white/10 rounded-3xl px-16 py-5 outline-none focus:border-emerald-400 transition-all text-base font-bold text-white placeholder-white/20 disabled:opacity-60"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-white/40 uppercase tracking-widest px-2">Data de nascimento</label>
                <div className="relative group">
                  <div className="absolute left-6 top-1/2 -translate-y-1/2 text-emerald-400 group-focus-within:text-emerald-300 transition-colors">
                    <Calendar size={20} />
                  </div>
                  <input
                    disabled={isLocked || !isDataLoaded}
                    type="text"
                    placeholder="DD/MM/AAAA"
                    value={birthDate}
                    onChange={(e) => handleBirthDateChange(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-3xl px-16 py-5 outline-none focus:border-emerald-400 transition-all text-base font-bold text-white placeholder-white/20 disabled:opacity-60"
                  />
                </div>
                
                {/* CARD DE IDADE BONITO */}
                <AnimatePresence>
                  {age !== null && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      whileTap={{ scale: 0.98 }}
                      className="relative mt-4 p-6 rounded-[2.5rem] bg-gradient-to-br from-emerald-500 via-teal-600 to-emerald-700 text-white shadow-[0_8px_32px_0_rgba(0,0,0,0.2)] overflow-hidden border-2 border-white/20"
                    >
                      <div className="absolute -right-4 -top-4 text-white/10 rotate-12">
                         <ShipWheel size={120} />
                      </div>
                      <div className="relative z-10 flex items-center justify-between">
                        <div className="space-y-1">
                          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/70">Idade no Mar</p>
                          <h3 className="text-4xl font-black italic tracking-tighter leading-none">{age} <span className="text-xl">Anos</span></h3>
                        </div>
                        <div className="w-14 h-14 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/20">
                           <Waves size={28} className="text-white/80" />
                        </div>
                      </div>
                      <div className="mt-4 pt-4 border-t border-white/10 flex items-center gap-2">
                        <div className="h-1 flex-1 bg-white/20 rounded-full overflow-hidden">
                           <motion.div 
                            initial={{ width: 0 }}
                            whileInView={{ width: '100%' }}
                            viewport={{ once: true }}
                            transition={{ duration: 1.5, ease: "easeOut", delay: 0.4 }}
                            className="h-full bg-white/60"
                           />
                        </div>
                        <span className="text-[8px] font-black uppercase tracking-widest text-white/50">Jornada em Curso</span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {!isLocked ? (
                <div className="relative group">
                  <div className="absolute inset-0 bg-emerald-500/20 blur-xl group-hover:bg-emerald-400/30 transition-colors pointer-events-none rounded-2xl" />
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    disabled={loading || !isDataLoaded}
                    type="submit"
                    className="relative w-full py-5 bg-[#050810] rounded-2xl font-black text-[13px] uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-3 border border-emerald-500/50 hover:border-emerald-400 overflow-hidden text-emerald-400 hover:text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.15)] group-hover:shadow-[0_0_30px_rgba(16,185,129,0.3)]"
                  >
                    <div className="absolute inset-0 bg-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    {/* Linha de Scanner */}
                    <div className="absolute top-0 left-[-100%] w-[50%] h-full bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent skew-x-[-45deg]" style={{ animation: 'shimmer 2.5s infinite linear' }} />
                    <style dangerouslySetInnerHTML={{ __html: `@keyframes shimmer { 100% { left: 200%; } }` }} />
                    
                    <div className="relative flex items-center justify-center gap-3 z-10">
                      {loading ? <Loader2 className="animate-spin" size={20} /> : "Salvar perfil"}
                      {!loading && <ChevronRight size={18} strokeWidth={2.5} />}
                    </div>
                  </motion.button>
                </div>
              ) : (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileTap={{ scale: 0.98 }}
                  className="p-6 bg-white/5 border border-white/10 rounded-[2.5rem] flex items-center gap-4"
                >
                  <div className="w-12 h-12 bg-white/10 text-emerald-400 border border-white/10 rounded-2xl flex items-center justify-center shadow-sm">
                    <ShieldCheck size={24} />
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest leading-none">Perfil salvo</p>
                    <p className="text-[9px] font-bold text-white/40 uppercase mt-1 leading-none">Registro seguro no porto.</p>
                  </div>
                </motion.div>
              )}
           </form>
        </motion.div>

        {/* Logout */}
        <motion.button 
          whileTap={{ scale: 0.96 }}
          onClick={handleLogout}
          className="w-full flex items-center justify-between p-7 bg-white/5 border border-white/10 rounded-[2.5rem] shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] hover:bg-rose-500/10 hover:border-rose-500/20 transition-all group"
        >
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-2xl flex items-center justify-center group-hover:rotate-12 transition-transform">
                <LogOut size={24} />
             </div>
             <div className="text-left">
                <h3 className="text-sm font-black text-white uppercase tracking-tighter italic">Sair</h3>
                <p className="text-[9px] font-black text-rose-400 uppercase tracking-widest leading-none mt-1">Encerrar Sessão</p>
             </div>
          </div>
          <ChevronRight size={20} className="text-white/40 group-hover:translate-x-1 transition-transform" />
        </motion.button>

        {/* Plano */}
        <motion.button 
          whileTap={{ scale: 0.96 }}
          onClick={() => router.push('/planos/')}
          className="w-full flex items-center justify-between p-7 bg-white/5 border border-white/10 rounded-[2.5rem] shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] hover:bg-emerald-500/10 hover:border-emerald-500/20 transition-all group"
        >
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-2xl flex items-center justify-center group-hover:rotate-12 transition-transform">
                <Crown size={24} />
             </div>
             <div className="text-left">
                <h3 className="text-sm font-black text-white uppercase tracking-tighter italic">Meu Plano</h3>
                <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest leading-none mt-1">Gratuito e Pro</p>
             </div>
          </div>
          <ChevronRight size={20} className="text-white/40 group-hover:translate-x-1 transition-transform" />
        </motion.button>

        {/* Lembrete diário */}
        <motion.button 
          whileTap={{ scale: 0.96 }}
          onClick={() => { setReminderMsg(null); setNotifKey((k) => k + 1); setIsReminderOpen(true); }}
          className="w-full flex items-center justify-between p-7 bg-white/5 border border-white/10 rounded-[2.5rem] shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] hover:bg-sky-500/10 hover:border-sky-500/20 transition-all group"
        >
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 bg-sky-500/10 text-sky-400 border border-sky-500/20 rounded-2xl flex items-center justify-center group-hover:rotate-12 transition-transform">
                <Bell size={24} />
             </div>
             <div className="text-left">
                <h3 className="text-sm font-black text-white uppercase tracking-tighter italic">Notificações</h3>
                <p className="text-[9px] font-black text-sky-400 uppercase tracking-widest leading-none mt-1">
                  {reminder.enabled ? `Lembrete todo dia às ${formatTime(reminder)}` : 'Lembrete diário desligado'}
                </p>
             </div>
          </div>
          <ChevronRight size={20} className="text-white/40 group-hover:translate-x-1 transition-transform" />
        </motion.button>

        {/* Voz da Nórica */}
        <motion.button 
          whileTap={{ scale: 0.96 }}
          onClick={openVoice}
          className="w-full flex items-center justify-between p-7 bg-white/5 border border-white/10 rounded-[2.5rem] shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] hover:bg-teal-500/10 hover:border-teal-500/20 transition-all group"
        >
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 bg-teal-500/10 text-teal-300 border border-teal-500/20 rounded-2xl flex items-center justify-center group-hover:rotate-12 transition-transform">
                <Volume2 size={24} />
             </div>
             <div className="text-left">
                <h3 className="text-sm font-black text-white uppercase tracking-tighter italic">Voz da Nórica</h3>
                <p className="text-[9px] font-black text-teal-300 uppercase tracking-widest leading-none mt-1">Escolha a voz e a velocidade</p>
             </div>
          </div>
          <ChevronRight size={20} className="text-white/40 group-hover:translate-x-1 transition-transform" />
        </motion.button>

        {/* Leitura fácil */}
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={() => { const v = !easy; setEasy(v); setEasyReading(v); }}
          aria-pressed={easy}
          data-testid="leitura-facil"
          className="w-full flex items-center justify-between p-7 bg-white/5 border border-white/10 rounded-[2.5rem] shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] transition-all"
        >
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 bg-sky-500/10 text-sky-300 border border-sky-500/20 rounded-2xl flex items-center justify-center">
                <Type size={24} />
             </div>
             <div className="text-left">
                <h3 className="text-sm font-black text-white uppercase tracking-tighter italic">Leitura fácil</h3>
                <p className="text-[9px] font-black text-sky-300 uppercase tracking-widest leading-none mt-1">Letras maiores e menos animação</p>
             </div>
          </div>
          <span className={`w-12 h-7 rounded-full p-1 shrink-0 transition-colors ${easy ? 'bg-sky-500' : 'bg-white/15'}`}>
            <span className={`block w-5 h-5 rounded-full bg-white transition-transform ${easy ? 'translate-x-5' : ''}`} />
          </span>
        </motion.button>

        {/* Modo leve */}
        <button
          onClick={() => { const v = !light; setLight(v); setLightMode(v); }}
          aria-pressed={light}
          data-testid="modo-leve"
          className="w-full flex items-center justify-between p-7 bg-white/5 border border-white/10 rounded-[2.5rem] shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] active:scale-[0.98] transition-transform"
        >
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 rounded-2xl flex items-center justify-center">
                <Gauge size={24} />
             </div>
             <div className="text-left">
                <h3 className="text-sm font-black text-white uppercase tracking-tighter italic">Modo leve</h3>
                <p className="text-[9px] font-black text-emerald-300 uppercase tracking-widest leading-none mt-1">Fundo parado, app mais rápido</p>
             </div>
          </div>
          <span className={`w-12 h-7 rounded-full p-1 shrink-0 transition-colors ${light ? 'bg-emerald-500' : 'bg-white/15'}`}>
            <span className={`block w-5 h-5 rounded-full bg-white transition-transform ${light ? 'translate-x-5' : ''}`} />
          </span>
        </button>

        {/* Memória da Nórica */}
        <motion.button 
          whileTap={{ scale: 0.96 }}
          onClick={openMemory}
          className="w-full flex items-center justify-between p-7 bg-white/5 border border-white/10 rounded-[2.5rem] shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] hover:bg-violet-500/10 hover:border-violet-500/20 transition-all group"
        >
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 bg-violet-500/10 text-violet-300 border border-violet-500/20 rounded-2xl flex items-center justify-center group-hover:rotate-12 transition-transform">
                <Brain size={24} />
             </div>
             <div className="text-left">
                <h3 className="text-sm font-black text-white uppercase tracking-tighter italic">Memória da Nórica</h3>
                <p className="text-[9px] font-black text-violet-300 uppercase tracking-widest leading-none mt-1">O que ela lembra de você</p>
             </div>
          </div>
          <ChevronRight size={20} className="text-white/40 group-hover:translate-x-1 transition-transform" />
        </motion.button>

        {/* Plano de segurança */}
        <motion.button 
          whileTap={{ scale: 0.96 }}
          onClick={() => router.push('/plano-seguranca/')}
          className="w-full flex items-center justify-between p-7 bg-white/5 border border-white/10 rounded-[2.5rem] shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] hover:bg-rose-500/10 hover:border-rose-500/20 transition-all group"
        >
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 bg-rose-500/10 text-rose-300 border border-rose-500/20 rounded-2xl flex items-center justify-center group-hover:rotate-12 transition-transform">
                <ClipboardList size={24} />
             </div>
             <div className="text-left">
                <h3 className="text-sm font-black text-white uppercase tracking-tighter italic">Plano de Segurança</h3>
                <p className="text-[9px] font-black text-rose-300 uppercase tracking-widest leading-none mt-1">Pessoas de confiança e o que te acalma</p>
             </div>
          </div>
          <ChevronRight size={20} className="text-white/40 group-hover:translate-x-1 transition-transform" />
        </motion.button>

        {/* Instituição parceira (escola, cursinho, empresa) */}
        <motion.button 
          whileTap={{ scale: 0.96 }}
          onClick={() => { setOrgError(null); setIsOrgOpen(true); }}
          className="w-full flex items-center justify-between p-7 bg-white/5 border border-white/10 rounded-[2.5rem] shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] hover:bg-amber-500/10 hover:border-amber-500/20 transition-all group"
        >
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 bg-amber-500/10 text-amber-300 border border-amber-500/20 rounded-2xl flex items-center justify-center group-hover:rotate-12 transition-transform">
                <Building2 size={24} />
             </div>
             <div className="text-left">
                <h3 className="text-sm font-black text-white uppercase tracking-tighter italic">Instituição Parceira</h3>
                <p className="text-[9px] font-black text-amber-300 uppercase tracking-widest leading-none mt-1">
                  {!orgLoaded ? '...' : org ? org.name : 'Escola, cursinho ou empresa'}
                </p>
             </div>
          </div>
          <ChevronRight size={20} className="text-white/40 group-hover:translate-x-1 transition-transform" />
        </motion.button>

        {/* Privacidade */}
        <motion.button 
          whileTap={{ scale: 0.96 }}
          onClick={() => router.push('/privacidade/')}
          className="w-full flex items-center justify-between p-7 bg-white/5 border border-white/10 rounded-[2.5rem] shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] hover:bg-teal-500/10 hover:border-teal-500/20 transition-all group"
        >
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 bg-teal-500/10 text-teal-400 border border-teal-500/20 rounded-2xl flex items-center justify-center group-hover:rotate-12 transition-transform">
                <ShieldCheck size={24} />
             </div>
             <div className="text-left">
                <h3 className="text-sm font-black text-white uppercase tracking-tighter italic">Privacidade</h3>
                <p className="text-[9px] font-black text-teal-400 uppercase tracking-widest leading-none mt-1">Como cuidamos dos seus dados</p>
             </div>
          </div>
          <ChevronRight size={20} className="text-white/40 group-hover:translate-x-1 transition-transform" />
        </motion.button>

        {/* Excluir conta (LGPD + Google Play) */}
        <motion.button 
          whileTap={{ scale: 0.96 }}
          onClick={() => { setDeleteText(''); setDeleteError(null); setIsDeleteOpen(true); }}
          className="w-full flex items-center justify-between p-7 bg-white/5 border border-white/10 rounded-[2.5rem] shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] hover:bg-rose-500/10 hover:border-rose-500/20 transition-all group"
        >
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-2xl flex items-center justify-center group-hover:rotate-12 transition-transform">
                <Trash2 size={24} />
             </div>
             <div className="text-left">
                <h3 className="text-sm font-black text-white uppercase tracking-tighter italic">Excluir Minha Conta</h3>
                <p className="text-[9px] font-black text-rose-400 uppercase tracking-widest leading-none mt-1">Apaga todos os seus dados</p>
             </div>
          </div>
          <ChevronRight size={20} className="text-white/40 group-hover:translate-x-1 transition-transform" />
        </motion.button>

        <p className="text-center text-[10px] font-black text-white/20 uppercase tracking-[0.5em] italic pt-10">
          Nórica • Cuidado de todo dia
        </p>
        <p className="text-center text-[10px] font-bold text-white/25 tracking-widest" data-testid="versao">Versão {pkg.version} ({pkg.versionCode})</p>
        <button
          onClick={runHealth}
          className="block mx-auto text-[9px] font-black text-white/20 hover:text-emerald-400 uppercase tracking-[0.3em] transition-colors"
        >
          Verificar sistema
        </button>
      </motion.div>
      <AnimatePresence>
        {isVoiceOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { stopSpeaking(); setIsVoiceOpen(false); }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000]" />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 260 }}
              className="fixed inset-x-0 bottom-0 z-[1001] bg-[#0b0f19] border-t border-white/10 rounded-t-[2.5rem] p-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] shadow-2xl max-w-lg mx-auto max-h-[85dvh] overflow-y-auto"
            >
              <div className="flex items-center gap-3 mb-5">
                <div className="w-12 h-12 rounded-2xl bg-teal-500/15 text-teal-300 flex items-center justify-center"><Volume2 size={22} /></div>
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-tighter leading-none">Voz da Nórica</h3>
                  <p className="text-[9px] font-black text-teal-300 uppercase tracking-widest mt-1">Toque para ouvir e escolher</p>
                </div>
              </div>
              {natural && natural.length > 0 && (
                <div className="space-y-2 mb-5" data-testid="vozes-naturais">
                  <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">Vozes naturais · mais humanas</p>
                  <div className="grid grid-cols-2 gap-2">
                    {natural.map((v) => {
                      const active = voicePrefs.engine === 'natural' && voicePrefs.natural === v.id;
                      return (
                        <button key={v.id} onClick={() => chooseNatural(v)} className={`p-3 rounded-2xl border text-left ${active ? 'bg-teal-500/15 border-teal-400/40' : 'bg-white/5 border-white/10'}`}>
                          <span className="block text-[12px] font-black text-white">{v.label}</span>
                          <span className={`block text-[9px] font-black uppercase tracking-widest mt-1 ${active ? 'text-teal-300' : 'text-white/30'}`}>{active ? 'Escolhida' : 'Ouvir'}</span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-white/40 font-semibold">Usa internet. Sem conexão, a Nórica lê com a voz do celular.</p>
                  <p className="text-[10px] font-black text-white/40 uppercase tracking-widest pt-3">Vozes do celular</p>
                </div>
              )}
              {!voices ? (
                <div className="flex items-center gap-3 text-white/60 text-sm font-bold py-6 justify-center">
                  <Loader2 size={18} className="animate-spin" /> Procurando vozes...
                </div>
              ) : voices.length === 0 ? (
                <div className="space-y-3 mb-5">
                  <p className="text-sm text-white/60 font-semibold leading-relaxed">Seu celular não tem voz em português instalada.</p>
                  <button onClick={openVoiceInstall} className="w-full py-4 rounded-2xl bg-teal-500 text-slate-950 font-black uppercase tracking-widest text-[10px]">Instalar vozes</button>
                </div>
              ) : (
                <div className="space-y-2 mb-5">
                  {voices.map((v) => {
                    const active = (voicePrefs.engine === 'device' || !natural?.length) && (voicePrefs.id ? voicePrefs.id === v.id : v === voices[0]);
                    return (
                      <button
                        key={v.id}
                        onClick={() => chooseVoice(v)}
                        className={`w-full flex items-center justify-between gap-3 p-4 rounded-2xl border text-left ${active ? 'bg-teal-500/15 border-teal-400/40' : 'bg-white/5 border-white/10'}`}
                      >
                        <span>
                          <span className="block text-[12px] font-black text-white">{v.label}</span>
                          <span className="block text-[10px] text-white/40 font-semibold mt-0.5">{v.natural ? 'Mais natural · usa internet' : 'Funciona sem internet'}</span>
                        </span>
                        <span className={`text-[9px] font-black uppercase tracking-widest ${active ? 'text-teal-300' : 'text-white/30'}`}>{active ? 'Escolhida' : 'Ouvir'}</span>
                      </button>
                    );
                  })}
                </div>
              )}
              <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-3">Velocidade</p>
              <div className="grid grid-cols-3 gap-2 mb-5">
                {RATES.map((r) => (
                  <button
                    key={r.value}
                    onClick={() => chooseRate(r.value)}
                    className={`py-3 rounded-2xl border text-[11px] font-black ${voicePrefs.rate === r.value ? 'bg-teal-500/20 border-teal-400/40 text-teal-200' : 'bg-white/5 border-white/10 text-white/60'}`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-white/45 font-semibold leading-relaxed mb-4">
                Dica: para a voz mais natural, deixe o Google como mecanismo de voz do celular (Configurações → Gerenciamento geral → Saída de texto para voz → Mecanismo preferido: Google).
              </p>
              <button onClick={() => { stopSpeaking(); setIsVoiceOpen(false); }} className="w-full py-3 text-white/40 font-black uppercase tracking-widest text-[10px]">
                Fechar
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOrgOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !orgBusy && setIsOrgOpen(false)} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000]" />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 260 }}
              className="fixed inset-x-0 bottom-0 z-[1001] bg-[#0b0f19] border-t border-white/10 rounded-t-[2.5rem] p-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] shadow-2xl max-w-lg mx-auto max-h-[85dvh] overflow-y-auto"
            >
              <div className="flex items-center gap-3 mb-5">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-300 flex items-center justify-center"><Building2 size={22} /></div>
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-tighter leading-none">Instituição parceira</h3>
                  <p className="text-[9px] font-black text-amber-300 uppercase tracking-widest mt-1">Escola, cursinho ou empresa</p>
                </div>
              </div>
              {org ? (
                <div className="space-y-4">
                  <p className="text-sm text-white/70 font-semibold leading-relaxed">
                    Você faz parte de <b className="text-white">{org.name}</b>. A instituição vê apenas números somados de todo o grupo (por exemplo, "30% marcaram ansioso esta semana"), nunca o que você escreve ou marca.
                  </p>
                  {!!org.sectors?.length && (
                    <div className="space-y-2" data-testid="escolher-setor">
                      <p className="text-[10px] font-black text-white/50 uppercase tracking-widest">{['Turma', 'Equipe', 'Unidade'].includes(org.sectorLabel || 'Setor') ? 'Sua' : 'Seu'} {(org.sectorLabel || 'Setor').toLowerCase()}</p>
                      <div className="flex flex-wrap gap-2">
                        {org.sectors.map((sec) => (
                          <button
                            key={sec.id}
                            disabled={orgBusy}
                            onClick={() => pickSector(org.sectorId === sec.id ? null : sec.id)}
                            className={`px-3 py-2 rounded-full text-xs font-black border ${org.sectorId === sec.id ? 'bg-amber-400/20 border-amber-300/40 text-amber-200' : 'bg-white/5 border-white/10 text-white/60'}`}
                          >
                            {sec.name}
                          </button>
                        ))}
                      </div>
                      <p className="text-[10px] text-white/40 font-semibold">Serve só para os números somados do grupo. Ninguém vê o que você marca.</p>
                    </div>
                  )}
                  {org.role === 'member' && org.psi?.enabled && (
                    <div className="p-4 rounded-2xl bg-rose-400/5 border border-rose-300/20 space-y-3" data-testid="compartilhar-psi">
                      <div className="flex items-start gap-3">
                        <div className="flex-1">
                          <p className="text-sm font-black text-white leading-tight">Compartilhar meu humor com a psicóloga</p>
                          <p className="text-[11px] text-white/55 font-semibold leading-relaxed mt-1">
                            A psicóloga de {org.name} vê só o humor dos seus últimos 14 dias e recebe um aviso se você tocar no S.O.S — para poder te oferecer uma conversa. <b className="text-white/75">Nunca</b> conversas, diário ou Cofre.
                          </p>
                        </div>
                        <button
                          role="switch"
                          aria-checked={!!org.psi.share}
                          aria-label="Compartilhar meu humor com a psicóloga"
                          disabled={orgBusy}
                          onClick={() => toggleSharePsi(!org.psi?.share)}
                          className={`shrink-0 w-12 h-7 rounded-full p-1 transition-colors ${org.psi.share ? 'bg-rose-400' : 'bg-white/15'}`}
                          data-testid="toggle-psi"
                        >
                          <span className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${org.psi.share ? 'translate-x-5' : ''}`} />
                        </button>
                      </div>
                      <p className="text-[10px] text-white/40 font-semibold leading-relaxed">É escolha sua e dá para desligar a qualquer momento. Se você tem menos de 18 anos, a instituição precisa da autorização do seu responsável.</p>
                    </div>
                  )}
                  {org.role === 'admin' && (
                    <button onClick={() => router.push('/painel/')} className="w-full py-4 rounded-2xl bg-amber-400 text-slate-950 font-black uppercase tracking-widest text-[10px]">
                      {org.psi?.isPsi ? 'Abrir painel de cuidado' : 'Abrir painel da instituição'}
                    </button>
                  )}
                  <button onClick={leaveOrg} disabled={orgBusy} className="w-full py-4 rounded-2xl bg-white/5 border border-white/10 text-white/60 font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2" data-testid="sair-instituicao">
                    <LogOut size={14} /> Sair da instituição
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-white/60 font-semibold leading-relaxed">
                    Se a sua escola, cursinho ou empresa é parceira da Nórica, digite o código que ela passou. A instituição verá só números anônimos do grupo — nunca suas conversas, Cofre, diário ou o seu humor individual.
                  </p>
                  <input
                    value={orgCode}
                    onChange={(e) => setOrgCode(e.target.value.toUpperCase())}
                    placeholder="CÓDIGO"
                    className="w-full bg-black/30 border border-white/10 rounded-2xl p-4 text-center text-lg font-black tracking-[0.3em] text-white outline-none focus:border-amber-400/50 placeholder:text-white/20"
                  />
                  <button onClick={joinOrg} disabled={orgBusy || orgCode.trim().length < 4} className="w-full py-4 rounded-2xl bg-amber-400 text-slate-950 font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 disabled:opacity-40">
                    {orgBusy && <Loader2 size={14} className="animate-spin" />} Entrar
                  </button>
                  <div className="pt-4 mt-2 border-t border-white/5 space-y-2">
                    <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">É da direção, coordenação ou RH?</p>
                    <button onClick={() => { setIsOrgOpen(false); router.push('/instituicao/'); }} className="w-full py-4 rounded-2xl bg-white/5 border border-amber-300/30 text-amber-200 font-black uppercase tracking-widest text-[10px]" data-testid="criar-instituicao">
                      Criar minha instituição · 30 dias grátis
                    </button>
                    <button onClick={() => { setIsOrgOpen(false); router.push('/empresas/'); }} className="w-full py-3 text-white/45 font-black uppercase tracking-widest text-[10px] underline underline-offset-4">
                      Conhecer a Nórica para escolas e empresas
                    </button>
                  </div>
                </div>
              )}
              {orgError && <p className="text-rose-400 text-xs font-bold mt-4">{orgError}</p>}
              <button onClick={() => setIsOrgOpen(false)} className="w-full mt-4 py-3 text-white/40 font-black uppercase tracking-widest text-[10px]">
                Fechar
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isMemoryOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !memoryBusy && setIsMemoryOpen(false)} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000]" />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 260 }}
              className="fixed inset-x-0 bottom-0 z-[1001] bg-[#0b0f19] border-t border-white/10 rounded-t-[2.5rem] p-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] shadow-2xl max-w-lg mx-auto max-h-[85dvh] overflow-y-auto"
            >
              <div className="flex items-center gap-3 mb-5">
                <div className="w-12 h-12 rounded-2xl bg-violet-500/15 text-violet-300 flex items-center justify-center"><Brain size={22} /></div>
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-tighter leading-none">Memória da Nórica</h3>
                  <p className="text-[9px] font-black text-violet-300 uppercase tracking-widest mt-1">Para você não precisar recontar tudo</p>
                </div>
              </div>
              <p className="text-sm text-white/60 font-semibold leading-relaxed mb-5">
                A Nórica guarda um resumo curto das suas conversas (pessoas importantes, temas e o que costuma te ajudar) para lembrar nas próximas. Fica criptografado e só você vê.
              </p>
              {!memory && !memoryError && (
                <div className="flex items-center gap-3 text-white/60 text-sm font-bold py-6 justify-center">
                  <Loader2 size={18} className="animate-spin" /> Carregando...
                </div>
              )}
              {memoryError && <p className="text-rose-400 text-sm font-bold mb-4">{memoryError}</p>}
              {memory && (
                <div className="space-y-5">
                  <button
                    onClick={toggleMemory}
                    disabled={memoryBusy}
                    className="w-full flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/10"
                  >
                    <span className="text-[11px] font-black text-white/80 uppercase tracking-widest">Lembrar das minhas conversas</span>
                    <span className={`w-12 h-7 rounded-full p-1 transition-colors ${memory.enabled ? 'bg-violet-500' : 'bg-white/15'}`}>
                      <span className={`block w-5 h-5 rounded-full bg-white transition-transform ${memory.enabled ? 'translate-x-5' : ''}`} />
                    </span>
                  </button>
                  <div>
                    <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-3">O que ela lembra agora</p>
                    {memory.items.length ? (
                      <ul className="space-y-2">
                        {memory.items.map((item, i) => (
                          <li key={i} className="flex gap-3 text-sm text-white/75 font-semibold leading-relaxed">
                            <span className="mt-2 w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" /> {item}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-white/40 font-semibold">
                        {memory.enabled ? 'Ainda nada. A memória se forma depois de algumas conversas no Porto.' : 'Memória desligada.'}
                      </p>
                    )}
                  </div>
                  {memory.items.length > 0 && (
                    confirmClear ? (
                      <div className="flex gap-2">
                        <button onClick={clearMemory} disabled={memoryBusy} className="flex-1 py-4 rounded-2xl bg-rose-500 text-white font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2">
                          {memoryBusy && <Loader2 size={14} className="animate-spin" />} Sim, apagar
                        </button>
                        <button onClick={() => setConfirmClear(false)} className="flex-1 py-4 rounded-2xl bg-white/5 border border-white/10 text-white/60 font-black uppercase tracking-widest text-[10px]">
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmClear(true)} className="w-full py-4 rounded-2xl bg-white/5 border border-rose-500/30 text-rose-300 font-black uppercase tracking-widest text-[10px]">
                        Apagar tudo que a Nórica lembra
                      </button>
                    )
                  )}
                </div>
              )}
              <button onClick={() => setIsMemoryOpen(false)} className="w-full mt-4 py-3 text-white/40 font-black uppercase tracking-widest text-[10px]">
                Fechar
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isReminderOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !reminderBusy && setIsReminderOpen(false)} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000]" />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 260 }}
              className="fixed inset-x-0 bottom-0 z-[1001] bg-[#0b0f19] border-t border-white/10 rounded-t-[2.5rem] p-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] shadow-2xl max-w-lg mx-auto max-h-[80dvh] overflow-y-auto"
            >
              <div className="flex items-center gap-3 mb-5">
                <div className="w-12 h-12 rounded-2xl bg-sky-500/15 text-sky-400 flex items-center justify-center"><Bell size={22} /></div>
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-tighter leading-none">Notificações</h3>
                  <p className="text-[9px] font-black text-sky-400 uppercase tracking-widest mt-1">“Como está o seu mar hoje?”</p>
                </div>
              </div>
              <p className="text-sm text-white/60 font-semibold leading-relaxed mb-5">
                Um convite por dia, no horário que você escolher, para registrar seu mar ou conversar no Porto. Funciona mesmo sem internet.
              </p>
              <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-3">Horário</p>
              <div className="grid grid-cols-4 gap-2 mb-3">
                {['08:00', '12:30', '20:00', '22:00'].map((t) => (
                  <button
                    key={t}
                    onClick={() => setReminderTime(t)}
                    className={`py-3 rounded-2xl border text-xs font-black transition-all ${reminderTime === t ? 'bg-sky-500/20 border-sky-400/40 text-sky-300' : 'bg-white/5 border-white/10 text-white/60'}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <label className="flex items-center justify-between gap-3 p-4 rounded-2xl bg-white/5 border border-white/10 mb-5">
                <span className="text-[10px] font-black text-white/50 uppercase tracking-widest">Outro horário</span>
                <input
                  type="time"
                  value={reminderTime}
                  onChange={(e) => e.target.value && setReminderTime(e.target.value)}
                  className="bg-transparent text-white font-black text-sm outline-none [color-scheme:dark]"
                />
              </label>
              <PermitirNotificacoes key={notifKey} />
              {reminderMsg && <p className="text-xs font-bold text-sky-300 mb-4 leading-relaxed">{reminderMsg}</p>}
              <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-3">Outros avisos</p>
              <div className="space-y-2 mb-5">
                {([
                  ['weekly', 'Resumo da semana', 'Domingo às 19h'],
                  ['streak', 'Sequência dos Logs', 'Para não perder seus dias seguidos'],
                  ['comeback', 'Sentimos sua falta', 'Depois de 3 dias sem abrir o app'],
                  ['evening', 'Como foi o seu dia?', '21h, responde direto na notificação'],
                  ['water', 'Beber água', '10h e 15h'],
                  ['sun', 'Luz do dia', '9h30, 10 minutos de sol'],
                  ['movement', 'Pausa de movimento', '16h, 2 minutos de alongamento'],
                ] as const).map(([key, label, hint]) => (
                  <button
                    key={key}
                    onClick={async () => { await setNotificationPref(key, !reminder[key]); setReminder({ ...getReminder() }); }}
                    className="w-full flex items-center justify-between gap-3 p-4 rounded-2xl bg-white/5 border border-white/10 text-left"
                  >
                    <span>
                      <span className="block text-[11px] font-black text-white/80 uppercase tracking-widest">{label}</span>
                      <span className="block text-[10px] text-white/40 font-semibold mt-0.5">{hint}</span>
                    </span>
                    <span className={`w-12 h-7 rounded-full p-1 shrink-0 transition-colors ${reminder[key] ? 'bg-sky-500' : 'bg-white/15'}`}>
                      <span className={`block w-5 h-5 rounded-full bg-white transition-transform ${reminder[key] ? 'translate-x-5' : ''}`} />
                    </span>
                  </button>
                ))}
              </div>
              <div className="flex flex-col gap-3">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  disabled={reminderBusy}
                  onClick={() => saveReminder(true)}
                  className="w-full py-4 rounded-2xl bg-sky-500 text-slate-950 font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2"
                >
                  {reminderBusy && <Loader2 size={14} className="animate-spin" />}
                  {reminder.enabled ? 'Salvar horário' : 'Ligar lembrete'}
                </motion.button>
                {reminder.enabled && (
                  <button
                    disabled={reminderBusy}
                    onClick={() => saveReminder(false)}
                    className="w-full py-4 rounded-2xl bg-white/5 border border-white/10 text-white/60 font-black uppercase tracking-widest text-[10px]"
                  >
                    Desligar lembrete
                  </button>
                )}
                <button
                  disabled={reminderBusy}
                  onClick={testReminder}
                  className="w-full py-3 rounded-2xl border border-dashed border-sky-500/30 text-sky-300 font-black uppercase tracking-widest text-[10px]"
                >
                  Enviar notificação de teste
                </button>
                <button onClick={() => setIsReminderOpen(false)} className="w-full py-3 text-white/40 font-black uppercase tracking-widest text-[10px]">
                  Fechar
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isHealthOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsHealthOpen(false)} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000]" />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 260 }}
              className="fixed inset-x-0 bottom-0 z-[1001] bg-[#0b0f19] border-t border-white/10 rounded-t-[2.5rem] p-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] shadow-2xl max-w-lg mx-auto max-h-[80dvh] overflow-y-auto"
            >
              <h3 className="text-sm font-black text-white uppercase tracking-tighter mb-1">Verificação do sistema</h3>
              <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-5">Banco, criptografia e IA</p>
              {!health && !healthError && (
                <div className="flex items-center gap-3 text-white/60 text-sm font-bold py-6 justify-center">
                  <Loader2 size={18} className="animate-spin" /> Testando...
                </div>
              )}
              {healthError && <p className="text-rose-400 text-sm font-bold">{healthError}</p>}
              {health && (
                <div className="space-y-2">
                  <p className={`text-sm font-black mb-3 ${health.ok ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {health.ok ? 'Tudo funcionando ✓' : 'Algo precisa de atenção'}
                  </p>
                  {Object.entries(health.checks).map(([name, c]) => (
                    <div key={name} className="flex items-start gap-3 text-xs">
                      <span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${c.ok ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                      <div>
                        <p className="font-black text-white/80 uppercase tracking-wider text-[10px]">{name.replace(/_/g, ' ')}</p>
                        {c.detail && <p className="text-white/40 break-all">{c.detail}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <button onClick={() => setIsHealthOpen(false)} className="w-full mt-6 py-4 rounded-2xl bg-white/10 text-white font-black uppercase tracking-widest text-[10px]">
                Fechar
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isDeleteOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !isDeleting && setIsDeleteOpen(false)} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000]" />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 260 }}
              className="fixed inset-x-0 bottom-0 z-[1001] bg-[#0b0f19] border-t border-white/10 rounded-t-[2.5rem] p-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] shadow-2xl max-w-lg mx-auto"
            >
              <div className="flex items-center gap-3 mb-5">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/15 text-rose-400 flex items-center justify-center">
                  <Trash2 size={22} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-tighter leading-none">Excluir conta</h3>
                  <p className="text-[9px] font-black text-rose-400 uppercase tracking-widest mt-1">Esta ação não pode ser desfeita</p>
                </div>
              </div>
              <p className="text-sm text-white/70 font-semibold leading-relaxed mb-4">
                Vamos apagar sua conta, seu perfil, todas as conversas do Porto, seus registros de humor, seus Logs e o Cofre.
                Para confirmar, digite <b className="font-black text-rose-400">EXCLUIR</b>.
              </p>
              <input
                value={deleteText}
                onChange={(e) => setDeleteText(e.target.value)}
                placeholder="EXCLUIR"
                autoCapitalize="characters"
                className="w-full mb-4 px-6 py-4 rounded-2xl bg-white/5 border border-white/10 outline-none text-white font-black tracking-widest focus:ring-4 ring-rose-500/20"
              />
              {deleteError && <p className="text-rose-400 text-[10px] font-black uppercase tracking-widest mb-4">{deleteError}</p>}
              <div className="flex flex-col gap-3">
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleteText.trim().toUpperCase() !== 'EXCLUIR' || isDeleting}
                  className="w-full py-4 rounded-2xl bg-rose-500 text-white font-black uppercase tracking-widest text-[10px] disabled:opacity-30 flex items-center justify-center gap-2"
                >
                  {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  {isDeleting ? 'Excluindo...' : 'Excluir definitivamente'}
                </button>
                <button
                  onClick={() => setIsDeleteOpen(false)}
                  disabled={isDeleting}
                  className="w-full py-4 rounded-2xl bg-white/5 border border-white/10 text-white/80 font-black uppercase tracking-widest text-[10px]"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </main>
  );
}



