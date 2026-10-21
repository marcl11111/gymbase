/**
 * Wiederverwendbare Scroll-Animationskomponenten (GSAP + ScrollTrigger).
 * Alle Komponenten:
 *  - animieren ausschließlich transform/opacity
 *  - räumen sich über gsap.context().revert() vollständig auf
 *  - respektieren prefers-reduced-motion und die App-Einstellung „Animationen reduzieren“
 *  - reduzieren Pinning/Parallax auf kleinen Bildschirmen
 */
import { type CSSProperties, type ElementType, type ReactNode } from 'react';
import { gsap, ScrollTrigger, useGsap } from './gsap';

// ---------- ScrollReveal: gestaffeltes Einblenden ----------

interface RevealProps {
  children: ReactNode;
  className?: string;
  /** CSS-Selektor der animierten Kinder; Standard: direkte Kinder */
  selector?: string;
  stagger?: number;
  y?: number;
  scale?: number;
  as?: ElementType;
  /** Abhängigkeiten, bei deren Änderung neu animiert wird (z. B. Filterergebnis) */
  deps?: unknown[];
  once?: boolean;
  style?: CSSProperties;
}

export function ScrollReveal({ children, className, selector, stagger = 0.08, y = 28, scale = 1, as: Tag = 'div', deps = [], once = true, style }: RevealProps) {
  const ref = useGsap<HTMLDivElement>(
    ({ root, reduced }) => {
      const items = selector ? root.querySelectorAll<HTMLElement>(selector) : (Array.from(root.children) as HTMLElement[]);
      if (!items.length || reduced) return;
      gsap.set(items, { opacity: 0, y, scale });
      ScrollTrigger.batch(items as unknown as Element[], {
        start: 'top 92%',
        once,
        onEnter: (batch) => gsap.to(batch, { opacity: 1, y: 0, scale: 1, stagger, duration: 0.7, overwrite: true }),
      });
    },
    deps,
  );
  return (
    <Tag ref={ref} className={className} style={style}>
      {children}
    </Tag>
  );
}

// ---------- SplitHeadline: wortweise Textanimation ----------

interface SplitProps {
  text: string;
  className?: string;
  as?: ElementType;
  /** 'load' = sofort beim Mount, 'scroll' = beim Eintritt in den Viewport */
  trigger?: 'load' | 'scroll';
  delay?: number;
}

export function SplitHeadline({ text, className, as: Tag = 'h1', trigger = 'scroll', delay = 0 }: SplitProps) {
  const ref = useGsap<HTMLHeadingElement>(
    ({ root, reduced }) => {
      if (reduced) return;
      const words = root.querySelectorAll('[data-word]');
      gsap.from(words, {
        yPercent: 110,
        opacity: 0,
        duration: 0.9,
        stagger: 0.06,
        delay,
        ease: 'power4.out',
        scrollTrigger: trigger === 'scroll' ? { trigger: root, start: 'top 88%', once: true } : undefined,
      });
    },
    [text],
  );
  return (
    <Tag ref={ref} className={className} aria-label={text}>
      {text.split(' ').map((w, i) => (
        <span key={i} aria-hidden="true" className="inline-block overflow-hidden pb-[0.08em] align-bottom">
          <span data-word className="inline-block">
            {w}
            {i < text.split(' ').length - 1 ? ' ' : ''}
          </span>
        </span>
      ))}
    </Tag>
  );
}

// ---------- ScrollZoom: scrollgekoppelter Zoom eines Bildes ----------

interface ZoomProps {
  src: string;
  alt: string;
  className?: string;
  from?: number;
  to?: number;
  /** Abdunklung, die beim Scrollen zunimmt */
  darken?: boolean;
  children?: ReactNode;
  imgClassName?: string;
}

export function ScrollZoom({ src, alt, className = '', from = 1, to = 1.25, darken = true, children, imgClassName = '' }: ZoomProps) {
  const ref = useGsap<HTMLDivElement>(
    ({ root, reduced, small }) => {
      if (reduced) return;
      const img = root.querySelector('[data-zoom-img]');
      const shade = root.querySelector('[data-zoom-shade]');
      const tl = gsap.timeline({
        scrollTrigger: { trigger: root, start: 'top top+=10%', end: 'bottom top', scrub: small ? 0.3 : 0.6 },
      });
      tl.fromTo(img, { scale: from }, { scale: small ? Math.min(to, 1.12) : to, ease: 'none' }, 0);
      if (shade && darken) tl.fromTo(shade, { opacity: 0.35 }, { opacity: 0.85, ease: 'none' }, 0);
    },
    [src],
  );
  return (
    <div ref={ref} className={`relative overflow-hidden ${className}`}>
      <img data-zoom-img src={src} alt={alt} className={`h-full w-full object-cover will-change-transform ${imgClassName}`} />
      <div data-zoom-shade className="pointer-events-none absolute inset-0 bg-gradient-to-t from-bg via-bg/40 to-transparent" />
      {children}
    </div>
  );
}

// ---------- ParallaxSection: dezente Hintergrundbewegung ----------

interface ParallaxProps {
  image: string;
  children: ReactNode;
  className?: string;
  strength?: number;
}

