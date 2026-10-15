"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Anchor, MessageCircle, Sword, CheckCircle, Shield, Lightbulb, User, LogOut } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const menuItems = [
  { icon: MessageCircle, label: 'O Porto', href: '/porto/' },
  { icon: Sword, label: 'A Arena', href: '/arena/' },
  { icon: CheckCircle, label: 'Logs de Sobrevivência', href: '/log' },
  { icon: Shield, label: 'O Cofre', href: '/cofre' },
  { icon: Lightbulb, label: 'O Farol', href: '/farol' },
  { icon: User, label: 'Perfil', href: '/perfil' },
];

export default function MobileMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    window.addEventListener('open-main-sidebar', handleOpen);
    return () => window.removeEventListener('open-main-sidebar', handleOpen);
  }, []);

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100]"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.1}
            onDragEnd={(_, info) => {
              if (info.offset.x < -100) setIsOpen(false);
            }}
            className="fixed left-0 top-0 bottom-0 w-80 bg-[#fdfcf7] shadow-2xl z-[110] flex flex-col border-r border-slate-200"
          >
            <div className="p-8 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-900 text-rose-400 rounded-xl">
                  <Anchor size={24} />
                </div>
                <span className="text-2xl font-black tracking-tighter text-slate-900">Nórica</span>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-900 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <nav className="flex-1 px-4 space-y-2">
              {menuItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link key={item.href} href={item.href}>
                    <motion.div
                      whileHover={{ x: 5, backgroundColor: 'rgba(15, 23, 42, 0.05)' }}
                      whileTap={{ scale: 0.98 }}
                      className={`
                        flex items-center gap-4 px-6 py-4 rounded-2xl font-black transition-all
                        ${isActive 
                          ? 'bg-slate-900 text-white shadow-xl translate-x-2' 
                          : 'text-slate-500 hover:text-slate-900'}
                      `}
                    >
                      <item.icon size={20} />
                      <span className="text-sm uppercase tracking-widest">{item.label}</span>
                    </motion.div>
                  </Link>
                );
              })}
            </nav>

            <div className="p-8 border-t border-slate-100">
              <div className="p-6 bg-rose-50 rounded-3xl border border-rose-100 space-y-3 relative overflow-hidden">
                <div className="absolute -top-4 -right-4 opacity-10">
                  <Anchor size={80} className="text-rose-500" />
                </div>
                <p className="text-[10px] font-black text-rose-500 uppercase tracking-[0.2em]">Guarda-Farol</p>
                <p className="text-rose-900 text-xs font-bold leading-relaxed relative z-10">
                  "Lembre-se: até a maré mais forte recua. Você está seguro aqui."
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
