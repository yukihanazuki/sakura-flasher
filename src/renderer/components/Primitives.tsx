import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, CheckCircle2, Sparkles, X } from 'lucide-react';

export function InfoCard({
  title,
  children,
  actions,
  className,
  bodyClassName,
  badge,
  icon,
}: {
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  badge?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <section className={cn('glass overflow-hidden', className)}>
      <div className="flex items-center justify-between gap-3 border-b-2 border-line bg-surface2 px-4 py-3">
        <div className="flex items-center gap-2">
          {icon ? <span className="text-accent">{icon}</span> : null}
          <div className="flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-muted">
            <span>{title}</span>
            {badge}
          </div>
        </div>
        {actions}
      </div>
      <div className={cn('p-4 md:p-5', bodyClassName)}>{children}</div>
    </section>
  );
}

export function GlassCard({
  children,
  className,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'glass glass-hover p-4 md:p-5',
        onClick && 'cursor-pointer',
        className
      )}
    >
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  sub,
  icon,
  trend,
  className,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  trend?: 'good' | 'bad' | 'neutral';
  className?: string;
}) {
  const trendColor =
    trend === 'good' ? 'text-success' : trend === 'bad' ? 'text-danger' : 'text-faint';
  return (
    <div className={cn('glass glass-hover relative overflow-hidden p-4', className)}>
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted">{label}</span>
        {icon ? <span className="text-muted/80">{icon}</span> : null}
      </div>
      <div className="mt-2 font-display text-xl tracking-tight text-text">{value}</div>
      {sub ? <div className={cn('mt-1 font-mono text-xs', trendColor)}>{sub}</div> : null}
    </div>
  );
}

