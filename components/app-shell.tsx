'use client';

import type { ReactNode } from 'react';
import { ChatDock } from '@/components/chat-dock';
import { Navbar } from '@/components/navbar';

export function AppShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background pb-28">
      <Navbar title={title} subtitle={subtitle} />

      <main className="mx-auto max-w-xl px-4 py-5 sm:px-5">{children}</main>

      <ChatDock />
    </div>
  );
}
