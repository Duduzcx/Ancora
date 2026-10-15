"use client";

import React from 'react';
import { motion } from 'framer-motion';

interface SafeMarkdownProps {
  content: string;
  highlightColor?: string;
  isStreaming?: boolean;
}

const wordVariants = {
  hidden: { opacity: 0, y: 5, filter: 'blur(3px)' },
  visible: { 
    opacity: 1, 
    y: 0, 
    filter: 'blur(0px)',
    transition: { type: "spring", stiffness: 100, damping: 20 }
  }
};

export default function SafeMarkdown({ content, highlightColor = 'text-emerald-500', isStreaming = false }: SafeMarkdownProps) {
  if (!content) return null;

  // Split by double line breaks to get paragraphs
  const paragraphs = content.split(/\n\s*\n/);

  const renderTextWithBold = (text: string, baseKey: string) => {
    // Split by ** to find bold sections
    const parts = text.split(/\*\*([^*]+)\*\*/g);
    return parts.map((part, index) => {
      const isBold = index % 2 === 1;
      const partKey = `${baseKey}-part-${index}`;

      if (!isStreaming) {
        if (isBold) {
          return (
            <b key={index} className={`font-black ${highlightColor}`}>
              {part}
            </b>
          );
        }
        return part;
      }

      // Split by spaces but preserve them to maintain natural wrapping
      const words = part.split(/(\s+)/);
      return (
        <motion.span 
          key={index} 
          initial="hidden" 
          animate="visible"
          className="inline"
        >
          {words.map((word, idx) => {
            if (word.trim() === '') {
              // Return spacing unchanged
              return <span key={`${partKey}-space-${idx}`}>{word}</span>;
            }
            return (
              <motion.span
                key={`${partKey}-word-${idx}`}
                variants={wordVariants}
                className={`inline-block ${isBold ? `font-black ${highlightColor}` : ''}`}
              >
                {word}
              </motion.span>
            );
          })}
        </motion.span>
      );
    });
  };

  return (
    <>
      {paragraphs.map((para, paraIdx) => {
        const lines = para.split('\n');

        // Check if the paragraph is a bullet list (every line starts with - or *)
        const isBulletList = lines.length > 0 && lines.every(line => {
          const trimmed = line.trim();
          return trimmed.startsWith('- ') || trimmed.startsWith('* ');
        });

        if (isBulletList) {
          return (
            <ul key={paraIdx} className="list-disc pl-5 mb-3 last:mb-0 space-y-1">
              {lines.map((line, lineIdx) => {
                const cleaned = line.trim().substring(2);
                return (
                  <li key={lineIdx}>
                    {renderTextWithBold(cleaned, `para-${paraIdx}-list-${lineIdx}`)}
                  </li>
                );
              })}
            </ul>
          );
        }

        // Check if the paragraph is an ordered list (every line starts with a number followed by dot)
        const isOrderedList = lines.length > 0 && lines.every(line => /^\d+\.\s/.test(line.trim()));

        if (isOrderedList) {
          return (
            <ol key={paraIdx} className="list-decimal pl-5 mb-3 last:mb-0 space-y-1">
              {lines.map((line, lineIdx) => {
                const cleaned = line.trim().replace(/^\d+\.\s+/, '');
                return (
                  <li key={lineIdx}>
                    {renderTextWithBold(cleaned, `para-${paraIdx}-order-${lineIdx}`)}
                  </li>
                );
              })}
            </ol>
          );
        }

        // Normal paragraph with potential line breaks
        return (
          <p key={paraIdx} className="mb-3 last:mb-0 leading-relaxed">
            {lines.map((line, lineIdx) => (
              <React.Fragment key={lineIdx}>
                {lineIdx > 0 && <br />}
                {renderTextWithBold(line, `para-${paraIdx}-line-${lineIdx}`)}
              </React.Fragment>
            ))}
          </p>
        );
      })}
    </>
  );
}
