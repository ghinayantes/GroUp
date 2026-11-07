"use client";

import { useEffect } from "react";
import Icon from "@/components/site/Icon";

export default function Modal({ onClose, labelledBy, className = "order-modal", children }: {
  onClose: () => void; labelledBy: string; className?: string; children: React.ReactNode;
}) {
  useEffect(() => {
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className={className} role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
      <button className="modal-close" onClick={onClose} aria-label="Tutup"><Icon name="close" /></button>
      {children}
    </section>
  </div>;
}
