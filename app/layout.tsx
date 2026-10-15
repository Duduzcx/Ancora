import type { Metadata } from "next";
import { Inter, Pacifico } from "next/font/google";
import "./globals.css";
import LayoutWrapper from "@/components/LayoutWrapper";

const inter = Inter({ subsets: ["latin"] });
const pacifico = Pacifico({ weight: '400', subsets: ['latin'], variable: '--font-pacifico' });

export const metadata: Metadata = {
  title: "Nórica: Navegação Mental",
  description: "Seu assistente de navegação mental, mapeamento de hábitos e insights emocionais.",
  icons: {
    icon: "/favicon.png",
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'auto',
  themeColor: '#020e10',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${inter.className} antialiased bg-[#020e10] overscroll-none overflow-x-hidden w-full max-w-[100vw] text-white`}>
        <LayoutWrapper>
          {children}
        </LayoutWrapper>
      </body>
    </html>
  );
}
