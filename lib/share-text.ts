"use client";

// Compartilhar texto (WhatsApp e outros) pelo menu do Android; no navegador, abre o WhatsApp Web.
import { Capacitor } from '@capacitor/core';

export const STORE_URL = 'https://play.google.com/store/apps/details?id=com.zcx.ancora';

export async function shareText(text: string, title = 'Nórica') {
  if (Capacitor.isNativePlatform()) {
    try {
      const { Share } = await import('@capacitor/share');
      await Share.share({ title, text, dialogTitle: title });
      return;
    } catch (_e) {}
  }
  try {
    if (navigator.share) { await navigator.share({ title, text }); return; }
  } catch (_e) {}
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
}
