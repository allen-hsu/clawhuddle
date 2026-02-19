'use client';

import { createContext, useCallback, useContext, useState, useRef, type ReactNode } from 'react';

/* ─── Types ─── */

interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

/* ─── Context ─── */

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within <ConfirmProvider>');
  return ctx;
}

/* ─── Provider ─── */

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<(ConfirmOptions & { open: boolean; exiting: boolean }) | null>(null);
  const resolveRef = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setState({ ...options, open: true, exiting: false });
    });
  }, []);

  const close = useCallback((result: boolean) => {
    setState((prev) => prev ? { ...prev, exiting: true } : null);
    setTimeout(() => {
      resolveRef.current?.(result);
      resolveRef.current = null;
      setState(null);
    }, 150);
  }, []);

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}

      {state?.open && (
        <>
          {/* Backdrop */}
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9998,
              background: 'rgba(0, 0, 0, 0.6)',
              backdropFilter: 'blur(4px)',
              animation: state.exiting ? 'fade-out 0.15s ease-in forwards' : 'fade-in 0.15s ease-out',
            }}
            onClick={() => close(false)}
          />

          {/* Dialog */}
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 24,
            }}
          >
            <div
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-primary)',
                borderRadius: 14,
                boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
                width: '100%',
                maxWidth: 400,
                padding: 24,
                animation: state.exiting ? 'dialog-exit 0.15s ease-in forwards' : 'dialog-enter 0.2s ease-out',
              }}
            >
              <h3
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  marginBottom: state.description ? 8 : 20,
                  fontFamily: 'var(--font-geist-sans), system-ui, sans-serif',
                }}
              >
                {state.title}
              </h3>

              {state.description && (
                <p
                  style={{
                    fontSize: 13,
                    lineHeight: '1.5',
                    color: 'var(--text-secondary)',
                    marginBottom: 20,
                    fontFamily: 'var(--font-geist-sans), system-ui, sans-serif',
                  }}
                >
                  {state.description}
                </p>
              )}

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => close(false)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 500,
                    background: 'var(--bg-tertiary)',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border-primary)',
                    cursor: 'pointer',
                    transition: 'background 0.15s, color 0.15s',
                    fontFamily: 'var(--font-geist-sans), system-ui, sans-serif',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--bg-hover)';
                    e.currentTarget.style.color = 'var(--text-primary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--bg-tertiary)';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }}
                >
                  {state.cancelLabel || 'Cancel'}
                </button>
                <button
                  onClick={() => close(true)}
                  autoFocus
                  style={{
                    padding: '8px 16px',
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 500,
                    background: state.danger ? 'var(--red)' : 'var(--accent)',
                    color: 'var(--text-inverse)',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'background 0.15s, box-shadow 0.15s',
                    fontFamily: 'var(--font-geist-sans), system-ui, sans-serif',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = state.danger ? '#fca5a5' : 'var(--accent-hover)';
                    e.currentTarget.style.boxShadow = `0 0 16px ${state.danger ? 'rgba(248,113,113,0.3)' : 'rgba(199,148,74,0.3)'}`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = state.danger ? 'var(--red)' : 'var(--accent)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  {state.confirmLabel || 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </ConfirmContext.Provider>
  );
}
