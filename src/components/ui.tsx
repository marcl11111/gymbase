import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle2, ImageOff, Info, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { dismissToast, useConfirmRequest, useToasts } from '../store/uiStore';
import { getImage, isIdbRef } from '../services/imageStore';
import { assetUrl } from '../utils';
import { gsap, prefersReducedMotion } from '../animations/gsap';

// ---------- Modal ----------

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Dunkler Vollbildmodus (z. B. Bild-Großansicht) */
  bare?: boolean;
}

export function Modal({ open, onClose, title, children, footer, size = 'md', bare }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const lastFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    lastFocus.current = document.activeElement as HTMLElement;
    const panel = panelRef.current;
    if (panel && !prefersReducedMotion()) gsap.fromTo(panel, { opacity: 0, y: 20, scale: 0.98 }, { opacity: 1, y: 0, scale: 1, duration: 0.35 });
    const focusable = () => Array.from(panel?.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])') ?? []).filter((el) => !el.hasAttribute('disabled'));
    (focusable()[0] ?? panel)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
      if (e.key === 'Tab') {
        const f = focusable();
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) {
          e.preventDefault();
          f[f.length - 1].focus();
        } else if (!e.shiftKey && document.activeElement === f[f.length - 1]) {
          e.preventDefault();
          f[0].focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      lastFocus.current?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;
  const widths = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' };
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center p-0 sm:items-center sm:p-6">
      <button type="button" aria-label="Dialog schließen" className={`absolute inset-0 cursor-default ${bare ? 'bg-black/90' : 'bg-black/60 backdrop-blur-sm'}`} onClick={onClose} tabIndex={-1} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`relative flex max-h-[92vh] w-full ${widths[size]} flex-col overflow-hidden ${bare ? '' : 'card rounded-b-none sm:rounded-2xl'}`}
      >
        <div className={`flex items-center justify-between gap-4 px-5 py-4 ${bare ? 'text-white' : 'border-b hairline'}`}>
          <h2 id={titleId} className="text-lg font-bold">
            {title}
          </h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Schließen">
            <X size={20} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t hairline px-5 py-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

// ---------- Bestätigungsdialog ----------

export function ConfirmHost() {
  const req = useConfirmRequest();
  const [typed, setTyped] = useState('');
  useEffect(() => setTyped(''), [req]);
  if (!req) return null;
  const blocked = !!req.requireText && typed.trim() !== req.requireText;
  return (
    <Modal
      open
      onClose={() => req.resolve(false)}
      title={req.title}
      size="sm"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={() => req.resolve(false)}>
            {req.cancelLabel ?? 'Abbrechen'}
          </button>
          <button type="button" className={req.danger ? 'btn bg-danger text-white hover:brightness-110' : 'btn-primary'} disabled={blocked} onClick={() => req.resolve(true)}>
            {req.confirmLabel ?? 'Bestätigen'}
          </button>
        </>
      }
    >
      <div className="flex gap-3">
        {req.danger && <AlertTriangle className="mt-0.5 shrink-0 text-danger" size={20} aria-hidden="true" />}
        <p className="text-sm leading-relaxed text-muted">{req.message}</p>
      </div>
      {req.requireText && (
        <div className="mt-4">
          <label className="label" htmlFor="confirm-text">
            Zur Bestätigung „{req.requireText}“ eingeben
          </label>
          <input id="confirm-text" className="input" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
        </div>
      )}
    </Modal>
  );
}

// ---------- Toasts ----------

