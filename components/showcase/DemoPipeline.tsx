"use client";

import { useEffect, useRef, useState } from "react";
import { DEMO_SCENARIOS, DEMO_STEPS, DEMO_TIMINGS, activeStep, demoClipPath } from "@/lib/demo-clips";

const scenarios = DEMO_SCENARIOS.filter((scenario) => DEMO_TIMINGS[scenario.id]);

/** Rekaman asli simulator per skenario, dengan langkah agen yang menyala mengikuti video. */
export default function DemoPipeline() {
  const video = useRef<HTMLVideoElement>(null);
  const [index, setIndex] = useState(0);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const element = video.current;
    if (!element) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) void element.play().catch(() => {});
      else element.pause();
    }, { threshold: 0.35 });
    observer.observe(element);
    return () => observer.disconnect();
  }, [index]);

  if (scenarios.length === 0) return null;
  const scenario = scenarios[index];
  const timing = DEMO_TIMINGS[scenario.id];

  function choose(next: number) {
    setIndex(next);
    setStep(0);
  }

  function toggle() {
    const element = video.current;
    if (!element) return;
    if (element.paused) void element.play(); else element.pause();
  }

  return <div className="demo-pipeline">
    <header className="demo-pipeline-head">
      <span className="demo-pipeline-live" aria-hidden="true" />
      <div><b>Agen WhatsApp · rekaman asli</b><small>Simulator production · konfirmasi tombol tetap wajib</small></div>
      <span className="demo-pipeline-chip">Kota Bandung · data PIHPS</span>
    </header>
    <div className="demo-pipeline-body">
      <div className="demo-pipeline-stage">
        <video
          key={scenario.id}
          ref={video}
          src={demoClipPath(scenario.id, "mp4")}
          poster={demoClipPath(scenario.id, "jpg")}
          muted
          playsInline
          preload="metadata"
          onTimeUpdate={(event) => setStep(activeStep(timing, event.currentTarget.currentTime))}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => choose((index + 1) % scenarios.length)}
          aria-label={`Video demo: ${scenario.title}. Pesan: “${scenario.message}”`}
        >
          <track kind="captions" src={demoClipPath(scenario.id, "vtt")} srcLang="id" label="Indonesia" />
        </video>
        <div className="demo-pipeline-caption"><small>{scenario.eyebrow}</small><b>{scenario.title}</b></div>
        <button type="button" className="demo-pipeline-toggle" onClick={toggle} aria-pressed={!playing}>{playing ? "Jeda" : "Putar"}</button>
      </div>
      <aside className="demo-pipeline-side">
        <p>{scenario.description}</p>
        <ol className="demo-pipeline-steps">
          {DEMO_STEPS.map((label, position) => <li key={label} className={position === step ? "is-active" : position < step ? "is-done" : undefined} aria-current={position === step ? "step" : undefined}>
            <span><b>{label}</b><small>{scenario.steps[position]}</small></span>
            <i>{String(position + 1).padStart(2, "0")}</i>
          </li>)}
        </ol>
        <div className="demo-pipeline-picker">
          <small>Pilih skenario</small>
          <div role="group" aria-label="Pilih skenario">
            {scenarios.map((item, position) => <button key={item.id} type="button" onClick={() => choose(position)} aria-pressed={position === index} title={item.title}>{position + 1}</button>)}
          </div>
        </div>
      </aside>
    </div>
  </div>;
}
