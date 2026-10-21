import { lazy, Suspense, useEffect, useState } from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { AnimatedLogo, LogoLoader } from './components/Logo';
import { consumeLoadWarning, useApp } from './store/appStore';
import { toast } from './store/uiStore';
import { gsap, prefersReducedMotion } from './animations/gsap';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Exercises = lazy(() => import('./pages/Exercises'));
const ExerciseDetail = lazy(() => import('./pages/ExerciseDetail'));
const Collection = lazy(() => import('./pages/Collection'));
const Plans = lazy(() => import('./pages/Plans'));
const PlanEditor = lazy(() => import('./pages/PlanEditor'));
const Generator = lazy(() => import('./pages/Generator'));
const Training = lazy(() => import('./pages/Training'));
const Progress = lazy(() => import('./pages/Progress'));
const Favorites = lazy(() => import('./pages/Favorites'));
const Settings = lazy(() => import('./pages/Settings'));
const NotFound = lazy(() => import('./pages/NotFound'));

function useThemeSync() {
  const theme = useApp((s) => s.settings.theme);
  const accent = useApp((s) => s.settings.accent);
  const reduced = useApp((s) => s.settings.reducedMotion);
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.dataset.accent = accent;
    root.classList.toggle('dark', theme === 'dark');
    root.classList.toggle('no-motion', reduced);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0a0a0b' : '#f6f6f4');
  }, [theme, accent, reduced]);
}

/** Kurzes Logo-Intro beim ersten Aufruf pro Browsersitzung */
function Splash() {
  const [show, setShow] = useState(() => {
    try {
      return !sessionStorage.getItem('gymbase:intro') && !prefersReducedMotion();
    } catch {
      return false;
    }
  });
  const close = () => {
    try {
      sessionStorage.setItem('gymbase:intro', '1');
    } catch {
      /* ignorieren */
    }
    const el = document.getElementById('splash');
    if (el) gsap.to(el, { opacity: 0, duration: 0.5, onComplete: () => setShow(false) });
    else setShow(false);
  };
  if (!show) return null;
  return (
    <div id="splash" className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[#050505]">
      <AnimatedLogo className="w-[min(70vw,460px)]" onDone={() => window.setTimeout(close, 350)} />
      <button type="button" onClick={close} className="absolute bottom-8 text-sm text-white/50 hover:text-white">
        Intro überspringen
      </button>
    </div>
  );
}

export default function App() {
  useThemeSync();
  useEffect(() => {
    const w = consumeLoadWarning();
    if (w) toast(w, 'error');
  }, []);
  return (
    <HashRouter>
      <Splash />
      <Layout>
        <Suspense fallback={<LogoLoader />}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/uebungen" element={<Exercises />} />
            <Route path="/uebungen/:id" element={<ExerciseDetail />} />
            <Route path="/sammlung" element={<Collection />} />
            <Route path="/plaene" element={<Plans />} />
            <Route path="/plaene/generator" element={<Generator />} />
            <Route path="/plaene/:id" element={<PlanEditor />} />
            <Route path="/training" element={<Training />} />
            <Route path="/fortschritt" element={<Progress />} />
            <Route path="/favoriten" element={<Favorites />} />
            <Route path="/einstellungen" element={<Settings />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </Layout>
    </HashRouter>
  );
}
