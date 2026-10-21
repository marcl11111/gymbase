import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Images, Maximize2 } from 'lucide-react';
import type { Exercise } from '../types';
import { Modal, SmartImage, useImageSrc } from './ui';
import { gsap, prefersReducedMotion, refreshScrollTriggers } from '../animations/gsap';
import { IMAGE_CREDIT } from '../data/exercises';

/**
 * Aufklappbare Fotoanleitung.
 * - Standardmäßig geschlossen; Inhalte (und damit Bilder) werden erst beim Öffnen gerendert.
 * - Jede Instanz verwaltet ihren Zustand unabhängig.
 */
export function PhotoGuide({ exercise, compact = false }: { exercise: Exercise; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const regionId = useId();
  const steps = exercise.photoGuide;

  useEffect(() => {
    const el = bodyRef.current;
    if (!el || !mounted) return;
    const reduced = prefersReducedMotion();
    if (open) {
      if (reduced) gsap.set(el, { height: 'auto', opacity: 1 });
      else {
        gsap.fromTo(el, { height: 0, opacity: 0 }, { height: 'auto', opacity: 1, duration: 0.55, ease: 'power3.out', onComplete: refreshScrollTriggers });
        gsap.fromTo(el.querySelectorAll('[data-step]'), { y: 18, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.07, duration: 0.5, delay: 0.1 });
      }
    } else {
      if (reduced) {
        gsap.set(el, { height: 0, opacity: 0 });
        setMounted(false);
      } else {
        gsap.to(el, {
          height: 0,
          opacity: 0,
          duration: 0.4,
          ease: 'power2.inOut',
          onComplete: () => {
            setMounted(false);
            refreshScrollTriggers();
          },
        });
      }
    }
  }, [open, mounted]);

  const toggle = () => {
    if (!open) setMounted(true);
    setOpen((o) => !o);
  };

  return (
    <div className={compact ? '' : 'card p-4 sm:p-5'}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={regionId}
        className={`flex w-full items-center justify-between gap-3 rounded-xl text-left font-semibold transition ${compact ? 'min-h-[44px] px-3 text-sm hover:bg-fg/5' : 'min-h-[48px] px-1 hover:text-accent'}`}
      >
        <span className="inline-flex items-center gap-2.5">
          <Images size={compact ? 16 : 20} className={open ? 'text-accent' : 'text-muted'} aria-hidden="true" />
          {open ? 'Fotoanleitung ausblenden' : 'Fotoanleitung anzeigen'}
          {!compact && <span className="tag">{steps.length} Schritte</span>}
        </span>
        <ChevronDown size={18} aria-hidden="true" className={`shrink-0 transition-transform duration-300 ${open ? 'rotate-180 text-accent' : 'text-muted'}`} />
      </button>
      {mounted && (
        <div ref={bodyRef} id={regionId} role="region" aria-label={`Fotoanleitung ${exercise.name}`} className="collapse-body" style={{ height: 0, opacity: 0 }}>
          {steps.length === 0 ? (
            <p className="px-1 pt-4 text-sm text-muted">Für diese Übung wurde noch keine Fotoanleitung angelegt.</p>
          ) : (
            <>
              <ol className={`scrollbar-none -mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pt-4 sm:grid sm:overflow-visible ${compact ? 'sm:grid-cols-2' : steps.length >= 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-3'}`}>
                {steps.map((s, i) => (
                  <li key={i} data-step className="w-[78%] shrink-0 snap-start sm:w-auto">
                    <div className="group relative">
                      {s.imageUrl ? (
                        <button type="button" className="block w-full overflow-hidden rounded-xl" onClick={() => setLightbox(i)} aria-label={`Bild vergrößern: Schritt ${s.stepNumber} – ${s.title}`}>
                          <SmartImage src={s.imageUrl} alt={s.altText} className="aspect-[3/2] rounded-xl" imgClassName="transition duration-500 group-hover:scale-105" />
                          <span className="absolute right-2 top-2 rounded-lg bg-black/60 p-1.5 text-white opacity-0 transition group-hover:opacity-100" aria-hidden="true">
                            <Maximize2 size={14} />
                          </span>
                        </button>
                      ) : (
                        <SmartImage src={null} alt={s.altText} className="aspect-[3/2] rounded-xl" placeholder="Platzhalter – kein Foto für diesen Schritt" />
                      )}
                      <span className="absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-accent text-xs font-extrabold text-accent-fg" aria-hidden="true">
                        {s.stepNumber}
                      </span>
                    </div>
                    <h4 className="mt-3 text-sm font-bold">
                      <span className="sr-only">Schritt {s.stepNumber}: </span>
                      {s.title}
                    </h4>
                    <p className="mt-1 text-sm leading-relaxed text-muted">{s.description}</p>
                  </li>
                ))}
              </ol>
              {!exercise.isCustom && <p className="mt-3 px-1 text-[11px] text-muted">{IMAGE_CREDIT}</p>}
            </>
          )}
        </div>
      )}
      {lightbox !== null && <Lightbox exercise={exercise} index={lightbox} onIndex={setLightbox} onClose={() => setLightbox(null)} />}
    </div>
  );
}

function Lightbox({ exercise, index, onIndex, onClose }: { exercise: Exercise; index: number; onIndex: (i: number) => void; onClose: () => void }) {
  const withImg = exercise.photoGuide.map((s, i) => ({ s, i })).filter((x) => x.s.imageUrl);
  const pos = withImg.findIndex((x) => x.i === index);
  const step = exercise.photoGuide[index];
  const url = useImageSrc(step?.imageUrl);
  const go = (d: number) => {
    const next = withImg[(pos + d + withImg.length) % withImg.length];
    if (next) onIndex(next.i);
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  if (!step) return null;
  return (
    <Modal open onClose={onClose} title={`Schritt ${step.stepNumber}: ${step.title}`} size="xl" bare>
      <div className="flex flex-col items-center gap-4">
        {url && <img src={url} alt={step.altText} className="max-h-[70vh] w-auto rounded-xl object-contain" />}
        <p className="max-w-2xl text-center text-sm text-white/80">{step.description}</p>
        {withImg.length > 1 && (
          <div className="flex items-center gap-3">
            <button type="button" className="btn bg-white/10 text-white hover:bg-white/20" onClick={() => go(-1)}>
              <ChevronLeft size={18} aria-hidden="true" /> Zurück
            </button>
            <span className="text-sm tabular-nums text-white/70">
              {pos + 1} / {withImg.length}
            </span>
            <button type="button" className="btn bg-white/10 text-white hover:bg-white/20" onClick={() => go(1)}>
              Weiter <ChevronRight size={18} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
