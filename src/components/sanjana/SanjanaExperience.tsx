import { useEffect, useRef, useState } from "react";

/**
 * SanjanaExperience
 * A cinematic single-page birthday story. All heavy libraries are loaded
 * client-side (dynamic import inside effects) so SSR stays clean.
 *
 * Scene order: loader → rain → winter → blossom → night → celebration.
 */

type SceneKey = "rain" | "winter" | "blossom" | "night" | "celebrate";

const TYPING_LINES = [
  "Happy Birthday, Sanjana.",
  "You make the people around you feel seen and cared for.",
  "I hope this year brings you more peace, more laughter,",
  "and a lot of small moments that feel like home.",
];

export default function SanjanaExperience() {
  const rootRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const particlesRef = useRef<HTMLDivElement>(null);
  const fireworksRef = useRef<HTMLDivElement>(null);
  const typingRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);
  const [muted, setMuted] = useState(true);
  const [audioReady, setAudioReady] = useState(false);
  const [activeScene, setActiveScene] = useState<SceneKey>("rain");

  // Refs for audio + effect instances (avoid re-renders)
  const soundsRef = useRef<Record<string, any>>({});
  const particlesInstanceRef = useRef<any>(null);
  const fireworksInstanceRef = useRef<any>(null);
  const lenisRef = useRef<any>(null);
  const confettiRef = useRef<any>(null);

  /* ------------------------------------------------------------------ */
  /* Loader — a short cinematic entry                                    */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    if (typeof window === "undefined") return;
    let raf = 0;
    const start = performance.now();
    const DURATION = 2400;
    const tick = (t: number) => {
      const p = Math.min(100, ((t - start) / DURATION) * 100);
      setLoadProgress(p);
      if (p < 100) raf = requestAnimationFrame(tick);
      else setTimeout(() => setLoading(false), 350);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  /* ------------------------------------------------------------------ */
  /* Cursor glow                                                         */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const el = cursorRef.current;
    if (!el) return;
    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;
    let tx = x,
      ty = y;
    const onMove = (e: MouseEvent) => {
      tx = e.clientX;
      ty = e.clientY;
    };
    window.addEventListener("mousemove", onMove);
    let raf = 0;
    const loop = () => {
      x += (tx - x) * 0.12;
      y += (ty - y) * 0.12;
      el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  /* ------------------------------------------------------------------ */
  /* Lenis smooth scroll + GSAP scene orchestration                      */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    if (typeof window === "undefined" || loading) return;
    let cleanup: (() => void) | undefined;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    (async () => {
      const [{ default: Lenis }, gsapMod, stMod, splitMod] = await Promise.all([
        import("lenis"),
        import("gsap"),
        import("gsap/ScrollTrigger"),
        import("split-type"),
      ]);
      const gsap = gsapMod.default || gsapMod;
      const ScrollTrigger = stMod.ScrollTrigger || stMod.default;
      const SplitType = (splitMod as any).default || splitMod;
      gsap.registerPlugin(ScrollTrigger);

      let lenis: any;
      if (!prefersReduced) {
        lenis = new Lenis({ smoothWheel: true, lerp: 0.09, wheelMultiplier: 0.95 });
        lenisRef.current = lenis;
        lenis.on("scroll", ScrollTrigger.update);
        const raf = (time: number) => {
          lenis.raf(time * 1000);
        };
        gsap.ticker.add(raf);
        gsap.ticker.lagSmoothing(0);
      }

      // Character reveals for scene titles
      const titles = rootRef.current?.querySelectorAll<HTMLElement>("[data-split]") ?? [];
      titles.forEach((el) => {
        const split = new SplitType(el, { types: "chars,words" });
        gsap.from(split.chars, {
          scrollTrigger: { trigger: el, start: "top 82%" },
          yPercent: 110,
          opacity: 0,
          ease: "power3.out",
          duration: 0.9,
          stagger: 0.02,
        });
      });

      // Fade + slide reveals
      const reveals = rootRef.current?.querySelectorAll<HTMLElement>(".sj-reveal") ?? [];
      reveals.forEach((el) => {
        gsap.to(el, {
          scrollTrigger: { trigger: el, start: "top 85%" },
          opacity: 1,
          y: 0,
          duration: 1.0,
          ease: "power2.out",
        });
      });

      // Scene activation via ScrollTrigger — sets state to switch backgrounds/particles
      const sceneEls = rootRef.current?.querySelectorAll<HTMLElement>("[data-scene]") ?? [];
      const triggers: any[] = [];
      sceneEls.forEach((el) => {
        const key = el.dataset.scene as SceneKey;
        triggers.push(
          ScrollTrigger.create({
            trigger: el,
            start: "top 55%",
            end: "bottom 45%",
            onEnter: () => setActiveScene(key),
            onEnterBack: () => setActiveScene(key),
          }),
        );
      });

      cleanup = () => {
        triggers.forEach((t) => t.kill());
        if (lenis) lenis.destroy();
        ScrollTrigger.getAll().forEach((t: any) => t.kill());
      };
    })();

    return () => {
      cleanup?.();
    };
  }, [loading]);

  /* ------------------------------------------------------------------ */
  /* Typing animation on first scene                                     */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    if (loading) return;
    const el = typingRef.current;
    if (!el) return;
    let cancelled = false;
    const run = async () => {
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              io.disconnect();
              typeLines();
            }
          });
        },
        { threshold: 0.4 },
      );
      io.observe(el);
      const typeLines = async () => {
        el.textContent = "";
        for (const line of TYPING_LINES) {
          const p = document.createElement("p");
          p.style.margin = "0 0 0.4em";
          el.appendChild(p);
          for (const ch of line) {
            if (cancelled) return;
            p.textContent += ch;
            await new Promise((r) => setTimeout(r, 22 + Math.random() * 30));
          }
          await new Promise((r) => setTimeout(r, 320));
        }
        const caret = document.createElement("span");
        caret.className = "caret";
        el.appendChild(caret);
      };
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [loading]);

  /* ------------------------------------------------------------------ */
  /* tsParticles — swap presets per scene                                */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    if (loading) return;
    let disposed = false;
    (async () => {
      const [{ tsParticles }, { loadSlim }] = await Promise.all([
        import("@tsparticles/engine"),
        import("@tsparticles/slim"),
      ]);
      await loadSlim(tsParticles);
      if (disposed) return;

      const container = particlesRef.current;
      if (!container) return;
      container.id = "sj-particles-canvas";

      const presets: Record<SceneKey, any> = {
        rain: {
          fpsLimit: 60,
          particles: {
            number: { value: 220, density: { enable: true, area: 800 } },
            color: { value: "#a8c7ff" },
            shape: { type: "line" },
            opacity: { value: 0.35 },
            size: { value: { min: 1, max: 2 } },
            move: { enable: true, direction: "bottom", speed: 18, straight: true },
            rotate: { value: 12, direction: "clockwise" },
          },
          detectRetina: true,
          background: { color: "transparent" },
        },
        winter: {
          fpsLimit: 60,
          particles: {
            number: { value: 140 },
            color: { value: "#ffffff" },
            shape: { type: "circle" },
            opacity: { value: { min: 0.3, max: 0.85 } },
            size: { value: { min: 1, max: 3.5 } },
            move: { enable: true, direction: "bottom", speed: 1.2, drift: 0.4, outModes: "out" },
          },
          detectRetina: true,
          background: { color: "transparent" },
        },
        blossom: {
          fpsLimit: 60,
          particles: {
            number: { value: 90 },
            color: { value: ["#ffb3c9", "#ff8fb1", "#ffd6e4"] },
            shape: { type: "circle" },
            opacity: { value: { min: 0.5, max: 0.9 } },
            size: { value: { min: 3, max: 7 } },
            move: {
              enable: true,
              direction: "bottom-right",
              speed: 1.6,
              drift: 1.2,
              outModes: "out",
            },
          },
          detectRetina: true,
          background: { color: "transparent" },
        },
        night: {
          fpsLimit: 60,
          particles: {
            number: { value: 200 },
            color: { value: "#ffffff" },
            shape: { type: "circle" },
            opacity: {
              value: { min: 0.2, max: 1 },
              animation: { enable: true, speed: 1.2, sync: false },
            },
            size: { value: { min: 0.4, max: 1.6 } },
            move: { enable: true, speed: 0.15 },
          },
          detectRetina: true,
          background: { color: "transparent" },
        },
        celebrate: {
          fpsLimit: 60,
          particles: {
            number: { value: 120 },
            color: { value: ["#ffd7a8", "#ffb3c9", "#c8b6ff", "#a8e0ff"] },
            shape: { type: "circle" },
            opacity: { value: 0.85 },
            size: { value: { min: 1, max: 3 } },
            move: { enable: true, speed: 0.8, direction: "top", outModes: "out" },
          },
          detectRetina: true,
          background: { color: "transparent" },
        },
      };

      const load = async (key: SceneKey) => {
        if (particlesInstanceRef.current) {
          particlesInstanceRef.current.destroy();
          particlesInstanceRef.current = null;
        }
        particlesInstanceRef.current = await tsParticles.load({
          id: "sj-particles-canvas",
          options: presets[key],
        });
      };

      (container as any).__load = load;
      await load(activeScene);
    })();
    return () => {
      disposed = true;
      if (particlesInstanceRef.current) {
        particlesInstanceRef.current.destroy();
        particlesInstanceRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  // React to scene changes → swap particle preset
  useEffect(() => {
    const el = particlesRef.current as any;
    if (el?.__load) el.__load(activeScene);
  }, [activeScene]);

  /* ------------------------------------------------------------------ */
  /* Fireworks — only active in celebration scene                        */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    if (loading) return;
    let disposed = false;
    (async () => {
      const { Fireworks } = await import("fireworks-js");
      if (disposed || !fireworksRef.current) return;
      const fw = new Fireworks(fireworksRef.current, {
        rocketsPoint: { min: 30, max: 70 },
        hue: { min: 0, max: 360 },
        acceleration: 1.02,
        friction: 0.97,
        gravity: 1.4,
        particles: 90,
        intensity: 22,
        traceLength: 3,
        explosion: 6,
        opacity: 0.55,
        sound: { enabled: false },
      });
      fireworksInstanceRef.current = fw;
    })();
    return () => {
      disposed = true;
      if (fireworksInstanceRef.current) {
        fireworksInstanceRef.current.stop();
        fireworksInstanceRef.current = null;
      }
    };
  }, [loading]);

  useEffect(() => {
    const fw = fireworksInstanceRef.current;
    if (!fw) return;
    if (activeScene === "celebrate") {
      fw.start();
      // canvas-confetti burst
      (async () => {
        if (!confettiRef.current) {
          const mod = await import("canvas-confetti");
          confettiRef.current = mod.default;
        }
        const confetti = confettiRef.current;
        confetti({ particleCount: 160, spread: 90, startVelocity: 45, origin: { y: 0.7 } });
        setTimeout(
          () => confetti({ particleCount: 120, angle: 60, spread: 70, origin: { x: 0 } }),
          400,
        );
        setTimeout(
          () => confetti({ particleCount: 120, angle: 120, spread: 70, origin: { x: 1 } }),
          700,
        );
      })();
    } else {
      fw.stop();
    }
  }, [activeScene]);

  /* ------------------------------------------------------------------ */
  /* Audio — Howler with lightweight remote ambience                     */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    if (loading) return;
    let disposed = false;
    (async () => {
      const { Howl } = await import("howler");
      if (disposed) return;
      // Public CDN loops (kept small and cross-origin friendly).
      const rain = new Howl({
        src: [
          "https://cdn.pixabay.com/download/audio/2022/03/10/audio_c8c8a73467.mp3?filename=rain-and-thunder-sfx-12820.mp3",
        ],
        loop: true,
        volume: 0,
        html5: true,
      });
      const piano = new Howl({
        src: [
          "https://cdn.pixabay.com/download/audio/2022/10/25/audio_946bc5b0e0.mp3?filename=relaxing-piano-music-116891.mp3",
        ],
        loop: true,
        volume: 0,
        html5: true,
      });
      const celebrate = new Howl({
        src: [
          "https://cdn.pixabay.com/download/audio/2022/03/15/audio_1ea1b1b25c.mp3?filename=happy-birthday-instrumental-116932.mp3",
        ],
        loop: true,
        volume: 0,
        html5: true,
      });
      soundsRef.current = { rain, piano, celebrate };
      setAudioReady(true);
    })();
    return () => {
      disposed = true;
      Object.values(soundsRef.current).forEach((s: any) => s?.unload?.());
      soundsRef.current = {};
    };
  }, [loading]);

  // Crossfade audio between scenes when unmuted
  useEffect(() => {
    if (!audioReady) return;
    const { rain, piano, celebrate } = soundsRef.current;
    if (!rain || !piano || !celebrate) return;
    const wantsCelebrate = activeScene === "celebrate";
    const wantsRain = activeScene === "rain";
    const master = muted ? 0 : 1;
    const fade = (h: any, to: number) => {
      if (!h) return;
      if (!h.playing()) h.play();
      h.fade(h.volume(), to * master, 900);
    };
    fade(rain, wantsRain ? 0.35 : activeScene === "winter" ? 0.18 : 0.06);
    fade(piano, wantsCelebrate ? 0.0 : 0.28);
    fade(celebrate, wantsCelebrate ? 0.45 : 0.0);
  }, [activeScene, muted, audioReady]);

  /* ------------------------------------------------------------------ */
  /* Magnetic button + replay                                            */
  /* ------------------------------------------------------------------ */
  const magneticRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const btn = magneticRef.current;
    if (!btn) return;
    const onMove = (e: MouseEvent) => {
      const r = btn.getBoundingClientRect();
      const x = e.clientX - (r.left + r.width / 2);
      const y = e.clientY - (r.top + r.height / 2);
      btn.style.transform = `translate(${x * 0.25}px, ${y * 0.35}px)`;
    };
    const onLeave = () => {
      btn.style.transform = "";
    };
    btn.addEventListener("mousemove", onMove);
    btn.addEventListener("mouseleave", onLeave);
    return () => {
      btn.removeEventListener("mousemove", onMove);
      btn.removeEventListener("mouseleave", onLeave);
    };
  }, [loading]);

  const replay = () => {
    if (lenisRef.current) lenisRef.current.scrollTo(0, { duration: 1.6 });
    else window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /* ------------------------------------------------------------------ */
  /* Render                                                              */
  /* ------------------------------------------------------------------ */
  const bgClass = `sj-bg sj-bg-${activeScene === "night" ? "sky" : activeScene}`;

  return (
    <div ref={rootRef} className="sj-app">
      {loading && (
        <div className="sj-loader" role="status" aria-live="polite">
          <div>
            <div className="sj-loader__ring" aria-hidden />
            <div className="sj-loader__label">A Birthday Note For</div>
            <div className="sj-loader__title">Sanjana</div>
            <div className="sj-loader__bar" aria-hidden>
              <span style={{ width: `${loadProgress}%` }} />
            </div>
          </div>
        </div>
      )}

      {/* Fixed background layers */}
      <div className={bgClass} aria-hidden />
      <div ref={particlesRef} className={`sj-particles ${loading ? "" : "is-on"}`} aria-hidden />
      <div className={`sj-aurora ${activeScene === "night" ? "is-on" : ""}`} aria-hidden />
      <div
        ref={fireworksRef}
        className={`sj-fireworks ${activeScene === "celebrate" ? "is-on" : ""}`}
        aria-hidden
      />
      <div ref={cursorRef} className="sj-cursor" aria-hidden />

      {/* HUD */}
      <div className="sj-hud">
        <button
          onClick={() => setMuted((m) => !m)}
          aria-pressed={!muted}
          aria-label={muted ? "Unmute audio" : "Mute audio"}
        >
          {muted ? "Sound on" : "Mute"}
        </button>
      </div>

      <main className="sj-scenes">
        {/* Scene 1 — Rainy Night */}
        <section className="sj-scene" data-scene="rain" aria-labelledby="sc-rain">
          <div className="sj-scene__inner">
            <span className="sj-eyebrow">
              <span className="dot" /> Chapter One · Rain
            </span>
            <h1 id="sc-rain" className="sj-title" data-split>
              Happy Birthday, Sanjana.
            </h1>
            <div className="sj-glass sj-reveal" style={{ marginTop: "1.5rem" }}>
              <div ref={typingRef} className="sj-typing" aria-live="polite" />
            </div>
            <p className="sj-lede sj-reveal" style={{ marginTop: "1.6rem" }}>
              Scroll gently — this is a small birthday wish, made just for you.
            </p>
          </div>
        </section>

        {/* Scene 2 — Winter */}
        <section
          className="sj-scene sj-scene--winter"
          data-scene="winter"
          aria-labelledby="sc-winter"
        >
          <div className="sj-scene__inner">
            <span className="sj-eyebrow">
              <span className="dot" /> Chapter Two · Winter
            </span>
            <h2 id="sc-winter" className="sj-title" data-split>
              Thank you for being you.
            </h2>
            <div className="sj-glass sj-reveal">
              <p className="sj-lede">
                You have a way of making ordinary days feel lighter. Thank you for the late-night
                talks, the laughs that come out of nowhere, and the way you always show up with
                kindness.
              </p>
              <p className="sj-lede" style={{ marginTop: "1rem" }}>
                Being around you makes life feel softer and better.
              </p>
            </div>
          </div>
        </section>

        {/* Scene 3 — Cherry Blossoms */}
        <section
          className="sj-scene sj-scene--blossom"
          data-scene="blossom"
          aria-labelledby="sc-blossom"
        >
          <div className="sj-scene__inner">
            <span className="sj-eyebrow">
              <span className="dot" /> Chapter Three · Blossoms
            </span>
            <h2 id="sc-blossom" className="sj-title" data-split>
              May your year feel gentle.
            </h2>
            <div className="sj-glass sj-reveal">
              <p className="sj-lede">
                I hope this year brings you easy mornings, warm people, and a lot more reasons to
                smile without even trying.
              </p>
              <p className="sj-lede" style={{ marginTop: "1rem" }}>
                And when the day is loud, I hope it still leaves room for peace.
              </p>
            </div>
          </div>
        </section>

        {/* Scene 4 — Night sky + lanterns */}
        <section className="sj-scene" data-scene="night" aria-labelledby="sc-night">
          <div className="sj-scene__inner">
            <span className="sj-eyebrow">
              <span className="dot" /> Chapter Four · Night Sky
            </span>
            <h2 id="sc-night" className="sj-title" data-split>
              A few wishes for your year ahead.
            </h2>
            <div className="sj-glass sj-reveal">
              <p className="sj-lede">
                I wish you health, calm, and the courage to go after the things that matter to you.
                I wish you good people, steady days, and plenty of reasons to feel proud of
                yourself.
              </p>
              <p className="sj-lede" style={{ marginTop: "1rem" }}>
                On the heavy days, please remember that you are loved more than you know.
              </p>
            </div>
          </div>
        </section>

        {/* Scene 5 — Celebration */}
        <section className="sj-scene" data-scene="celebrate" aria-labelledby="sc-celebrate">
          <div className="sj-scene__inner">
            <span className="sj-eyebrow">
              <span className="dot" /> Chapter Five · Celebration
            </span>
            <h2 id="sc-celebrate" className="sj-title" data-split>
              Happy Birthday, Sanjana.
            </h2>

            <div className="sj-letter sj-reveal" style={{ marginTop: "1.5rem" }}>
              <p>Dear Sanjana,</p>
              <p>Happy Birthday. I hope today feels warm, easy, and full of love.</p>
              <p>
                Thank you for the laughter, the care you give so naturally, and all the small
                moments that make life brighter around you.
              </p>
              <p>
                Wishing you a year full of peace, good news, and little joys that stay with you.
              </p>
              <span className="sig">— with love</span>
            </div>

            <div style={{ marginTop: "2rem", display: "flex", justifyContent: "center" }}>
              <button ref={magneticRef} className="sj-magnetic" onClick={replay}>
                ↺ Replay the story
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer className="sj-footer">Made with love · Happy Birthday</footer>
    </div>
  );
}
