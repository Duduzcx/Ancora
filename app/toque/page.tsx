"use client";

import { useRouter } from 'next/navigation';
import ToqueGuia from '@/components/ToqueGuia';

export default function ToquePage() {
  const router = useRouter();
  return <ToqueGuia onClose={() => router.back()} />;
}
