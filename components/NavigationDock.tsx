"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePathname, useRouter } from 'next/navigation';
import { Anchor, LifeBuoy, Clock, User, Compass, Sword, Shield, CheckCircle, Leaf } from 'lucide-react';
import { useAuth } from '@/lib/auth-store';

const LighthouseIcon = (props: any) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={props.strokeWidth || 2} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M8 9h8" />
    <path d="M9 14h6" />
    <path d="M12 3l2 3h-4l2-3z" />
    <path d="M10 6L8 21h8l-2-15" />
    <path d="M3 21h18" />
  </svg>
);

const navItems = [
  { icon: Anchor, label: 'Início', href: '/' },
  { icon: LifeBuoy, label: 'Porto', href: '/porto/' },
  { icon: Compass, label: 'Bússola', href: 'hub' }, // Hub central
  { icon: LighthouseIcon, label: 'Farol', href: '/farol/' },
  { icon: User, label: 'Perfil', href: '/perfil/' },
];

const hubItems = [
  { icon: Sword, label: 'Arena', href: '/arena/', desc: 'Praticar' },
  { icon: Shield, label: 'O Cofre', href: '/cofre/', desc: 'Segurança' },
  { icon: CheckCircle, label: 'Logs', href: '/log/', desc: 'Histórico' },
  { icon: Leaf, label: 'Exercícios', href: '/exercicios/', desc: 'Guiados' },
];

export default function NavigationDock() {
  const pathname = usePathname();
  const router = useRouter();
  const [isVisible, setIsVisible] = useState(true);
  const [isHubOpen, setIsHubOpen] = useState(false);
  const { user } = useAuth();

  React.useEffect(() => {
    const handleToggle = (e: any) => setIsVisible(e.detail);
    window.addEventListener('toggleDock', handleToggle);
    return () => window.removeEventListener('toggleDock', handleToggle);
  }, []);

  const handleNavigate = (e: React.MouseEvent, href: string) => {
    e.preventDefault();
    if (href === 'hub') {
      setIsHubOpen(!isHubOpen);
      return;
    }
    setIsHubOpen(false);
    router.push(href);
  };

  const isExcluded = 
    !user || 
    pathname?.startsWith('/porto') || 
    pathname?.startsWith('/arena') || 
    pathname?.startsWith('/cofre') ||
    !isVisible;

  if (isExcluded) return null;

  return (
    <>
      <AnimatePresence>
        {isHubOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsHubOpen(false)}
              className="fixed inset-0 z-[998] bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="fixed bottom-24 left-6 right-6 z-[999] bg-[#031c20]/90 backdrop-blur-xl rounded-[2.5rem] p-6 shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] border border-white/10 max-w-sm mx-auto"
            >
              <div className="grid grid-cols-4 gap-2">
                {hubItems.map((item) => (
                  <button 
                    key={item.href} 
                    onClick={(e) => handleNavigate(e, item.href)}
                    className="flex flex-col items-center gap-2 p-2 group"
                  >
                    <div className="p-4 bg-emerald-500/10 text-emerald-400 rounded-2xl transition-all duration-300 hover:bg-emerald-500/20 group-hover:scale-105">
                      <item.icon size={24} />
                    </div>
                    <span className="text-[9px] font-black uppercase text-white/80">{item.label}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-sm bg-[#021013]/95 border border-white/10 rounded-full px-4 py-2 shadow-[0_10px_40px_rgba(0,0,0,0.37)] flex justify-between items-center z-[999]">
        <div className="w-full flex items-center justify-around h-12">
          {navItems.map((item) => {
            const isActive = item.href === 'hub' ? isHubOpen : (pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href)));
            return (
              <motion.button
                key={item.label}
                onClick={(e) => handleNavigate(e, item.href)}
                whileTap={{ y: 3, scale: 0.96 }}
                className="flex flex-col items-center justify-center gap-1 w-full h-full relative pb-2"
              >
                <div className={`transition-all duration-300 ${isActive ? 'text-emerald-400 filter drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]' : 'text-white/40 hover:text-white/70'}`}>
                  <item.icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                </div>
                <span className={`text-[9px] font-black uppercase tracking-widest transition-all duration-300 ${isActive ? 'text-emerald-400' : 'text-white/30'}`}>
                  {item.label}
                </span>
                
                {isActive && !isHubOpen && (
                  <div className="absolute bottom-[2px] w-1.5 h-1.5 bg-emerald-400 shadow-[0_0_8px_#34d399] rounded-full" />
                )}
              </motion.button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
