'use client';

import type { ReactNode } from 'react';

export function ProfileSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-4 rounded-3xl bg-card/90 p-6 shadow-sm backdrop-blur-md">
      <h2 className="font-bold text-foreground text-sm tracking-tight">
        {title}
      </h2>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

export function ProfileField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="block">
      <span className="font-bold text-muted-foreground text-xs">{label}</span>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
