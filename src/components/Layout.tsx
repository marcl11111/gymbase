import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { BarChart3, ClipboardList, Dumbbell, FolderHeart, Heart, LayoutDashboard, Menu, Settings, Timer, X } from 'lucide-react';
import { LogoCompact } from './Logo';
import { ConfirmHost, ToastHost } from './ui';
import { useApp } from '../store/appStore';
import { AnimatedSection } from '../animations';
import { ScrollTrigger } from '../animations/gsap';

export const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/uebungen', label: 'Übungen', icon: Dumbbell },
  { to: '/sammlung', label: 'Meine Sammlung', icon: FolderHeart },
  { to: '/plaene', label: 'Trainingspläne', icon: ClipboardList },
  { to: '/training', label: 'Trainingsmodus', icon: Timer },
  { to: '/fortschritt', label: 'Fortschritt', icon: BarChart3 },
  { to: '/favoriten', label: 'Favoriten', icon: Heart },
  { to: '/einstellungen', label: 'Einstellungen', icon: Settings },
] as const;

const MOBILE_MAIN = ['/', '/uebungen', '/plaene', '/training'];

function ActiveDot() {
  const active = useApp((s) => s.activeSession !== null);
  if (!active) return null;
  return <span className="absolute right-2 top-2 h-2 w-2 animate-pulse rounded-full bg-accent" aria-label="Training läuft" />;
}

export function Layout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    setMoreOpen(false);
    const t = window.setTimeout(() => ScrollTrigger.refresh(), 300);
    return () => window.clearTimeout(t);
  }, [location.pathname]);

  return (
    <div className="min-h-screen">
      <a href="#main" className="sr-only z-[100] rounded-lg bg-accent px-4 py-2 font-semibold text-accent-fg focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        Zum Inhalt springen
      </a>

      {/* Desktop-Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r hairline bg-bg/80 backdrop-blur-xl lg:flex">
        <NavLink to="/" className="flex h-20 items-center px-6" aria-label="GymBase – zum Dashboard">
          <LogoCompact />
        </NavLink>
        <nav aria-label="Hauptnavigation" className="flex-1 space-y-1 px-3">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `relative flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-sm font-medium transition ${isActive ? 'bg-fg/[0.06] text-fg' : 'text-muted hover:bg-fg/[0.04] hover:text-fg'}`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={`absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r bg-accent transition-opacity ${isActive ? 'opacity-100' : 'opacity-0'}`} aria-hidden="true" />
                  <Icon size={19} className={isActive ? 'text-accent' : ''} aria-hidden="true" />
                  {label}
                  {to === '/training' && <ActiveDot />}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <p className="px-6 py-5 text-[11px] leading-relaxed text-muted">Daten werden lokal in diesem Browser gespeichert.</p>
      </aside>

      {/* Mobile Kopfzeile */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b hairline bg-bg/85 px-4 backdrop-blur-xl lg:hidden">
        <NavLink to="/" aria-label="GymBase – zum Dashboard">
          <LogoCompact showWord />
        </NavLink>
      </header>

      <main id="main" className="lg:pl-64">
        <AnimatedSection routeKey={location.pathname}>{children}</AnimatedSection>
      </main>

      {/* Mobile Bottom-Navigation */}
      <nav aria-label="Hauptnavigation mobil" className="fixed inset-x-0 bottom-0 z-50 border-t hairline bg-bg/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
        <ul className="grid grid-cols-5">
          {NAV.filter((n) => MOBILE_MAIN.includes(n.to)).map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink to={to} end={to === '/'} className={({ isActive }) => `relative flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium ${isActive ? 'text-accent' : 'text-muted'}`}>
                <Icon size={21} aria-hidden="true" />
                {label === 'Trainingspläne' ? 'Pläne' : label === 'Trainingsmodus' ? 'Training' : label}
                {to === '/training' && <ActiveDot />}
              </NavLink>
            </li>
          ))}
          <li>
            <button type="button" onClick={() => setMoreOpen(true)} aria-expanded={moreOpen} className="flex h-16 w-full flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted">
              <Menu size={21} aria-hidden="true" />
              Mehr
            </button>
          </li>
        </ul>
      </nav>

      {moreOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden" role="dialog" aria-modal="true" aria-label="Weitere Bereiche">
          <button type="button" className="absolute inset-0 bg-black/60" aria-label="Menü schließen" onClick={() => setMoreOpen(false)} />
          <div className="card absolute inset-x-0 bottom-0 rounded-b-none p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-bold">Weitere Bereiche</span>
              <button type="button" className="icon-btn" onClick={() => setMoreOpen(false)} aria-label="Schließen">
                <X size={20} />
              </button>
            </div>
            <ul className="grid grid-cols-2 gap-2">
              {NAV.filter((n) => !MOBILE_MAIN.includes(n.to)).map(({ to, label, icon: Icon }) => (
                <li key={to}>
                  <NavLink to={to} className={({ isActive }) => `flex min-h-[56px] items-center gap-3 rounded-xl border hairline px-4 text-sm font-semibold ${isActive ? 'text-accent' : ''}`}>
                    <Icon size={20} aria-hidden="true" /> {label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <ToastHost />
      <ConfirmHost />
    </div>
  );
}
