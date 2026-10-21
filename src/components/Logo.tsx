/**
 * GymBase-Logo, aus dem Original in vier transparente Ebenen zerlegt
 * (C-Teil weiß, B-Teil gelb, Schriftzug „GYM“ und „BASE“), damit die Teile
 * unabhängig animiert werden können.
 */
import { useRef } from 'react';
import { gsap, useGsap } from '../animations/gsap';
import { assetUrl } from '../utils';

const src = (n: string) => assetUrl(`brand/${n}.png`) ?? '';

interface LogoProps {
  className?: string;
  /** intro: Aufbau-Animation beim Mount · scroll: an Scrollposition gekoppelt · static: keine Animation */
  mode?: 'intro' | 'scroll' | 'static';
  delay?: number;
  onDone?: () => void;
}

/** Vollständiges Logo (Bildmarke + Schriftzug) */
export function AnimatedLogo({ className = '', mode = 'intro', delay = 0, onDone }: LogoProps) {
  const ref = useGsap<HTMLDivElement>(
    ({ root, reduced }) => {
      const c = root.querySelector('[data-l=c]');
      const b = root.querySelector('[data-l=b]');
      const gym = root.querySelector('[data-l=gym]');
      const base = root.querySelector('[data-l=base]');
      const glow = root.querySelector('[data-l=glow]');
      if (reduced || mode === 'static') {
        onDone?.();
        return;
      }
      if (mode === 'intro') {
        const tl = gsap.timeline({ delay, onComplete: onDone });
        tl.from(c, { xPercent: -30, opacity: 0, duration: 0.9, ease: 'expo.out' })
          .from(b, { xPercent: 30, opacity: 0, duration: 0.9, ease: 'expo.out' }, '<')
          .fromTo(glow, { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.5, ease: 'power2.out' }, '-=0.45')
          .to(glow, { opacity: 0.35, duration: 0.8 })
          .from(gym, { yPercent: 60, opacity: 0, duration: 0.6 }, '-=1.1')
          .from(base, { yPercent: 60, opacity: 0, duration: 0.6 }, '-=0.95')
          // „Hantel anheben“: Bildmarke kurz nach oben und zurück
          .to([c, b], { y: -6, duration: 0.25, ease: 'power2.out' }, '-=0.2')
          .to([c, b], { y: 0, duration: 0.5, ease: 'bounce.out' });
      } else {
        // Scrollgekoppelt: Bildmarke teilt sich und Schriftzug blendet aus, wenn der Hero verlassen wird
        const tl = gsap.timeline({
          scrollTrigger: { trigger: root, start: 'top top+=80', end: '+=420', scrub: 0.5 },
        });
        tl.to(c, { xPercent: -14, ease: 'none' }, 0)
          .to(b, { xPercent: 14, ease: 'none' }, 0)
          .to(glow, { opacity: 0.9, scale: 1.3, ease: 'none' }, 0)
          .to([gym, base], { opacity: 0, yPercent: 30, ease: 'none' }, 0)
          .to(root, { scale: 0.85, opacity: 0, ease: 'none' }, 0.3);
      }
    },
    [mode],
  );
  return (
    <div ref={ref} className={`relative aspect-[1015/540] select-none ${className}`} role="img" aria-label="GymBase">
      <div data-l="glow" aria-hidden="true" className="logo-glow absolute left-1/2 top-[33%] h-[60%] w-[40%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/30 opacity-0 blur-3xl" />
      <img data-l="c" src={src('mark-c')} alt="" aria-hidden="true" draggable={false} className="logo-white absolute left-[12.81%] top-[0.93%] w-[72.9%] will-change-transform" />
      <img data-l="b" src={src('mark-b')} alt="" aria-hidden="true" draggable={false} className="absolute left-[12.81%] top-[0.93%] w-[72.9%] will-change-transform" />
      <div className="absolute left-[0.985%] top-[75.93%] w-[98.03%] overflow-hidden">
        <img data-l="gym" src={src('word-gym')} alt="" aria-hidden="true" draggable={false} className="logo-white relative block w-full" />
        <img data-l="base" src={src('word-base')} alt="" aria-hidden="true" draggable={false} className="absolute inset-0 w-full" />
      </div>
    </div>
  );
}

/** Kompaktes Logo für Navigation: Bildmarke mit Hover-Animation + Schriftzug */
export function LogoCompact({ className = '', showWord = true }: { className?: string; showWord?: boolean }) {
  const cRef = useRef<HTMLImageElement>(null);
  const bRef = useRef<HTMLImageElement>(null);
  const hover = (on: boolean) => {
    if (!cRef.current || !bRef.current) return;
    gsap.to(cRef.current, { x: on ? -2 : 0, duration: 0.35 });
    gsap.to(bRef.current, { x: on ? 2 : 0, duration: 0.35 });
  };
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`} onMouseEnter={() => hover(true)} onMouseLeave={() => hover(false)} aria-label="GymBase">
      <span className="relative block h-8 w-[68px]" aria-hidden="true">
        <img ref={cRef} src={src('mark-c')} alt="" className="logo-white absolute inset-0 h-full w-full object-contain" />
        <img ref={bRef} src={src('mark-b')} alt="" className="absolute inset-0 h-full w-full object-contain" />
      </span>
      {showWord && (
        <span className="relative block h-[14px] w-[112px]" aria-hidden="true">
          <img src={src('word-gym')} alt="" className="logo-white absolute inset-0 h-full w-full object-contain" />
          <img src={src('word-base')} alt="" className="absolute inset-0 h-full w-full object-contain" />
        </span>
      )}
    </span>
  );
}

/** Ladeindikator: pulsierende Bildmarke */
export function LogoLoader({ label = 'Lädt …' }: { label?: string }) {
  const ref = useGsap<HTMLDivElement>(({ root, reduced }) => {
    if (reduced) return;
    const [c, b] = root.querySelectorAll('img');
    gsap.timeline({ repeat: -1, yoyo: true }).to(c, { xPercent: -6, duration: 0.5, ease: 'sine.inOut' }, 0).to(b, { xPercent: 6, duration: 0.5, ease: 'sine.inOut' }, 0);
  });
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4" role="status">
      <div ref={ref} className="relative h-12 w-[100px]" aria-hidden="true">
        <img src={src('mark-c')} alt="" className="logo-white absolute inset-0 h-full w-full object-contain" />
        <img src={src('mark-b')} alt="" className="absolute inset-0 h-full w-full object-contain" />
      </div>
      <span className="text-sm text-muted">{label}</span>
    </div>
  );
}
