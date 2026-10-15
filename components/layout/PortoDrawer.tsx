"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Settings, LogOut, Anchor, X, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';

export default function PortoDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/auth');
  };

  // Escuta por eventos de abertura (caso queira abrir via botão no futuro)
  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    window.addEventListener('open-porto-drawer', handleOpen);
    return () => window.removeEventListener('open-porto-drawer', handleOpen);
  }, []);

  return (
    <>
      {/* Área de Detecção de Gesto (Edge Sweep) */}
      {!isOpen && (
        <div 
          className="fixed left-0 top-0 bottom-0 w-8 z-[60] cursor-e-resize"
          onMouseEnter={() => {}} // Opcional: feedback visual
          onClick={() => setIsOpen(true)} // Acesso alternativo
        />
      )}

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100]"
            />

            {/* Drawer */}
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              drag="x"
              dragConstraints={{ left: -300, right: 0 }}
              dragElastic={0.1}
              onDragEnd={(_, info) => {
                if (info.offset.x < -100) setIsOpen(false);
              }}
              className="fixed left-0 top-0 bottom-0 w-80 bg-slate-900 shadow-2xl z-[110] flex flex-col border-r border-white/5"
            >
              {/* Header */}
              <div className="p-8 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-500 text-slate-900 rounded-xl">
                    <Anchor size={24} />
                  </div>
                  <span className="text-2xl font-black tracking-tighter text-white">Porto</span>
                </div>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-2 text-slate-500 hover:text-white transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              {/* Menu Items */}
              <nav className="flex-1 px-4 py-6 space-y-2">
                <DrawerItem 
                  icon={Shield} 
                  label="Cofre" 
                  href="/cofre" 
                  isActive={pathname === '/cofre'} 
                />
                <DrawerItem 
                  icon={Settings} 
                  label="Configurações" 
                  href="/perfil" 
                  isActive={pathname === '/perfil'} 
                />
              </nav>

              {/* Footer / Logout */}
              <div className="p-8 border-t border-white/5">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handleLogout}
                  className="w-full flex items-center gap-4 px-6 py-4 rounded-2xl bg-white/5 text-rose-400 font-black text-sm uppercase tracking-widest hover:bg-rose-500/10 transition-colors"
                >
                  <LogOut size={20} />
                  Sair do App
                </motion.button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function DrawerItem({ icon: Icon, label, href, isActive }: any) {
  const router = useRouter();
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    router.push(href);
  };

  return (
    <button
      onClick={handleClick}
      className="w-full text-left"
    >
      <motion.div
        whileHover={{ x: 5 }}
        whileTap={{ scale: 0.95 }}
        className={`
          flex items-center justify-between px-6 py-5 rounded-2xl font-black transition-all
          ${isActive 
            ? 'bg-emerald-500 text-slate-900' 
            : 'text-slate-400 hover:text-white hover:bg-white/5'}
        `}
      >
        <div className="flex items-center gap-4">
          <Icon size={20} />
          <span className="text-sm uppercase tracking-widest">{label}</span>
        </div>
        {!isActive && <ChevronRight size={16} className="opacity-30" />}
      </motion.div>
    </button>
  );
}
