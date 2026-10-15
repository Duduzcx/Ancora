"use client";

import React from 'react';
import { motion } from 'framer-motion';

export default function AppLogo({ size = 40, className = "" }) {
  return (
    <motion.svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round" 
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Círculo Externo */}
      <circle cx="12" cy="12" r="10" />
      
      {/* Agulha da Bússola Animada (Minimalista) */}
      <motion.g
        animate={{ rotate: [-2, 2, -2] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        style={{ transformOrigin: "12px 12px" }}
      >
        <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" fill="currentColor" />
      </motion.g>
    </motion.svg>
  );
}
