import { useLayoutEffect, useRef, type DependencyList, type RefObject } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { getState } from '../store/appStore';

gsap.registerPlugin(ScrollTrigger);
gsap.defaults({ ease: 'power3.out', duration: 0.8 });

export { gsap, ScrollTrigger };

export function prefersReducedMotion(): boolean {
  if (getState().settings.reducedMotion) return true;
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

export function isSmallScreen(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(max-width: 767px)').matches;
}

/**
 * Führt GSAP-Code in einem gsap.context aus, der beim Unmount/bei Abhängigkeitsänderung
 * vollständig zurückgesetzt wird (inkl. aller ScrollTrigger) – verhindert doppelte Trigger.
 */
export function useGsap<T extends HTMLElement>(
  setup: (ctx: { root: T; reduced: boolean; small: boolean }) => void,
  deps: DependencyList = [],
): RefObject<T> {
  const ref = useRef<T>(null);
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const reduced = prefersReducedMotion();
    const ctx = gsap.context(() => setup({ root, reduced, small: isSmallScreen() }), root);
    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return ref;
}

let refreshTimer: number | undefined;
/** Entprelltes ScrollTrigger.refresh – z. B. nach Bild-Ladevorgängen oder Layoutänderungen */
export function refreshScrollTriggers(): void {
  window.clearTimeout(refreshTimer);
  refreshTimer = window.setTimeout(() => ScrollTrigger.refresh(), 120);
}
