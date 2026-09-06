"use client";

import type { ReactNode } from "react";

export function ProfileSection({
  title,
  children,
  className = "",
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`mt-4 rounded-3xl bg-card/90 p-6 shadow-xl shadow-black/5 backdrop-blur-md transition-all hover:shadow-2xl hover:shadow-black/10 ${className}`}>
      <h2 className="text-sm font-extrabold text-foreground tracking-tight">{title}</h2>
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
    <label className="block">
      <span className="text-xs font-bold text-muted-foreground">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
