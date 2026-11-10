import { useCallback, useEffect, useRef, useState } from 'react';

export interface ConfirmRequest {
  title: string;
  message?: string;
  confirmLabel: string;
  danger?: boolean;
}

/** Eigener Bestätigungsdialog statt des englischen System-Dialogs. */
export function useConfirm() {
  const [request, setRequest] = useState<(ConfirmRequest & { resolve: (ok: boolean) => void }) | null>(null);

  const confirm = useCallback(
    (r: ConfirmRequest) => new Promise<boolean>((resolve) => setRequest({ ...r, resolve })),
    []
  );

  const close = useCallback(
    (ok: boolean) => {
      request?.resolve(ok);
      setRequest(null);
    },
    [request]
  );

  const dialog = request ? (
    <div className="absolute inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center" onClick={() => close(false)}>
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-[400px] rounded-2xl bg-white p-5 shadow-sheet"
        style={{ marginBottom: 'var(--safe-bottom)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-ink">{request.title}</h2>
        {request.message && <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{request.message}</p>}
        <div className="mt-5 flex gap-2">
          <button type="button" onClick={() => close(false)} className="flex-1 rounded-xl bg-canvas py-3 text-sm font-semibold text-ink">
            Abbrechen
          </button>
          <button
            type="button"
            onClick={() => close(true)}
            className={`flex-1 rounded-xl py-3 text-sm font-semibold text-white ${request.danger ? 'bg-behind' : 'bg-ink'}`}
          >
            {request.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { confirm, dialog, isOpen: request != null, cancel: () => close(false) };
}

/** Kurze Rückmeldung am oberen Rand. */
export function useToast() {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const show = useCallback((msg: string) => {
    setMessage(msg);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMessage(null), 2600);
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const toast = message ? (
    <div
      className="pointer-events-none absolute inset-x-0 z-50 flex justify-center px-4"
      style={{ top: 'calc(var(--safe-top) + 72px)' }}
      role="status"
    >
      <div className="rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-white shadow-float">{message}</div>
    </div>
  ) : null;

  return { show, toast };
}
