"use client";

// Entrega um arquivo gerado no celular: no app abre o menu de compartilhar do Android
// (WhatsApp, e-mail, Drive…); no navegador, baixa o arquivo.

import { Capacitor } from '@capacitor/core';

export async function shareFile(blob: Blob, fileName: string, title: string) {
  if (Capacitor.isNativePlatform()) {
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')]);
    const data = await new Promise<string>((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(String(fr.result).split(',')[1]);
      fr.onerror = () => rej(fr.error);
      fr.readAsDataURL(blob);
    });
    const saved = await Filesystem.writeFile({ path: fileName, data, directory: Directory.Cache });
    await Share.share({ title, url: saved.uri, dialogTitle: title });
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
