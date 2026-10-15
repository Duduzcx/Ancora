"use client";

import React, { useEffect, useState } from 'react';
import { Plus, MessageSquare, Clock, X, ArrowLeft, Anchor, Search, Trash2 } from 'lucide-react';
import { noricaApi } from '@/lib/norica-api';
import { createClient } from '@/lib/supabase-client';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

interface Chat {
  id: string;
  title: string;
  created_at: string;
}

interface ChatHistorySidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function ChatHistorySidebar({ isOpen, onClose }: ChatHistorySidebarProps) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentChatId = searchParams.get('chatId');

  const fetchChats = async () => {
    // Check de sessão rápido
    const { data: { session } } = await supabase.auth.getSession();
    const sessionUser = session?.user;
    setUser(sessionUser);

    if (sessionUser) {
      // Títulos ficam criptografados no banco; o servidor devolve já legíveis.
      const data = await noricaApi.listChats().then(r => r.chats).catch(() => null);

      if (data) {
        setChats(data);
        // Prefetch das conversas para navegação instantânea
        data.slice(0, 5).forEach((chat: any) => {
          router.prefetch(`/porto/?chatId=${chat.id}`);
        });
      }
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchChats();
  }, []);

  const handleDeleteChat = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm('Apagar esta conversa para sempre?')) return;
    try {
      await noricaApi.deleteChat(id);
      setChats((prev: any[]) => prev.filter(c => c.id !== id));
      if (currentChatId === id) router.push('/porto/');
    } catch (err) {
      console.error("Erro ao apagar conversa:", err);
    }
  }; // Carrega apenas uma vez no mount para poupar recursos

  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      fetchChats(); // Refresh history when opening
    } else {
      document.body.style.overflow = 'unset';
    }
  }, [isOpen]);

  const handleNewChat = () => {
    // Ao navegar para /porto sem chatId, o useEffect no porto/page.tsx 
    // agora está configurado para resetar as mensagens.
    router.push('/porto/');
    if (onClose) onClose();
  };

  const handleSelectChat = (id: string) => {
    router.push(`/porto/?chatId=${id}`);
    if (onClose) onClose();
  };

  const filteredChats = chats.filter(chat =>
    chat.title?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <>
      {/* Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]"
          />
        )}
      </AnimatePresence>
 
      <aside 
        className={`
          w-72 h-[100dvh] fixed top-0 left-0 ocean-bg border-r border-white/10 p-4 pt-[calc(env(safe-area-inset-top,44px)+2rem)] flex flex-col z-[110] transition-transform duration-300 ease-in-out overflow-hidden
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Background Gradients from Perfil (Ocean theme) */}
        <div className="absolute inset-0 opacity-25 pointer-events-none z-0" style={{
          backgroundImage: `
            radial-gradient(at 0% 0%, rgba(16, 185, 129, 0.15) 0px, transparent 50%),
            radial-gradient(at 100% 0%, rgba(59, 130, 246, 0.08) 0px, transparent 50%),
            radial-gradient(at 100% 100%, rgba(20, 184, 166, 0.08) 0px, transparent 50%),
            radial-gradient(at 0% 100%, rgba(16, 185, 129, 0.15) 0px, transparent 50%)
          `
        }} />

        {/* Floating background anchors for the premium Perfil look */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20 z-0">
          <div className="absolute top-10 right-4 text-emerald-500/10 rotate-12 scale-75">
            <Anchor size={48} />
          </div>
          <div className="absolute bottom-24 left-6 text-emerald-500/5 -rotate-12 scale-90">
            <Anchor size={64} />
          </div>
        </div>

        <div className="flex items-center justify-between mb-6 px-2 relative z-10">
          <span className="text-[11px] font-black text-emerald-400 uppercase tracking-[0.3em] italic">Histórico</span>
          <button onClick={onClose} className="p-2 bg-white/5 hover:bg-white/10 active:scale-95 rounded-xl transition-all text-white/80">
            <X size={18} />
          </button>
        </div>
 
        <button 
          onClick={handleNewChat}
          className="w-full mb-4 flex items-center justify-center gap-2 py-4 px-6 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-full font-black transition-all shadow-[0_4px_20px_rgba(16,185,129,0.3)] active:scale-95 group relative z-10"
        >
          <Plus size={20} className="group-hover:rotate-90 transition-transform text-slate-950" />
          <span>Nova Conversa</span>
        </button>

        {/* Barra de Pesquisa */}
        <div className="relative mb-6 z-10">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/35" />
          <input
            type="text"
            placeholder="Buscar conversas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-full text-xs font-medium text-white outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-500/20 transition-all placeholder:text-white/30"
          />
        </div>
 
        <div className="flex-1 overflow-y-auto space-y-1 pr-2 custom-scrollbar relative z-10">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-4 px-4 flex items-center gap-2 font-mono">
            <Clock size={12} className="text-emerald-400" />
            Recentes
          </h3>
 
          <AnimatePresence mode="popLayout">
            {isLoading ? (
              <div className="space-y-3 px-2">
                {[1, 2, 3, 4].map((i: number) => (
                  <div key={i} className="h-12 w-full bg-white/5 animate-pulse rounded-full" />
                ))}
              </div>
            ) : !user ? (
              <div className="p-8 text-center bg-white/5 rounded-[2rem] border border-white/10 mx-2">
                <div className="w-12 h-12 bg-white/10 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg border border-white/15">
                  <Anchor size={20} />
                </div>
                <h4 className="text-xs font-black text-white uppercase tracking-tighter mb-2">Suas Pérolas Estão Sumindo?</h4>
                <p className="text-[10px] text-white/60 font-medium leading-relaxed mb-6">
                  Crie uma conta gratuita para salvar suas conversas e nunca perder um insight importante.
                </p>
                <Link href="/auth">
                  <button className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-[0_4px_12px_rgba(16,185,129,0.3)]">
                    Criar Conta Agora
                  </button>
                </Link>
              </div>
            ) : filteredChats.length > 0 ? (
              filteredChats.map((chat) => (
                  <motion.button
                  key={chat.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: -10 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  onClick={() => handleSelectChat(chat.id)}
                  className={`w-full text-left p-5 rounded-3xl flex items-center justify-between group transition-all mb-3 ${
                    currentChatId === chat.id 
                      ? 'bg-emerald-500 text-slate-950 border border-emerald-400 shadow-[0_4px_15px_rgba(16,185,129,0.25)] scale-[1.02]' 
                      : 'bg-white/5 text-white/70 border border-white/10 hover:bg-white/10 hover:text-white shadow-sm'}
                  `}
                >
                  <div className="flex items-center gap-4 overflow-hidden flex-1">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${currentChatId === chat.id ? 'bg-slate-950/10 text-slate-950 border border-slate-950/20' : 'bg-white/5 text-emerald-400 border border-white/10'}`}>
                      <MessageSquare size={18} className={currentChatId === chat.id ? 'text-slate-950' : 'text-emerald-400'} />
                    </div>
                    <div className="flex flex-col overflow-hidden">
                      <span className={`text-xs font-normal mb-1 ${currentChatId === chat.id ? 'text-slate-900/75' : 'text-slate-400'}`}>
                        {new Date(chat.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}, {new Date(chat.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="text-sm font-semibold truncate">
                        {chat.title || 'Conversa sem título'}
                      </span>
                    </div>
                  </div>
                  <span
                    role="button"
                    aria-label="Apagar conversa"
                    onClick={(e) => handleDeleteChat(e, chat.id)}
                    className={`shrink-0 p-2 rounded-xl transition-colors ${currentChatId === chat.id ? 'text-slate-950/50 hover:text-rose-700' : 'text-white/25 hover:text-rose-400'}`}
                  >
                    <Trash2 size={16} />
                  </span>
                </motion.button>
              ))
            ) : (
              <div className="text-center py-12 px-6">
                <p className="text-[10px] font-black text-white/40 uppercase tracking-widest leading-relaxed font-mono">
                  {searchTerm ? 'Nenhuma conversa encontrada.' : 'Nenhuma conversa.'}
                </p>
              </div>
            )}
          </AnimatePresence>
        </div>
        
        {/* Botão de Voltar ao Início */}
        <div className="mt-auto pt-4 border-t border-white/10 relative z-10">
          <button 
            onClick={() => {
              if (onClose) onClose();
              router.push('/');
            }}
            className="w-full flex items-center gap-3 px-6 py-4 text-white/60 hover:text-white transition-colors font-black text-[10px] uppercase tracking-widest group font-mono"
          >
            <div className="p-2 bg-white/5 rounded-xl group-hover:bg-emerald-500 group-hover:text-slate-950 transition-all text-white/85">
              <ArrowLeft size={16} />
            </div>
            Voltar ao Início
          </button>
        </div>
      </aside>
    </>
  );
}
