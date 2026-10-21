/** Kleine UI-Stores: Toasts und Bestätigungsdialoge (Promise-basiert) */
import { useSyncExternalStore } from 'react';

export interface Toast {
  id: number;
  message: string;
  tone: 'success' | 'info' | 'error';
  action?: { label: string; run: () => void };
}

let toasts: Toast[] = [];
let toastId = 0;
const toastListeners = new Set<() => void>();
const emitToasts = () => toastListeners.forEach((l) => l());

export function toast(message: string, tone: Toast['tone'] = 'success', action?: Toast['action']): void {
  const t: Toast = { id: ++toastId, message, tone, action };
  toasts = [...toasts.slice(-3), t];
  emitToasts();
  setTimeout(() => dismissToast(t.id), action ? 6000 : 3500);
}

export function dismissToast(id: number): void {
  toasts = toasts.filter((t) => t.id !== id);
  emitToasts();
}

export function useToasts(): Toast[] {
  return useSyncExternalStore(
    (l) => {
      toastListeners.add(l);
      return () => toastListeners.delete(l);
    },
    () => toasts,
  );
}

export interface ConfirmRequest {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  /** Optionaler Text, der zur Bestätigung eingetippt werden muss */
  requireText?: string;
  resolve: (ok: boolean) => void;
}

let confirmReq: ConfirmRequest | null = null;
const confirmListeners = new Set<() => void>();

export function confirmDialog(opts: Omit<ConfirmRequest, 'resolve'>): Promise<boolean> {
  return new Promise((resolve) => {
    confirmReq = {
      ...opts,
      resolve: (ok) => {
        confirmReq = null;
        confirmListeners.forEach((l) => l());
        resolve(ok);
      },
    };
    confirmListeners.forEach((l) => l());
  });
}

export function useConfirmRequest(): ConfirmRequest | null {
  return useSyncExternalStore(
    (l) => {
      confirmListeners.add(l);
      return () => confirmListeners.delete(l);
    },
    () => confirmReq,
  );
}
