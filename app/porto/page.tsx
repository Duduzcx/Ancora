// @ts-nocheck
"use client";

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Bot, User, Anchor, ArrowLeft, Clock, Loader2, Mic, MicOff, Search, Edit2, Copy, Sparkles, Trash2, SendHorizontal } from 'lucide-react';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { createClient } from '@/lib/supabase-client';
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

const SYSTEM_PROMPT = `Você é a "Nórica", a inteligência artificial de navegação mental e bem-estar do aplicativo Nórica. Sua função é atuar como uma guia paciente e compreensiva, mantendo um tom de conversa natural, caloroso e humano. 

Regras Absolutas de Resposta (Siga estritamente):
1. Espelhamento de Energia: Se o usuário mandar uma mensagem curta (ex: 'Oi', 'Tudo bem?'), responda de forma igualmente curta, amigável e termine com uma pergunta aberta. NUNCA envie um bloco grande de texto para uma saudação.
2. Foco na Interação: Aja como um diálogo real. Em vez de vomitar toda a informação ou um plano completo de uma vez, entregue a informação em partes curtas e pergunte ao usuário se faz sentido ou como ele quer prosseguir.
3. Direto ao ponto: Elimine introduções clichês e vá direto ao valor que o usuário pediu, usando formatação rica em Markdown (listas dinâmicas, cronogramas visuais, negrito) para facilitar a leitura.
4. Acolhimento e Empatia: Aja como uma parceira dedicada a ajudar o usuário a concluir seus objetivos passo a passo. Seja calorosa, natural e sempre ofereça um espaço seguro para reflexão.
5. Limitações Médicas: NUNCA prometa resultados clínicos. Evite estritamente termos médicos como 'diagnóstico', 'tratamento', 'cura', 'ansiedade', 'depressão' ou 'transtorno'.
6. Proibição de Palavra: NUNCA use a palavra 'Âncora' sob nenhuma circunstância.`;

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
    setInput(message.content);
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
        await supabase.from('messages').delete().eq('id', messageId);
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

        // Se houver chatId no Supabase, deleta a última mensagem do usuário e a resposta da IA
        if (chatId) {
          const idsToDelete = messages.slice(lastUserIdx).map(m => m.id);
          if (idsToDelete.length > 0) {
            await supabase.from('messages').delete().in('id', idsToDelete);
          }
        }
      }
    }
    
    setStreamingMessageId(null);

    try {
      await Haptics.notification({ type: 'WARN' }); // Vibração de aviso de cancelamento
    } catch (e) {}
  };

  const generateResponse = async (currentMessages: any[], activeChatIdParam?: string) => {
    const activeChatId = activeChatIdParam || chatId;
    let requestSuccessful = false;
    let botMessageId = "";

    try {
      let activeSystemPrompt = SYSTEM_PROMPT;
      const hasClaraWelcome = messages.some(m => m.content && m.content.includes("Clara Silveira"));
      if (action === 'suporte-b2b' || hasClaraWelcome) {
        activeSystemPrompt = `Você é Clara Silveira, especialista em bem-estar e autoconhecimento parceira do aplicativo Nórica. Sua missão é ser um espaço de apoio reflexivo e orientação de bem-estar pessoal e profissional para o usuário.
        
Regras de comunicação e comportamento:
1. Apresente-se como Clara Silveira se apropriado (ou aja como ela).
2. NUNCA use a palavra 'Âncora' sob nenhuma circunstância.
3. Mantenha um tom calmo, acolhedor, profissional e de bem-estar.
4. Use formatação em Markdown (como **negrito** para destacar pontos importantes, listas para organizar ideias) para deixar a leitura agradável.
5. Termine com UMA única pergunta reflexiva ou de escuta ativa.`;
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Authorization": `Bearer ${process.env.NEXT_PUBLIC_GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [
            { role: "system", content: activeSystemPrompt },
            ...currentMessages.map(m => ({ role: m.role, content: m.content }))
          ],
          temperature: 0.7,
          max_tokens: 500,
          stream: true
        }),
      });

      if (!response.ok) {
        throw new Error("Erro na resposta do Groq");
      }

      requestSuccessful = true;
      botMessageId = (Date.now() + 1).toString();

      setAnimatedIds(prev => {
        const next = new Set(prev);
        next.add(botMessageId);
        return next;
      });
      setMessages(prev => [...prev, { id: botMessageId, role: 'assistant', content: "" }]);
      setStreamingMessageId(botMessageId);
      setIsLoading(false);

      const reader = response.body?.getReader();
      const decoder = new TextDecoder("utf-8");
      let done = false;
      let botText = "";
      let buffer = "";

      if (!reader) {
        throw new Error("Não foi possível ler a resposta.");
      }

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          buffer += decoder.decode(value, { stream: !done });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            if (trimmed.startsWith("data: ")) {
              const dataStr = trimmed.slice(6);
              if (dataStr === "[DONE]") {
                break;
              }
              try {
                const parsed = JSON.parse(dataStr);
                const content = parsed.choices?.[0]?.delta?.content || "";
                if (content) {
                  botText += content;
                  setMessages(prev => prev.map(m => m.id === botMessageId ? { ...m, content: botText } : m));
                }
              } catch (err) {}
            }
          }
        }
      }

      if (buffer) {
        const trimmed = buffer.trim();
        if (trimmed.startsWith("data: ")) {
          const dataStr = trimmed.slice(6);
          if (dataStr !== "[DONE]") {
            try {
              const parsed = JSON.parse(dataStr);
              const content = parsed.choices?.[0]?.delta?.content || "";
              if (content) {
                botText += content;
                setMessages(prev => prev.map(m => m.id === botMessageId ? { ...m, content: botText } : m));
              }
            } catch (err) {}
          }
        }
      }

      // Salvar mensagem do bot e gerar resumo
      if (activeChatId) {
        await supabase.from('messages').insert({
          chat_id: activeChatId,
          role: 'assistant',
          content: botText
        });

        // Gerar Título Inteligente em background após a 2a troca de mensagens (quando length for 3 ou 4)
        if (currentMessages.length === 3 || currentMessages.length === 4) {
          // Fire and forget (não usa await para não travar a resposta da IA)
          (async () => {
            try {
              // Pegar as 3 primeiras mensagens como contexto
              const contextoMensagens = currentMessages.slice(0, 3).map(m => `${m.role}: ${m.content}`).join('\n');
              const summaryResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${process.env.NEXT_PUBLIC_GROQ_API_KEY}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  model: "llama-3.1-8b-instant",
                  messages: [
                    { role: "system", content: "Analise este início de conversa. Crie um título inteligente, curto, acolhedor e empático (máximo de 3 a 4 palavras) que resuma o verdadeiro tema, dor ou sentimento do usuário. Retorne estritamente o título gerado, sem aspas, sem introduções e sem ponto final." },
                    { role: "user", content: contextoMensagens }
                  ],
                  temperature: 0.5,
                }),
              });
              const summaryData = await summaryResponse.json();
              const summary = summaryData.choices?.[0]?.message?.content?.replace(/["']/g, '');
              if (summary) {
                await supabase.from('chats').update({ title: summary }).eq('id', activeChatId);
                setChatTitle(summary);
              }
            } catch (e) {
              console.error("Erro ao gerar resumo em background:", e);
            }
          })();
        }

        // Extração de Sentimentos (Logs Diários do Farol) em background
        const userMessagesCount = currentMessages.filter(m => m.role === 'user').length;
        if (userMessagesCount === 3 || userMessagesCount === 6) {
          (async () => {
            try {
              const contextoCompleto = currentMessages.map(m => `${m.role}: ${m.content}`).join('\n');
              const aiResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${process.env.NEXT_PUBLIC_GROQ_API_KEY}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  model: "llama-3.1-8b-instant",
                  response_format: { type: "json_object" },
                  messages: [
                    { role: "system", content: "Analise esta conversa. Retorne APENAS UM JSON válido com três chaves estritas: 'humor_predominante' (deve ser exatamente 'calmo', 'ansioso', 'agitado' ou 'sos'), 'assunto_principal' (máximo 3 palavras) e 'conselho_curto' (uma frase de 10 palavras acolhedora baseada no que foi dito)." },
                    { role: "user", content: contextoCompleto }
                  ],
                  temperature: 0.3,
                }),
              });
              const aiData = await aiResponse.json();
              const jsonString = aiData.choices?.[0]?.message?.content;
              if (jsonString) {
                const parsed = JSON.parse(jsonString);
                if (parsed.humor_predominante) {
                  const { data: { session } } = await supabase.auth.getSession();
                  if (session?.user) {
                    const today = new Date().toLocaleDateString('en-CA');
                    await supabase.from('daily_logs').upsert({
                      user_id: session.user.id,
                      date: today,
                      humor: parsed.humor_predominante,
                      assunto: parsed.assunto_principal,
                      conselho: parsed.conselho_curto
                    }, { onConflict: 'user_id, date' });
                  }
                }
              }
            } catch (e) {
              console.error("Erro ao gerar log diário em background:", e);
            }
          })();
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return;
      }
      setMessages(prev => [...prev, { id: 'error', role: 'assistant', content: "⚠️ Sinal fraco no Porto. Verifique sua conexão." }]);
      setIsResponding(false);
    } finally {
      setIsLoading(false);
      setStreamingMessageId(null);
      if (!requestSuccessful) {
        setIsResponding(false);
      }
      setTimeout(() => {
        isInitializingNewChat.current = false;
      }, 1000);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading || isResponding) return;

    if (editingMessageId) {
      const targetIndex = messages.findIndex(m => m.id === editingMessageId);
      if (targetIndex !== -1) {
        const updatedMessages = [...messages];
        updatedMessages[targetIndex] = { ...updatedMessages[targetIndex], content: input };
        const truncatedMessages = updatedMessages.slice(0, targetIndex + 1);
        setMessages(truncatedMessages);
        setEditingMessageId(null);
        
        setIsLoading(true);
        setIsResponding(true);
        cancelarRef.current = false;
        setInput("");

        try {
          if (chatId) {
            await supabase.from('messages').update({ content: input }).eq('id', editingMessageId);
            const messagesToDelete = messages.slice(targetIndex + 1).map(m => m.id);
            if (messagesToDelete.length > 0) {
              await supabase.from('messages').delete().in('id', messagesToDelete);
            }
          }
          await generateResponse(truncatedMessages);
        } catch (err) {
          console.error("Erro ao editar mensagem:", err);
          setIsLoading(false);
          setIsResponding(false);
        }
      }
      return;
    }

    const userMessage = { id: Date.now().toString(), role: 'user', content: input };
    const currentMessages = [...messages, userMessage];
    setMessages(currentMessages);
    setInput("");

    setIsLoading(true);
    setIsResponding(true);
    cancelarRef.current = false;

    try {
      let activeChatId = chatId;
      const { data: { session } } = await supabase.auth.getSession();
      
      // 1. Criar Chat se não existir
      if (!activeChatId && session?.user) {
        isInitializingNewChat.current = true;
        const { data: newChat } = await supabase
          .from('chats')
          .insert({ 
            user_id: session.user.id, 
            title: "Nova Conversa"
          })
          .select()
          .single();
        
        if (newChat) {
          activeChatId = newChat.id;
          // Salvar mensagem de boas-vindas inicial se houver
          const welcomeMsg = messages.find(m => m.id === 'welcome');
          if (welcomeMsg) {
            await supabase.from('messages').insert({
              chat_id: activeChatId,
              role: 'assistant',
              content: welcomeMsg.content
            });
          }
          router.replace(`/porto/?chatId=${activeChatId}`, { scroll: false });
        }
      }

      // 2. Salvar mensagem do usuário
      if (activeChatId) {
        await supabase.from('messages').insert({
          chat_id: activeChatId,
          role: 'user',
          content: userMessage.content
        });
      }

      await generateResponse(currentMessages, activeChatId);
    } catch (err) {
      console.error(err);
      setIsLoading(false);
      setIsResponding(false);
    }
  };

  useEffect(() => {
    setIsMounted(true);
    const initialize = async () => {
      // Se estamos no meio de criar um chat novo no handleSendMessage, NÃO sobrescrevemos o estado
      if (isInitializingNewChat.current) return;

      // Se já temos mensagens e o chatId não mudou drasticamente (ou seja, não estamos vindo de uma navegação lateral)
      // poderíamos evitar o fetch, mas para garantir sincronia com histórico, fazemos o fetch apenas se chatId existir
      if (chatId) {
        const { data: chatData } = await supabase.from('chats').select('title').eq('id', chatId).single();
        if (chatData?.title) {
          setChatTitle(chatData.title);
        }
        
        const { data: history } = await supabase.from('messages').select('id, role, content').eq('chat_id', chatId).order('created_at', { ascending: true });
        if (history && history.length > 0) {
          setMessages(history.map(m => ({ id: m.id, role: m.role, content: m.content })));
        }
      } else {
        // Nova conversa (sem chatId)
        let initialGreeting;
        if (action === 'revisar-metas' || action === 'revisar-reflexao') {
          initialGreeting = "Oi! Vi que você quer revisar suas reflexões e hábitos hoje. Como foi seu progresso no autoconhecimento nessa semana? ⚓✨";
        } else if (action === 'suporte-b2b') {
          initialGreeting = "Olá! Sou Clara Silveira, especialista em bem-estar pela parceria Nórica. Como posso apoiar você hoje? Nosso espaço é seguro, acolhedor e focado no seu bem-estar pessoal. ⚓💙";
        } else {
          const pool = greetingPool[humor] || greetingPool.default;
          initialGreeting = pool[Math.floor(Math.random() * pool.length)];
        }
        setMessages([{ id: 'welcome', role: 'assistant', content: initialGreeting }]);
      }
    };
    initialize();
  }, [chatId, humor, action]); // Removi o messages.length da dependência para evitar loops, e agora ele limpa se chatId for nulo.

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
      const formData = new FormData();
      formData.append('file', blob, 'recording.webm');
      formData.append('model', 'whisper-large-v3');
      formData.append('language', 'pt');

      const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.NEXT_PUBLIC_GROQ_API_KEY}`,
        },
        body: formData,
      });

      const data = await response.json();
      if (data.text) {
        setInput(data.text);
        // Opcional: Enviar automaticamente após transcrever
        // handleSendMessage(null, data.text);
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
    autor: m.role === 'user' ? 'User' : 'IA'
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
          msg.autor === 'IA' ? (
            <MensagemIA 
              key={msg.id} 
              textoOriginal={msg.texto} 
              isStreaming={msg.id === streamingMessageId}
              shouldAnimate={animatedIds.has(msg.id)}
              cancelarRef={cancelarRef}
              onFinalizado={() => setIsResponding(false)} 
            />
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
