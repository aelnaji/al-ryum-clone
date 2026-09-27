"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { opening } from "@/content/opening";
import type { SceneController } from "@/lib/create-scene";

const subscribeMotion = (callback: () => void) => {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
};
const getMotionPreference = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export default function OpeningExperience() {
  const experience = useRef<HTMLElement>(null);
  const sceneHost = useRef<HTMLDivElement>(null);
  const notice = useRef<HTMLDialogElement>(null);
  const [motionOff, setMotionOff] = useState(false);
  const [sceneStatus, setSceneStatus] = useState<"loading" | "ready" | "fallback">("loading");
  const [noticeTitle, setNoticeTitle] = useState("Stage 01");
  const [menuOpen, setMenuOpen] = useState(false);
  const systemReduced = useSyncExternalStore(subscribeMotion, getMotionPreference, () => false);

  useEffect(() => {
    const root = experience.current;
    const host = sceneHost.current;
    if (!root || !host) return;
    let cancelled = false;
    let controller: SceneController | undefined;
    let context: gsap.Context | undefined;
    let observer: ResizeObserver | undefined;
    let media: gsap.MatchMedia | undefined;
    let resizeFrame = 0;
    let pointerFrame = 0;
    const state = { progress: 0 };
    const pointer = { x: 0, y: 0 };
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const render = () => controller?.render(state.progress, pointer.x, pointer.y);
    const onPointer = (event: PointerEvent) => {
      if (motionOff || mq.matches || event.pointerType === "touch" || document.hidden) return;
      pointer.x = event.clientX / window.innerWidth - 0.5;
      pointer.y = event.clientY / window.innerHeight - 0.5;
      if (!pointerFrame) pointerFrame = requestAnimationFrame(() => { pointerFrame = 0; render(); });
    };
    const onContextLost = (event: Event) => {
      event.preventDefault();
      setSceneStatus("fallback");
      host.style.visibility = "hidden";
    };
    const visibility = () => { if (!document.hidden) render(); };

    async function init() {
      try {
        const { createScene } = await import("@/lib/create-scene");
        if (cancelled) return;
        controller = createScene(host!);
        host!.style.visibility = "";
        host!.addEventListener("webglcontextlost", onContextLost, true);
        setSceneStatus("ready");
      } catch {
        if (cancelled) return;
        setSceneStatus("fallback");
      }
      if (cancelled) return;
      gsap.registerPlugin(ScrollTrigger);
      context = gsap.context(() => {
        media = gsap.matchMedia();
        media.add(
          { reduce: "(prefers-reduced-motion: reduce)", all: "(min-width: 0px)" },
          (matchContext) => {
            const reduced = motionOff || !!matchContext.conditions?.reduce;
            root!.classList.toggle("static-mode", reduced);
            const panels = gsap.utils.toArray<HTMLElement>(".story-panel", root!);
            if (reduced) {
              gsap.set(panels, { clearProps: "all" });
              gsap.set(".chapter-line", { scaleX: 1 });
              state.progress = 0;
              render();
              return;
            }
            gsap.set(panels, { autoAlpha: 0, y: 24 });
            gsap.set(panels[0], { autoAlpha: 1, y: 0 });
            const timeline = gsap.timeline({
              defaults: { ease: "none" },
              scrollTrigger: {
                trigger: root,
                start: "top top",
                end: "bottom bottom",
                scrub: 0.65,
                invalidateOnRefresh: true,
                onUpdate: (self) => {
                  root!.dataset.chapter = self.progress < 0.3 ? "1" : self.progress < 0.64 ? "2" : "3";
                },
              },
            });
            timeline.to(state, { progress: 1, duration: 1, onUpdate: render }, 0)
              .to(panels[0], { autoAlpha: 0, y: -30, duration: 0.1 }, 0.2)
              .to(panels[1], { autoAlpha: 1, y: 0, duration: 0.12 }, 0.3)
              .to(panels[1], { autoAlpha: 0, y: -30, duration: 0.1 }, 0.55)
              .to(panels[2], { autoAlpha: 1, y: 0, duration: 0.12 }, 0.65)
              .fromTo(".chapter-line", { scaleX: 0 }, { scaleX: 1, duration: 1 }, 0)
              .fromTo(".ambient-light", { opacity: 0.65 }, { opacity: 1, duration: 1 }, 0);
            return () => { timeline.scrollTrigger?.kill(); timeline.kill(); };
          },
        );
      }, root!);
      observer = new ResizeObserver(() => {
        if (!resizeFrame) resizeFrame = requestAnimationFrame(() => {
          resizeFrame = 0;
          controller?.resize();
          ScrollTrigger.refresh();
        });
      });
      observer.observe(host!);
      root!.addEventListener("pointermove", onPointer, { passive: true });
      document.addEventListener("visibilitychange", visibility);
    }
    void init();
    return () => {
      cancelled = true;
      observer?.disconnect();
      cancelAnimationFrame(resizeFrame);
      cancelAnimationFrame(pointerFrame);
      root.removeEventListener("pointermove", onPointer);
      document.removeEventListener("visibilitychange", visibility);
      host.removeEventListener("webglcontextlost", onContextLost, true);
      media?.revert();
      context?.revert();
      controller?.dispose();
    };
  }, [motionOff]);

  function jump(chapter: number) {
    setMenuOpen(false);
    const root = experience.current;
    if (!root) return;
    const staticMode = root.classList.contains("static-mode");
    const panel = root.querySelector<HTMLElement>(`[data-panel="${chapter}"]`);
    const top = staticMode && panel
      ? window.scrollY + panel.getBoundingClientRect().top - 100
      : root.offsetTop + Math.max(0, root.offsetHeight - window.innerHeight) * [0, 0.43, 0.86][chapter];
    window.scrollTo({ top, behavior: staticMode ? "instant" : "smooth" });
  }

  function openNotice(title: string) {
    setMenuOpen(false);
    setNoticeTitle(title);
    notice.current?.showModal();
  }

  return (
    <>
      <a className="skip-link" href="#preview-end">Skip animated opening</a>
      <header className="site-header">
        <button className="brand" onClick={() => jump(0)} aria-label="Al Ryum Group, back to opening">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/media/arc-original.webp" alt="" width="46" height="40" />
          <span>Al Ryum<span className="brand-sub">GROUP</span></span>
        </button>
        <nav className={menuOpen ? "navigation is-open" : "navigation"} aria-label="Main navigation">
          {opening.navigation.map((label, index) => (
            <button key={label} className={index === 4 ? "contact-button" : ""} onClick={() => index < 2 ? jump(index === 0 ? 0 : 2) : openNotice(label)}>
              {label}{index === 4 && <span aria-hidden="true"> ↗</span>}
            </button>
          ))}
        </nav>
        <button className="menu-toggle" aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? "Close" : "Menu"} <span aria-hidden="true">{menuOpen ? "−" : "+"}</span>
        </button>
      </header>

      <main>
        <section ref={experience} className="experience" data-chapter="1" aria-label="Al Ryum Group introduction">
          <div className="stage">
            <div className="ambient-light" aria-hidden="true" />
            <div className="scene-host" ref={sceneHost} />
            {sceneStatus !== "ready" && (
              <div className="scene-fallback" aria-hidden="true">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/media/arc-mark.svg" alt="" width="768" height="657" />
              </div>
            )}
            <div className="stage-grid" aria-hidden="true" />
            <div className="eyebrow"><span className="status-dot" /> AL RYUM GROUP <span className="eyebrow-divider" /> CONSTRUCTION</div>

            <section className="story-panel hero-panel" data-panel="0" aria-label="Opening">
              <div className="chapter-kicker">01 / AL RYUM</div>
              <h1><span>{opening.headline[0]}</span><span>{opening.headline[1]}</span></h1>
              <p className="hero-description">{opening.introduction}</p>
              <button className="text-link" onClick={() => jump(1)}>Scroll to explore <span className="circle-arrow" aria-hidden="true">↓</span></button>
            </section>

            <section className="story-panel innovation-panel" data-panel="1" aria-label="Innovation">
              <div className="chapter-kicker">02 / CONSTRUCTION</div>
              <p className="innovation-copy">Innovation is in<br />our blueprint.</p>
              <p className="body-copy">From BIM design to real-time site tracking, we build smarter at every stage.</p>
            </section>

            <section className="story-panel about-panel" data-panel="2" aria-label="Who We Are">
              <div className="chapter-kicker">03 / WHO WE ARE</div>
              <h2>{opening.aboutHeading}</h2>
              <p className="body-copy">{opening.about}</p>
              <a className="text-link" href="#preview-end">Read more <span className="circle-arrow" aria-hidden="true">↓</span></a>
            </section>

            <div className="stage-bottom">
              <div className="chapter-navigation" aria-label="Opening chapters">
                {["Al Ryum", "Construction", "Who We Are"].map((label, index) => (
                  <button key={label} className={`chapter-nav chapter-${index + 1}`} onClick={() => jump(index)}>
                    <span>0{index + 1}</span><span>{label}</span>
                  </button>
                ))}
              </div>
              <button className="motion-toggle" aria-pressed={motionOff || systemReduced} disabled={systemReduced} onClick={() => setMotionOff(!motionOff)}>
                <span aria-hidden="true">{motionOff || systemReduced ? "▷" : "Ⅱ"}</span> {systemReduced ? "System: reduced motion" : motionOff ? "Enable motion" : "Reduce motion"}
              </button>
              <div className="chapter-track" aria-hidden="true"><div className="chapter-line" /></div>
            </div>
          </div>
        </section>

        <section className="preview-end" id="preview-end" tabIndex={-1}>
          <div className="chapter-kicker">PRIVATE PREVIEW / STAGE 01</div>
          <h2>The opening.<br /><span>A new foundation.</span></h2>
          <div className="preview-end-copy">
            <p>This preview covers the opening experience only. Your original website and its remaining content are unchanged.</p>
            <p>Next stage: carry this direction into the services, project portfolio and remaining pages, preserving the existing content.</p>
            <button className="text-link" onClick={() => jump(0)}>Replay opening <span className="circle-arrow" aria-hidden="true">↑</span></button>
          </div>
        </section>
      </main>

      <footer><span>Al Ryum Group</span><span>Stage 01 · Review before continuing</span><button onClick={() => openNotice("About this preview")}>Preview details ↗</button></footer>
      <dialog ref={notice} className="preview-dialog" aria-labelledby="preview-dialog-title" aria-describedby="preview-dialog-description" onClick={(event) => { if (event.target === event.currentTarget) notice.current?.close(); }}>
        <div className="chapter-kicker">STAGED REBUILD</div>
        <h2 id="preview-dialog-title">{noticeTitle}</h2>
        <p id="preview-dialog-description">This is the Stage 01 opening preview, not a replacement for the full website. Services, projects and contact pages will be migrated in the next stage after review. No original content has been deleted.</p>
        <button className="dialog-close" onClick={() => notice.current?.close()}>Back to preview <span aria-hidden="true">↗</span></button>
      </dialog>
    </>
  );
}
