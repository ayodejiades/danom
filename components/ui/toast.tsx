"use client";

import { useEffect, useState } from "react";

export function Toast({ message, durationMs = 3000 }: { message: string; durationMs?: number }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setVisible(false), durationMs);
    return () => clearTimeout(t);
  }, [durationMs]);
  if (!visible) return null;
  return (
    <div
      role="status"
      className="fixed bottom-6 right-6 rounded-[var(--radius-pill)] bg-[var(--navy)] px-5 py-3 text-sm font-medium text-white shadow-[var(--shadow)]"
    >
      {message}
    </div>
  );
}