export function ParallaxSection({ image, children, className = '', strength = 14 }: ParallaxProps) {
  const ref = useGsap<HTMLElement>(
    ({ root, reduced, small }) => {
      if (reduced || small) return;
      gsap.fromTo(
        root.querySelector('[data-parallax-bg]'),
        { yPercent: -strength },
        { yPercent: strength, ease: 'none', scrollTrigger: { trigger: root, start: 'top bottom', end: 'bottom top', scrub: true } },
      );
    },
    [image],
  );
  return (
    <section ref={ref} className={`relative overflow-hidden ${className}`}>
      <div aria-hidden="true" className="absolute inset-x-0 -inset-y-[20%]">
        <img data-parallax-bg src={image} alt="" className="h-full w-full object-cover opacity-40 will-change-transform" />
        <div className="absolute inset-0 bg-gradient-to-b from-bg via-bg/70 to-bg" />
      </div>
      <div className="relative">{children}</div>
    </section>
  );
}

// ---------- PinnedSection: Bild bleibt stehen, Inhalte daneben wechseln ----------

export interface PinnedStep {
  eyebrow: string;
  title: string;
  text: string;
  image: string;
  imageAlt: string;
}

interface PinnedProps {
  steps: PinnedStep[];
  className?: string;
}

export function PinnedSection({ steps, className = '' }: PinnedProps) {
  const ref = useGsap<HTMLElement>(
    ({ root, reduced, small }) => {
      // Auf Mobilgeräten und bei reduzierter Bewegung: einfache gestapelte Darstellung
      if (reduced || small) return;
      const texts = gsap.utils.toArray<HTMLElement>('[data-pin-text]', root);
      const imgs = gsap.utils.toArray<HTMLElement>('[data-pin-img]', root);
      const bar = root.querySelector('[data-pin-progress]');
      gsap.set(texts.slice(1), { autoAlpha: 0, y: 40 });
      gsap.set(imgs.slice(1), { autoAlpha: 0, scale: 1.08 });
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: root,
          start: 'top top',
          end: () => `+=${window.innerHeight * (steps.length - 0.4)}`,
          pin: true,
          scrub: 0.5,
          anticipatePin: 1,
          invalidateOnRefresh: true,
        },
      });
      for (let i = 1; i < steps.length; i++) {
        tl.to(texts[i - 1], { autoAlpha: 0, y: -40, duration: 0.5 }, i)
          .to(imgs[i - 1], { autoAlpha: 0, scale: 0.96, duration: 0.6 }, i)
          .to(texts[i], { autoAlpha: 1, y: 0, duration: 0.5 }, i + 0.2)
          .to(imgs[i], { autoAlpha: 1, scale: 1, duration: 0.6 }, i);
      }
      tl.to({}, { duration: 0.4 });
      if (bar) gsap.fromTo(bar, { scaleY: 0 }, { scaleY: 1, ease: 'none', scrollTrigger: { trigger: root, start: 'top top', end: () => `+=${window.innerHeight * (steps.length - 0.4)}`, scrub: true } });
    },
    [steps.length],
  );
  return (
    <section ref={ref} className={`relative ${className}`}>
      {/* Desktop: gepinnte Bühne */}
      <div className="hidden min-h-screen items-center md:flex">
        <div className="mx-auto grid w-full max-w-7xl grid-cols-2 items-center gap-12 px-10">
          <div className="relative flex h-[60vh] items-center">
            <div aria-hidden="true" className="absolute left-0 top-[10%] h-[80%] w-[3px] rounded bg-fg/10">
              <div data-pin-progress className="h-full w-full origin-top rounded bg-accent" />
            </div>
            {steps.map((s, i) => (
              <div key={i} data-pin-text className="absolute inset-x-0 pl-8" aria-hidden={i > 0 ? undefined : undefined}>
                <p className="eyebrow mb-3">{s.eyebrow}</p>
                <h2 className="mb-4 text-4xl font-extrabold leading-tight lg:text-5xl">{s.title}</h2>
                <p className="max-w-md text-lg text-muted">{s.text}</p>
              </div>
            ))}
          </div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-3xl">
            {steps.map((s, i) => (
              <img key={i} data-pin-img src={s.image} alt={s.imageAlt} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
            ))}
            <div className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-inset ring-white/10" />
          </div>
        </div>
      </div>
      {/* Mobil: gestapelt */}
      <div className="space-y-10 px-4 py-12 md:hidden">
        {steps.map((s, i) => (
          <div key={i}>
            <img src={s.image} alt={s.imageAlt} loading="lazy" className="mb-4 aspect-[4/3] w-full rounded-2xl object-cover" />
            <p className="eyebrow mb-2">{s.eyebrow}</p>
            <h2 className="mb-2 text-2xl font-extrabold">{s.title}</h2>
            <p className="text-muted">{s.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------- AnimatedSection: Seitenübergang beim Mount ----------

export function AnimatedSection({ children, className, routeKey }: { children: ReactNode; className?: string; routeKey?: string }) {
  const ref = useGsap<HTMLDivElement>(
    ({ root, reduced }) => {
      if (reduced) return;
      gsap.from(root, { opacity: 0, y: 16, duration: 0.5, clearProps: 'transform,opacity' });
    },
    [routeKey],
  );
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
