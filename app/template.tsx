"use client";

import { motion } from 'framer-motion';

export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full min-h-[100dvh]">
      {children}
    </div>
  );
}
