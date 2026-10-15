// @ts-nocheck
"use client";

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Bot, User, Anchor, ArrowLeft, Clock, Loader2, Mic, MicOff, Search, Edit2, Copy, Sparkles, Trash2, SendHorizontal, LifeBuoy, Plus, CheckCircle2 } from 'lucide-react';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { createClient } from '@/lib/supabase-client';
import { noricaApi, toMood, addTasksToToday } from '@/lib/norica-api';
import { HelpSheet, CrisisCard } from '@/components/AjudaAgora';
import ChatHistorySidebar from '@/components/ChatHistorySidebar';
import AnimatedBackground from '@/components/AnimatedBackground';
import SafeMarkdown from '@/components/SafeMarkdown';
import { MensagemIA } from '@/components/MensagemIA';
import TextareaAutosize from 'react-textarea-autosize';

const greetingPool = {
  calmo: ["Maré serena. É o momento ideal para aprofundarmos nossa reflexão diária e mapeamento de hábitos. O que deseja explorar? 🌊", "Que bom que o mar está tranquilo hoje. Vamos aproveitar essa calmaria para refletir?"],
  ansioso: ["Percebo uma leve agitação nas águas. Faça uma pausa comigo. O Porto é seu lugar de reflexão e bem-estar. ⚓", "A neblina está um pouco densa? Vamos clarear o horizonte juntos."],
  agitado: ["As ondas estão altas, mas o seu barco é forte. Estou aqui para ajudar você a encontrar seus insights emocionais. 🌪️", "O mar está revolto, mas você está seguro aqui. Vamos baixar as velas um pouco?"],
  sos: ["Detectei uma maré alta. Vamos fazer uma pausa para realizar uma reflexão guiada. Respire fundo... ⚓", "Sinal de pausa recebido. Vamos estabilizar seus pensamentos e encontrar equilíbrio agora."],
  neblina: ["O horizonte está mais claro agora, não está? **Que bom que você persistiu.** Agora que a neblina baixou, como posso te apoiar na sua reflexão diária aqui no Porto? ⚓✨", "Vejo que você limpou o caminho. Respire fundo... o pior da tempestade já passou. Estou aqui para te ouvir. 🌊💙"],
  default: ["Bem-vindo ao Porto. Como posso te ajudar nas suas reflexões de bem-estar hoje? ⚓", "As portas do Porto estão abertas para seus insights emocionais."]
};

// O prompt da IA (Nórica e Clara) agora fica no servidor: supabase/functions/_shared/safety.ts

function PortoContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const chatId = searchParams.get('chatId');
  const humor = searchParams.get('humor') || 'default';
  const action = searchParams.get('action');
  const supabase = createClient();
  const [chatTitle, setChatTitle] = useState("Nova Conversa");
  const [messages, setMessages] = useState<any[]>([]);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [animatedIds, setAnimatedIds] = useState<Set<string>>(new Set());
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isResponding, setIsResponding] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isInitializingNewChat = useRef(false);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);

  // Refs para controle de parada imediata e AbortController do Groq
  const cancelarRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Humor vindo da Início (cards) ou do S.O.S vai para a IA como contexto.
  const mood = toMood(humor === 'neblina' ? 'sos' : humor);
  const prefill = searchParams.get('prompt') || '';
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [addedTasks, setAddedTasks] = useState<Record<string, boolean>>({});

  const handleAddTasks = async (messageId: string, tasks: string[]) => {
    try {
      await addTasksToToday(tasks);
      setAddedTasks(prev => ({ ...prev, [messageId]: true }));
      triggerHapticsLight();
    } catch (err) {
      console.error("Erro ao adicionar tarefas:", err);
    }
  };

  // Haptic feedback helpers
  const triggerHapticsLight = async () => {
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch (e) {
      // Fail silently on non-mobile/unsupported environments
    }
  };

  const triggerHapticsMedium = async () => {
    try {
      await Haptics.impact({ style: ImpactStyle.Medium });
    } catch (e) {
      // Fail silently
    }
  };

  // Tooltip & Long Press states/handlers
  const [activeTooltipMessageId, setActiveTooltipMessageId] = useState<string | null>(null);
  const longPressTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const startLongPress = (messageId: string) => {
    if (longPressTimeoutRef.current) clearTimeout(longPressTimeoutRef.current);
    longPressTimeoutRef.current = setTimeout(() => {
      setActiveTooltipMessageId(messageId);
      triggerHapticsMedium();
    }, 500);
  };

  const endLongPress = () => {
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
  };

  const handleTapStart = (messageId: string) => {
    startLongPress(messageId);
  };

  const handleTap = () => {
    endLongPress();
  };

  const handleTapCancel = () => {
    endLongPress();
  };

  const handleCopyMessage = (text: string) => {
    navigator.clipboard.writeText(text);
    setActiveTooltipMessageId(null);
  };

  const handleEditMessage = (message: any) => {
    setInput(message.content ?? message.texto);
    setEditingMessageId(message.id);
    setActiveTooltipMessageId(null);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    setMessages(prev => prev.filter(m => m.id !== messageId));
    setActiveTooltipMessageId(null);
    try {
      if (chatId) {
        await noricaApi.deleteMessages(chatId, [messageId]);
      }
    } catch (err) {
      console.error("Erro ao deletar mensagem:", err);
    }
  };

  const handleElaborateMessage = async (messageContent: string) => {
    setActiveTooltipMessageId(null);
    const elaboratePrompt = `Poderia me aprofundar e elaborar mais sobre o seguinte ponto: "${messageContent}"?`;
    handleSendMessage(null, elaboratePrompt);
  };

  const pararRespostaIA = async () => {
    cancelarRef.current = true;
    setIsResponding(false);
    setIsLoading(false);
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Encontra a última mensagem enviada pelo usuário para resgatar o prompt e remove o resto do chat
    const userMessages = messages.filter(m => m.role === 'user');
    if (userMessages.length > 0) {
      const lastUserMsg = userMessages[userMessages.length - 1];
      setInput(lastUserMsg.content); // Devolve o texto exato para o input
      
      // Encontra o index da última mensagem do usuário
      const lastUserIdx = messages.findLastIndex(m => m.role === 'user');
      if (lastUserIdx !== -1) {
        // Corta as mensagens para remover a última mensagem do usuário e qualquer resposta incompleta da IA
        const truncated = messages.slice(0, lastUserIdx);
        setMessages(truncated);

        // Apaga no servidor a última mensagem e a resposta (que pode chegar alguns segundos depois).
        if (chatId) {
          const anchor = truncated.slice().reverse().find(m => /^[0-9a-f-]{36}$/.test(String(m.id)));
          const afterId = anchor ? String(anchor.id) : null;
          noricaApi.deleteAfter(chatId, afterId).catch(() => {});
          setTimeout(() => { noricaApi.deleteAfter(chatId, afterId).catch(() => {}); }, 20000);
        }
      }
    }
    
    setStreamingMessageId(null);

    try {
      await Haptics.notification({ type: 'WARN' }); // Vibração de aviso de cancelamento
    } catch (e) {}
  };

  // A resposta vem da Edge Function: login obrigatório, chave da IA no servidor,
  // mensagens criptografadas, protocolo de crise e resumo do dia para o Farol.
  const generateResponse = async (text: string, opts: { regenerate?: boolean; tempUserId?: string } = {}) => {
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const isClara = action === 'suporte-b2b' || messages.some(m => m.content && m.content.includes("Clara"));
    const welcomeMsg = !chatId ? messages.find(m => m.id === 'welcome') : undefined;
    if (!chatId) isInitializingNewChat.current = true;

    try {
      const result = await noricaApi.chat(text, chatId, {
        mood,
        persona: isClara ? 'clara' : 'norica',
        welcome: welcomeMsg?.content,
        regenerate: opts.regenerate,
        signal: controller.signal,
      });
      if (cancelarRef.current) return;

      if (!chatId && result.chatId) {
        router.replace(`/porto/?chatId=${result.chatId}${action ? `&action=${action}` : ''}${humor !== 'default' ? `&humor=${encodeURIComponent(humor)}` : ''}`, { scroll: false });
      }
      if (result.title) setChatTitle(result.title);

      const botMessageId = result.assistantMessageId || (Date.now() + 1).toString();
      setAnimatedIds(prev => new Set(prev).add(botMessageId));
      setMessages(prev => [
        ...prev.map(m => (opts.tempUserId && m.id === opts.tempUserId && result.userMessageId) ? { ...m, id: result.userMessageId } : m),
        ...(result.crisis ? [{ id: `crisis-${Date.now()}`, role: 'crisis', content: '' }] : []),
        { id: botMessageId, role: 'assistant', content: result.reply, tasks: result.tasks || [] },
      ]);
      setIsLoading(false);
      if (result.crisis) setIsHelpOpen(true);
    } catch (err: any) {
      if (err?.name === 'AbortError' || cancelarRef.current) return;
      setMessages(prev => [...prev, { id: `error-${Date.now()}`, role: 'assistant', content: `⚠️ ${err?.message || "Sinal fraco no Porto. Verifique sua conexão."}` }]);
      setIsResponding(false);
    } finally {
      setIsLoading(false);
      setStreamingMessageId(null);
      setTimeout(() => {
        isInitializingNewChat.current = false;
      }, 1000);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent | null, overrideText?: string) => {
    e?.preventDefault?.();
    const text = (overrideText ?? input).trim();
    if (!text || isLoading || isResponding) return;

    if (editingMessageId && !overrideText) {
      const targetIndex = messages.findIndex(m => m.id === editingMessageId);
      if (targetIndex !== -1) {
        const updatedMessages = [...messages];
        updatedMessages[targetIndex] = { ...updatedMessages[targetIndex], content: text };
        setMessages(updatedMessages.slice(0, targetIndex + 1));
        const editedId = editingMessageId;
        setEditingMessageId(null);
        setIsLoading(true);
        setIsResponding(true);
        cancelarRef.current = false;
        setInput("");
        try {
          if (chatId) {
            await noricaApi.editMessage(chatId, editedId, text);
            await generateResponse(text, { regenerate: true });
          }
        } catch (err: any) {
          console.error("Erro ao editar mensagem:", err);
          setMessages(prev => [...prev, { id: `error-${Date.now()}`, role: 'assistant', content: `⚠️ ${err?.message || "Não foi possível editar agora."}` }]);
          setIsLoading(false);
          setIsResponding(false);
        }
      }
      return;
    }

    const tempUserId = `tmp-${Date.now()}`;
    setMessages(prev => [...prev, { id: tempUserId, role: 'user', content: text }]);
    if (!overrideText) setInput("");
    setIsLoading(true);
    setIsResponding(true);
    cancelarRef.current = false;
    await generateResponse(text, { tempUserId });
  };

  useEffect(() => {
    setIsMounted(true);
    const initialize = async () => {
      // Se estamos no meio de criar um chat novo no handleSendMessage, NÃO sobrescrevemos o estado
      if (isInitializingNewChat.current) return;

      // Se já temos mensagens e o chatId não mudou drasticamente (ou seja, não estamos vindo de uma navegação lateral)
      // poderíamos evitar o fetch, mas para garantir sincronia com histórico, fazemos o fetch apenas se chatId existir
      if (chatId) {
        try {
          const { messages: history, title } = await noricaApi.history(chatId);
          if (title) setChatTitle(title);
          if (history && history.length > 0) {
            setMessages(history.map(m => ({ id: m.id, role: m.role, content: m.content })));
          }
        } catch (err) {
          console.error("Erro ao carregar conversa:", err);
        }
      } else {
        // Nova conversa (sem chatId)
        let initialGreeting;
        if (action === 'revisar-metas' || action === 'revisar-reflexao') {
          initialGreeting = "Oi! Vi que você quer revisar suas reflexões e hábitos hoje. Como foi seu progresso no autoconhecimento nessa semana? ⚓✨";
        } else if (action === 'suporte-b2b') {
          initialGreeting = "Olá! Sou a Clara, assistente virtual de bem-estar da parceria Nórica. Como posso apoiar você hoje? Nosso espaço é seguro, acolhedor e focado no seu bem-estar pessoal. ⚓💙";
        } else {
          const pool = greetingPool[humor] || greetingPool.default;
          initialGreeting = pool[Math.floor(Math.random() * pool.length)];
        }
        setMessages([{ id: 'welcome', role: 'assistant', content: initialGreeting }]);
        // Atalhos do Farol chegam com uma sugestão pronta para enviar.
        if (prefill) setInput(prefill);
      }
    };
    initialize();
  }, [chatId, humor, action, prefill]); // Removi o messages.length da dependência para evitar loops, e agora ele limpa se chatId for nulo.

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Tentar encontrar o melhor tipo suportado
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg']
        .find(type => MediaRecorder.isTypeSupported(type)) || '';

      mediaRecorder.current = new MediaRecorder(stream, { mimeType });
      audioChunks.current = [];

      mediaRecorder.current.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunks.current.push(event.data);
      };

      mediaRecorder.current.onstop = async () => {
        const audioBlob = new Blob(audioChunks.current, { type: mediaRecorder.current?.mimeType || 'audio/webm' });
        await transcribeAudio(audioBlob);
      };

      mediaRecorder.current.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Erro ao acessar microfone:", err);
      alert("Não foi possível acessar o microfone. Verifique as permissões.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current && isRecording) {
      mediaRecorder.current.stop();
      setIsRecording(false);
      mediaRecorder.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const transcribeAudio = async (blob: Blob) => {
    setIsTranscribing(true);
    try {
      const text = await noricaApi.transcribe(blob);
      if (text) {
        setInput(text);
      }
    } catch (err) {
      console.error("Erro na transcrição:", err);
    } finally {
      setIsTranscribing(false);
    }
  };

  const mensagens = messages.map((m) => ({
    id: m.id,
    texto: m.content,
    autor: m.role === 'user' ? 'User' : m.role === 'crisis' ? 'Crise' : 'IA',
    tasks: (m.tasks || []) as string[],
  }));
  const inputTexto = input;
  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);

  const handleTouchStart = (e: any) => {
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: any) => {
    const deltaX = e.changedTouches[0].clientX - touchStartXRef.current;
    const deltaY = e.changedTouches[0].clientY - touchStartYRef.current;
    
    // Se o movimento horizontal for maior que o vertical e da esquerda para a direita (distância > 60px)
    if (Math.abs(deltaX) > Math.abs(deltaY) && deltaX > 60) {
      setIsHistoryOpen(true);
    }
  };

  return (
    <div className="fixed inset-0 w-full h-[100dvh] flex flex-col bg-[#050810] overflow-hidden font-sans overscroll-none" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <AnimatedBackground subtle={false} />
      <ChatHistorySidebar isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} />

      {/* Botão de Voltar - Flutuando no topo esquerdo */}
      <button 
        onClick={() => router.back()}
        className="absolute top-6 left-4 z-50 p-2.5 rounded-full bg-white/5 backdrop-blur-md border border-white/10 shadow-sm active:scale-90 transition-all text-teal-400 hover:bg-white/10 flex items-center justify-center"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      {/* Botão de Histórico Flutuante Absoluto (Âncora) */}
      <button 
        onClick={(e) => {
          e.stopPropagation();
          setIsHistoryOpen(true);
        }}
        className="absolute top-6 right-4 z-50 p-2.5 rounded-full bg-white/5 backdrop-blur-md border border-white/10 shadow-sm active:scale-90 transition-all text-teal-400 hover:bg-white/10 flex items-center justify-center"
        title="Abrir Histórico"
      >
        <Anchor className="w-6 h-6" />
      </button>

      {/* Ajuda humana agora (CVV 188 / SAMU 192) */}
      <button 
        onClick={(e) => { e.stopPropagation(); setIsHelpOpen(true); }}
        className="absolute top-[4.75rem] right-4 z-50 p-2.5 rounded-full bg-rose-500/10 backdrop-blur-md border border-rose-500/30 shadow-sm active:scale-90 transition-all text-rose-400 hover:bg-rose-500/20 flex items-center justify-center"
        title="Preciso de ajuda agora"
        aria-label="Preciso de ajuda agora"
      >
        <LifeBuoy className="w-6 h-6" />
      </button>
      <HelpSheet open={isHelpOpen} onClose={() => setIsHelpOpen(false)} />

      {/* Título da Conversa no Topo */}
      <div className="absolute top-6 left-20 right-20 z-40 flex justify-center items-center pointer-events-none">
        <motion.div 
          key={chatTitle}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/5 backdrop-blur-md border border-white/10 px-4 py-2.5 rounded-full shadow-sm max-w-full pointer-events-auto cursor-default"
        >
          <span className="text-sm font-bold text-teal-400 truncate block text-center max-w-[150px] sm:max-w-[300px]">
            {chatTitle}
          </span>
        </motion.div>
      </div>

      <div 
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="flex-1 w-full h-full flex flex-col relative z-10"
      >
        {/* ÁREA DE MENSAGENS: Começa do topo (justify-start) e tem um pb-28 para a barra não cobrir a última mensagem */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 flex flex-col justify-start space-y-4 pb-28 pt-[calc(env(safe-area-inset-top,24px)+5rem)] relative">
        {mensagens.map((msg) => (
          msg.autor === 'Crise' ? (
            <div key={msg.id} className="self-start w-full"><CrisisCard /></div>
          ) : msg.autor === 'IA' ? (
            <div key={msg.id} className="flex flex-col gap-2">
              <MensagemIA 
                textoOriginal={msg.texto} 
                isStreaming={msg.id === streamingMessageId}
                shouldAnimate={animatedIds.has(msg.id)}
                cancelarRef={cancelarRef}
                onFinalizado={() => setIsResponding(false)} 
              />
              {msg.tasks.length > 0 && !isResponding && (
                addedTasks[msg.id] ? (
                  <div className="flex items-center gap-2 text-teal-400 text-[10px] font-black uppercase tracking-widest pl-2">
                    <CheckCircle2 size={14} /> Adicionado aos seus Logs de hoje
                  </div>
                ) : (
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => handleAddTasks(msg.id, msg.tasks)}
                    className="self-start flex items-center gap-2 px-4 py-2.5 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-300 text-[10px] font-black uppercase tracking-widest hover:bg-teal-500/20 transition-all"
                  >
                    <Plus size={14} /> Adicionar {msg.tasks.length} {msg.tasks.length === 1 ? 'passo' : 'passos'} aos Logs
                  </motion.button>
                )
              )}
            </div>
          ) : (
            <motion.div 
              key={msg.id} 
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="group relative self-end max-w-[85%] ml-auto flex flex-col items-end"
            >
              <div 
                className="p-4 bg-teal-500/30 backdrop-blur-md border border-teal-500/20 text-white rounded-3xl rounded-tr-sm break-words w-full font-sans cursor-pointer active:scale-[0.99] transition-transform"
                onClick={() => setActiveTooltipMessageId(activeTooltipMessageId === msg.id ? null : msg.id)}
              >
                {msg.texto}
              </div>
              <AnimatePresence>
                {activeTooltipMessageId === msg.id && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.9 }}
                    className="absolute -top-12 right-0 bg-slate-800 border border-white/10 rounded-2xl p-1.5 flex gap-1 shadow-xl z-30"
                  >
                    <button onClick={() => handleEditMessage(msg)} className="p-2 hover:bg-white/10 rounded-xl text-teal-400 flex flex-col items-center gap-1 active:scale-90 transition-all">
                      <Edit2 size={14} />
                      <span className="text-[8px] font-bold uppercase tracking-widest">Editar</span>
                    </button>
                    <button onClick={() => handleCopyMessage(msg.texto)} className="p-2 hover:bg-white/10 rounded-xl text-blue-400 flex flex-col items-center gap-1 active:scale-90 transition-all">
                      <Copy size={14} />
                      <span className="text-[8px] font-bold uppercase tracking-widest">Copiar</span>
                    </button>
                    <button onClick={() => handleElaborateMessage(msg.texto)} className="p-2 hover:bg-white/10 rounded-xl text-amber-400 flex flex-col items-center gap-1 active:scale-90 transition-all">
                      <Sparkles size={14} />
                      <span className="text-[8px] font-bold uppercase tracking-widest">Aprofundar</span>
                    </button>
                    <div className="w-[1px] bg-white/10 mx-1 my-1" />
                    <button onClick={() => handleDeleteMessage(msg.id)} className="p-2 hover:bg-white/10 rounded-xl text-rose-400 flex flex-col items-center gap-1 active:scale-90 transition-all">
                      <Trash2 size={14} />
                      <span className="text-[8px] font-bold uppercase tracking-widest">Excluir</span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )
        ))}
        {isLoading && (
          <div className="p-5 rounded-[2rem] rounded-tl-none bg-white/5 border border-white/10 text-slate-400 w-fit font-sans">
            <div className="flex gap-1.5">
              <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* BARRA DE DIGITAÇÃO: Fixa na base, integrada com o botão unificado */}
      <div className="absolute bottom-0 left-0 w-full p-4 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent z-20 font-sans">
        <div className={`flex items-end gap-2 bg-white/10 border rounded-3xl pl-4 pr-2 py-1.5 w-full max-w-2xl mx-auto backdrop-blur-2xl transition-colors ${editingMessageId !== null ? 'border-amber-500/40 bg-amber-500/5' : 'border-white/20'}`}>
          
          <TextareaAutosize 
            ref={inputRef as any}
            value={inputTexto}
            onChange={(e) => setInput(e.target.value)}
            disabled={isResponding && editingMessageId === null}
            minRows={1}
            maxRows={5}
            placeholder={
              isResponding 
                ? "Nórica está digitando..." 
                : editingMessageId !== null 
                  ? "Editando sua mensagem..." 
                  : "Inicie sua reflexão diária aqui..."
            }
            className="flex-1 bg-transparent border-none outline-none py-2.5 text-white placeholder-slate-400 text-[16px] resize-none leading-relaxed"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (inputTexto.trim()) handleSendMessage();
              }
            }}
          />

          {/* Lógica de Botão Inteligente Unificado com Edição */}
          <div className="pb-1">
          {isResponding ? (
            // ESTADO 1: Parar Resposta
            <button 
              type="button"
              onClick={(e) => { e.preventDefault(); pararRespostaIA(); }}
              className="flex items-center justify-center w-10 h-10 rounded-full bg-slate-800 hover:bg-slate-700 active:scale-95 transition-all z-50 cursor-pointer text-white"
            >
              <div className="w-3.5 h-3.5 bg-white rounded-[2px]"></div>
            </button>
          ) : editingMessageId !== null ? (
            // ESTADO 2: Salvar Edição
            <button 
              onClick={handleSendMessage}
              disabled={!inputTexto.trim()}
              className={`flex items-center justify-center w-10 h-10 rounded-full transition-all cursor-pointer ${
                !inputTexto.trim() 
                  ? 'bg-amber-500/10 text-amber-500/30 cursor-not-allowed' 
                  : 'bg-amber-500 text-slate-950 active:scale-95'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
              </svg>
            </button>
          ) : inputTexto.trim().length > 0 ? (
            // ESTADO 3: Enviar Mensagem (Aparece só quando digita)
            <motion.button 
              whileTap={{ scale: 0.85, x: 5, y: -5 }}
              onClick={handleSendMessage}
              className="flex items-center justify-center w-10 h-10 rounded-full bg-teal-500 text-slate-950 hover:bg-teal-400 transition-colors cursor-pointer shadow-md shadow-teal-500/20"
            >
              <SendHorizontal size={20} className="-ml-0.5" />
            </motion.button>
          ) : (
            // ESTADO 4: Microfone / Áudio (Padrão)
            <div className="relative flex items-center">
              {isRecording && (
                <div className="absolute right-12 flex items-center gap-1 h-10 px-3 bg-rose-500/10 border border-rose-500/20 rounded-full mr-2">
                  {[1, 2, 3, 4, 5].map(i => (
                    <motion.div 
                      key={i} 
                      animate={{ height: ['4px', '20px', '4px'] }} 
                      transition={{ duration: 0.4 + i*0.1, repeat: Infinity, ease: "easeInOut", repeatDelay: 0 }} 
                      className="w-1 bg-rose-500 rounded-full" 
                    />
                  ))}
                  <span className="text-xs text-rose-500 ml-2 font-bold animate-pulse">Gravando...</span>
                </div>
              )}
              <button 
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isTranscribing}
                className={`flex items-center justify-center w-10 h-10 rounded-full transition-all cursor-pointer ${
                  isRecording 
                    ? 'bg-rose-500/80 text-white animate-pulse shadow-[0_0_20px_rgba(244,63,94,0.4)]' 
                    : 'text-teal-400 hover:bg-white/5 active:scale-95'
                }`}
              >
                {isTranscribing ? (
                  <Loader2 className="animate-spin w-5 h-5" />
                ) : isRecording ? (
                  <MicOff className="w-5 h-5" />
                ) : (
                  <Mic className="w-5 h-5" />
                )}
              </button>
            </div>
          )}
          </div>

        </div>
        {/* Aviso de cancelamento de edição se houver */}
        {editingMessageId !== null && (
          <center>
            <button 
              onClick={() => { setEditingMessageId(null); setInput(''); }} 
              className="text-xs text-slate-500 mt-2 hover:text-slate-400 cursor-pointer"
            >
              Cancelar edição
            </button>
          </center>
        )}
      </div>
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
      `}</style>
    </div>
  );
}

export default function PortoPage() {
  return (
    <Suspense fallback={
      <div className="h-screen w-full bg-transparent flex flex-col items-center justify-center relative overflow-hidden">
        <AnimatedBackground subtle={false} />
        <Loader2 className="text-emerald-400 animate-spin relative z-10" size={32} />
      </div>
    }>
      <PortoContent />
    </Suspense>
  );
}