export function EmptyState({
  title,
  hint,
  icon,
  action,
}: {
  title: string;
  hint?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="glass p-8 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center border-2 border-line bg-surface2 text-muted">
        {icon ?? <Sparkles size={20} className="text-accent" />}
      </div>
      <div className="text-sm font-semibold text-text">{title}</div>
      {hint ? <div className="mx-auto mt-1 max-w-sm text-xs text-muted">{hint}</div> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function Btn({
  label,
  onClick,
  variant = 'default',
  disabled,
  icon,
  className,
  type = 'button',
  title,
  size = 'md',
}: {
  label: string;
  onClick?: () => void;
  variant?: 'default' | 'danger' | 'accent' | 'ghost' | 'glass';
  disabled?: boolean;
  icon?: ReactNode;
  className?: string;
  type?: 'button' | 'submit';
  title?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizeClasses =
    size === 'sm'
      ? 'px-2.5 py-1 text-[11px] h-9'
      : size === 'lg'
      ? 'px-5 py-2.5 text-sm h-12'
      : 'px-3.5 py-2 text-xs h-10';

  return (
    <button
      type={type}
      title={title}
      aria-label={title ?? label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'font-display inline-flex items-center justify-center gap-1.5 rounded-sm uppercase tracking-wider transition-all duration-150',
        'border-2 active:translate-x-[2px] active:translate-y-[2px] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-none',
        sizeClasses,
        variant === 'danger'
          ? 'border-warning bg-surface2 text-warning shadow-[3px_3px_0_0_rgb(var(--warning)/0.35)] hover:bg-warning/10'
          : variant === 'accent'
          ? 'border-accent bg-accent text-white shadow-[4px_4px_0_0_rgb(var(--line-strong)/0.85)] hover:bg-accent/85'
          : variant === 'ghost'
          ? 'border-transparent bg-transparent text-muted hover:text-text'
          : variant === 'glass'
          ? 'border-line bg-surface text-text shadow-[3px_3px_0_0_rgb(var(--line-strong)/0.35)] hover:border-lineStrong'
          : 'border-line bg-surface2 text-text shadow-[3px_3px_0_0_rgb(var(--line-strong)/0.35)] hover:border-lineStrong hover:shadow-[4px_4px_0_0_rgb(var(--line-strong)/0.5)]',
        className
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn('block space-y-1.5', className)}>
      <span className="block font-mono text-[11px] font-bold uppercase tracking-wider text-muted">{label}</span>
      {children}
      {hint ? <span className="block font-mono text-[10px] text-faint">{hint}</span> : null}
    </label>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
  mono,
  className,
  disabled,
  type = 'text',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
  className?: string;
  disabled?: boolean;
  type?: 'text' | 'password' | 'number';
}) {
  return (
    <input
      type={type}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      spellCheck={false}
      className={cn(
        'focus:border-accent w-full rounded-sm border-2 border-line bg-surface2 px-3 py-2 text-xs text-text outline-none transition-colors placeholder:text-faint/80 disabled:opacity-50',
        mono && 'font-mono text-[11px]',
        className
      )}
    />
  );
}

export function Select({
  value,
  onChange,
  options,
  className,
  disabled,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  className?: string;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        'focus:border-accent w-full rounded-sm border-2 border-line bg-surface px-3 py-2 text-xs text-text outline-none transition-colors disabled:opacity-50',
        className
      )}
    >
      {placeholder ? <option value="">{placeholder}</option> : null}
      {options.map((o) => (
        <option key={o.value} value={o.value} className="bg-surface text-text">
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'focus-ring relative h-6 w-11 shrink-0 rounded-sm border-2 transition-all duration-200 disabled:opacity-40',
        checked ? 'border-accent bg-accent' : 'border-line bg-surface2'
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 h-4 w-4 rounded-sm bg-lineStrong shadow-[1px_1px_0_0_rgb(0_0_0/0.5)] transition-transform duration-200',
          checked ? 'translate-x-[22px]' : 'translate-x-[2px]'
        )}
      />
    </button>
  );
}

export function Badge({
  children,
  tone = 'neutral',
  className,
  dot = false,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'accent' | 'info';
  className?: string;
  dot?: boolean;
}) {
  const tones: Record<string, { bg: string; dot: string }> = {
    neutral: { bg: 'border-line bg-surface2 text-muted', dot: 'bg-muted' },
    success: { bg: 'border-success/60 bg-success/10 text-success', dot: 'bg-success' },
    warning: { bg: 'border-warning/60 bg-warning/10 text-warning', dot: 'bg-warning' },
    danger: { bg: 'border-danger/60 bg-danger/10 text-danger', dot: 'bg-danger' },
    accent: { bg: 'border-accent/60 bg-accent/15 text-accent', dot: 'bg-accent' },
    info: { bg: 'border-info/60 bg-info/10 text-info', dot: 'bg-info' },
  };
  return (
    <span
      className={cn(
        'font-mono inline-flex items-center gap-1.5 rounded-sm border-2 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
        tones[tone].bg,
        className
      )}
    >
      {dot ? <span className={cn('h-1.5 w-1.5', tones[tone].dot)} /> : null}
      {children}
    </span>
  );
}

export function ProgressBar({
  value,
  indeterminate,
  className,
}: {
  value?: number;
  indeterminate?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('h-3 w-full overflow-hidden border-2 border-line bg-surface2', className)}>
      <div
        className={cn('h-full bg-accent transition-[width] duration-300', indeterminate && 'w-1/3 animate-pulse')}
        style={indeterminate ? undefined : { width: `${Math.max(0, Math.min(100, value ?? 0))}%` }}
      />
    </div>
  );
}

export function Terminal({
  lines,
  className,
  empty,
}: {
  lines: { text: string; level?: string; time?: number }[];
  className?: string;
  empty?: string;
}) {
  return (
    <div
      className={cn(
        'max-h-80 min-h-[160px] overflow-auto rounded-sm border-2 border-line bg-surface2 p-4 font-mono text-[11px] leading-relaxed',
        className
      )}
    >
      {lines.length === 0 ? (
        <div className="italic text-faint">{empty ?? '— no output yet'}</div>
      ) : (
        lines.map((l, i) => (
          <div
            key={i}
            className={cn(
              'whitespace-pre-wrap break-all py-0.5',
              l.level === 'error' || l.level === 'stderr'
                ? 'text-danger'
                : l.level === 'warn'
                ? 'text-warning'
                : l.level === 'success'
                ? 'text-success'
                : l.level === 'command'
                ? 'text-info'
                : 'text-text/85'
            )}
          >
            {l.time ? (
              <span className="mr-2 text-faint/60">[{new Date(l.time).toLocaleTimeString()}]</span>
            ) : null}
            {l.text}
          </div>
        ))
      )}
    </div>
  );
}

export function Modal({
  open,
  title,
  children,
  onClose,
  footer,
  width,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
  width?: string;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className={cn('glass max-h-[85vh] w-full overflow-hidden shadow-manga-lg', width ?? 'max-w-lg')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b-2 border-line bg-surface2 px-5 py-4">
          <div className="font-display text-sm font-semibold text-text">{title}</div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-sm border-2 border-line p-1 text-muted hover:text-text"
          >
            <X size={16} />
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-5">{children}</div>
        {footer ? (
          <div className="flex justify-end gap-2 border-t-2 border-line bg-surface2 px-5 py-4">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}

export function Callout({
  tone = 'warning',
  title,
  children,
}: {
  tone?: 'warning' | 'danger' | 'success' | 'info';
  title?: string;
  children: ReactNode;
}) {
  const map = {
    warning: 'border-warning/60 bg-warning/10 text-warning',
    danger: 'border-danger/60 bg-danger/10 text-danger',
    success: 'border-success/60 bg-success/10 text-success',
    info: 'border-info/60 bg-info/10 text-info',
  } as const;
  const Icon = tone === 'success' ? CheckCircle2 : AlertTriangle;
  return (
    <div className={cn('flex gap-3 rounded-sm border-2 p-3 text-xs', map[tone])}>
      <Icon size={16} className="mt-0.5 shrink-0" />
      <div className="min-w-0">
        {title ? <div className="font-display text-[12px] font-semibold mb-0.5">{title}</div> : null}
        <div className="text-xs text-text/80 leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

export function KeyValue({ k, v, mono = true }: { k: string; v?: ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line/50 py-1.5 last:border-0">
      <span className="shrink-0 font-mono text-[11px] uppercase tracking-wider text-muted">{k}</span>
      <span className={cn('min-w-0 text-right text-xs font-medium text-text', mono && 'font-mono')}>{v ?? '—'}</span>
    </div>
  );
}