export function ToastHost() {
  const toasts = useToasts();
  return (
    <div className="pointer-events-none fixed inset-x-0 top-16 z-[90] flex flex-col items-center gap-2 px-4 lg:left-auto lg:right-6 lg:top-6 lg:w-[400px] lg:px-0" aria-live="polite" role="status">
      {toasts.map((t) => (
        <div key={t.id} className="card pointer-events-auto flex w-full max-w-md items-center gap-3 px-4 py-3 shadow-2xl">
          {t.tone === 'success' && <CheckCircle2 size={18} className="shrink-0 text-accent" aria-hidden="true" />}
          {t.tone === 'info' && <Info size={18} className="shrink-0 text-muted" aria-hidden="true" />}
          {t.tone === 'error' && <AlertTriangle size={18} className="shrink-0 text-danger" aria-hidden="true" />}
          <p className="flex-1 text-sm">{t.message}</p>
          {t.action && (
            <button
              type="button"
              className="text-sm font-semibold text-accent hover:underline"
              onClick={() => {
                t.action?.run();
                dismissToast(t.id);
              }}
            >
              {t.action.label}
            </button>
          )}
          <button type="button" className="text-muted hover:text-fg" onClick={() => dismissToast(t.id)} aria-label="Meldung schließen">
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}

// ---------- Bilder ----------

/** Löst lokale Pfade, öffentliche URLs und IndexedDB-Referenzen (idb:) auf */
export function useImageSrc(ref: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(() => (ref && !isIdbRef(ref) ? assetUrl(ref) : null));
  useEffect(() => {
    if (!ref) {
      setUrl(null);
      return;
    }
    if (!isIdbRef(ref)) {
      setUrl(assetUrl(ref));
      return;
    }
    let objectUrl: string | null = null;
    let cancelled = false;
    getImage(ref)
      .then((blob) => {
        if (cancelled || !blob) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => setUrl(null));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [ref]);
  return url;
}

interface SmartImageProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  imgClassName?: string;
  /** Text im Platzhalter, wenn kein Bild vorhanden ist */
  placeholder?: string;
  eager?: boolean;
}

export function SmartImage({ src, alt, className = '', imgClassName = '', placeholder = 'Kein Foto vorhanden', eager }: SmartImageProps) {
  const url = useImageSrc(src);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);
  if (!url || failed) {
    return (
      <div className={`img-fallback flex flex-col items-center justify-center gap-2 text-center text-xs text-muted ${className}`} role="img" aria-label={`${placeholder}: ${alt}`}>
        <ImageOff size={22} aria-hidden="true" />
        <span className="px-3 font-medium">{placeholder}</span>
      </div>
    );
  }
  return (
    <div className={`overflow-hidden bg-elevated ${className}`}>
      <img src={url} alt={alt} loading={eager ? 'eager' : 'lazy'} decoding="async" onError={() => setFailed(true)} className={`h-full w-full object-cover ${imgClassName}`} />
    </div>
  );
}

// ---------- Leerzustand ----------

interface EmptyProps {
  icon: ReactNode;
  title: string;
  text: string;
  action?: { label: string; to?: string; onClick?: () => void };
  className?: string;
}

export function EmptyState({ icon, title, text, action, className = '' }: EmptyProps) {
  return (
    <div className={`card flex flex-col items-center px-6 py-12 text-center ${className}`}>
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 text-accent" aria-hidden="true">
        {icon}
      </div>
      <h3 className="mb-1.5 text-lg font-bold">{title}</h3>
      <p className="mb-5 max-w-sm text-sm text-muted">{text}</p>
      {action &&
        (action.to ? (
          <Link to={action.to} className="btn-primary">
            {action.label}
          </Link>
        ) : (
          <button type="button" className="btn-primary" onClick={action.onClick}>
            {action.label}
          </button>
        ))}
    </div>
  );
}

// ---------- Kleine Bausteine ----------

export function PageHeader({ eyebrow, title, text, actions }: { eyebrow?: string; title: string; text?: string; actions?: ReactNode }) {
  return (
    <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="text-3xl font-extrabold sm:text-4xl">{title}</h1>
        {text && <p className="mt-2 max-w-2xl text-muted">{text}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function Stat({ label, value, hint, icon }: { label: string; value: ReactNode; hint?: string; icon?: ReactNode }) {
  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center justify-between text-muted">
        <span className="text-xs font-semibold uppercase tracking-wider">{label}</span>
        {icon && <span aria-hidden="true">{icon}</span>}
      </div>
      <div className="font-display text-3xl font-extrabold">{value}</div>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function Field({ label, htmlFor, children, hint, error }: { label: string; htmlFor: string; children: ReactNode; hint?: string; error?: string | null }) {
  return (
    <div>
      <label className="label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-xs text-danger" role="alert">
          {error}
        </p>
      ) : (
        hint && <p className="mt-1 text-xs text-muted">{hint}</p>
      )}
    </div>
  );
}

export function NumberInput({
  id,
  value,
  onChange,
  min = 0,
  max = 9999,
  step = 1,
  allowEmpty = false,
  className = '',
  ariaLabel,
}: {
  id?: string;
  value: number | null;
  onChange: (v: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
  allowEmpty?: boolean;
  className?: string;
  ariaLabel?: string;
}) {
  const [text, setText] = useState(value === null ? '' : String(value));
  useEffect(() => {
    const parsed = text === '' ? null : Number(text.replace(',', '.'));
    if (parsed !== value) setText(value === null ? '' : String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <input
      id={id}
      aria-label={ariaLabel}
      inputMode="decimal"
      className={`input text-center tabular-nums ${className}`}
      value={text}
      onChange={(e) => {
        const t = e.target.value.replace(/[^\d.,]/g, '');
        setText(t);
        if (t === '') {
          if (allowEmpty) onChange(null);
          return;
        }
        const n = Number(t.replace(',', '.'));
        if (!Number.isNaN(n)) onChange(Math.min(max, Math.max(min, step === 1 ? Math.round(n) : n)));
      }}
      onBlur={() => {
        if (text === '' && !allowEmpty) setText(String(value ?? min));
        else if (value !== null) setText(String(value));
      }}
    />
  );
}
