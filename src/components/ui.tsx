import type { ReactNode } from 'react';

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  disabled,
  size = 'md',
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
}) {
  return (
    <div className={`flex rounded-xl bg-canvas p-1 ${disabled ? 'opacity-50' : ''}`} role="radiogroup">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={`flex-1 rounded-lg font-medium transition-colors ${
              size === 'sm' ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'
            } ${active ? 'bg-white text-ink shadow-[0_1px_3px_rgba(0,0,0,0.12)]' : 'text-muted'}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`flex w-full items-center justify-between gap-4 py-3 text-left ${disabled ? 'opacity-50' : ''}`}
    >
      <span>
        <span className="block text-sm font-medium text-ink">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-muted">{hint}</span>}
      </span>
      <span className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${checked ? 'bg-ink' : 'bg-line'}`}>
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-[18px]' : 'translate-x-0.5'
          }`}
        />
      </span>
    </button>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

export function Button({
  children,
  onClick,
  variant = 'secondary',
  disabled,
  className = '',
  title,
  active,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  className?: string;
  title?: string;
  active?: boolean;
}) {
  const styles: Record<ButtonVariant, string> = {
    primary: 'bg-ink text-white active:bg-ink-2',
    secondary: active ? 'bg-ink text-white' : 'bg-canvas text-ink active:bg-line',
    danger: 'bg-behind-soft text-behind active:bg-behind/20',
    ghost: 'text-ink active:bg-canvas',
  };
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors disabled:opacity-40 ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function SectionLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-2 mt-5 flex items-center justify-between first:mt-0">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{children}</h3>
      {right}
    </div>
  );
}

export function Stat({ label, value, unit, tone }: { label: string; value: ReactNode; unit?: string; tone?: 'pacer' }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">{label}</div>
      <div className={`num mt-0.5 truncate text-xl font-semibold leading-tight ${tone === 'pacer' ? 'text-pacer' : 'text-ink'}`}>
        {value}
        {unit && <span className="ml-1 text-xs font-medium text-muted">{unit}</span>}
      </div>
    </div>
  );
}

export function Notice({ tone = 'neutral', children }: { tone?: 'neutral' | 'warn'; children: ReactNode }) {
  return (
    <div
      className={`rounded-xl px-3 py-2.5 text-xs leading-relaxed ${
        tone === 'warn' ? 'bg-behind-soft text-behind' : 'bg-canvas text-ink-2'
      }`}
    >
      {children}
    </div>
  );
}
