"use client";

import { useEffect, useRef, useState } from "react";

/** Video demo bila URL-nya diisi; tanpa URL, konten cadangan (gambar statis) yang tampil. */
export default function HeroMedia({ videoUrl, posterUrl, children }: { videoUrl?: string; posterUrl?: string; children?: React.ReactNode }) {
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    const element = video.current;
    if (!element || !window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    element.pause();
    setPlaying(false);
  }, []);

  if (!videoUrl) return <>{children}</>;

  function toggle() {
    const element = video.current;
    if (!element) return;
    if (element.paused) { void element.play(); setPlaying(true); } else { element.pause(); setPlaying(false); }
  }

  return <div className="hero-card hero-video">
    <video ref={video} src={videoUrl} poster={posterUrl} autoPlay muted loop playsInline preload="metadata" aria-label="Video demo GroUp: agen WhatsApp, cek harga wajar, radar permintaan, dan aktivitas AI" />
    <button type="button" className="hero-video-toggle" onClick={toggle} aria-pressed={!playing}>{playing ? "Jeda video" : "Putar video"}</button>
  </div>;
}
