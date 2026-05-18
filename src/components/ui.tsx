import type { ReactNode, HTMLAttributes } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { classNames } from '../utils/format';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  padded?: boolean;
}
export function Card({ children, padded = true, className, ...rest }: CardProps) {
  return (
    <div
      className={classNames(
        'bg-white dark:bg-night-surface border-hair hairline rounded-2xl transition-shadow duration-200',
        padded && 'p-6',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}
export function SectionHeader({ title, subtitle, action }: SectionHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-4">
      <div>
        <h2 className="text-[15px] font-medium tracking-tightish text-ink dark:text-night-ink">
          {title}
        </h2>
        {subtitle && (
          <p className="text-xs text-ink-muted dark:text-night-muted mt-0.5">
            {subtitle}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

interface KPICardProps {
  label: string;
  value: string;
  delta?: number;
  deltaLabel?: string;
  to?: string;
  icon?: ReactNode;
  intent?: 'default' | 'success' | 'warn' | 'danger';
}
export function KPICard({
  label,
  value,
  delta,
  deltaLabel,
  to,
  icon,
  intent = 'default',
}: KPICardProps) {
  const intentColor = {
    default: 'text-ink dark:text-night-ink',
    success: 'text-brand-green',
    warn: 'text-brand-orange',
    danger: 'text-brand-red',
  }[intent];

  const inner = (
    <>
      <div className="flex items-center justify-between">
        <span className="text-2xs uppercase tracking-wider text-ink-muted dark:text-night-muted">
          {label}
        </span>
        {icon && <span className="text-ink-muted dark:text-night-muted">{icon}</span>}
      </div>
      <div className="mt-3 flex items-baseline justify-between">
        <span
          className={classNames(
            'text-[28px] leading-none font-medium tracking-tighter2 tabular',
            intentColor,
          )}
        >
          {value}
        </span>
        {to && (
          <ArrowRight
            size={14}
            className="text-ink-muted dark:text-night-muted opacity-0 group-hover:opacity-100 transition-opacity"
          />
        )}
      </div>
      {(delta !== undefined || deltaLabel) && (
        <div className="mt-2 flex items-center gap-1.5 text-xs">
          {delta !== undefined && (
            <span
              className={classNames(
                'tabular',
                delta > 0 ? 'text-brand-green' : delta < 0 ? 'text-brand-red' : 'text-ink-muted',
              )}
            >
              {delta > 0 ? '+' : ''}
              {delta.toFixed(1)}%
            </span>
          )}
          {deltaLabel && (
            <span className="text-ink-muted dark:text-night-muted">{deltaLabel}</span>
          )}
        </div>
      )}
    </>
  );

  if (to) {
    return (
      <Link to={to} className="group block">
        <Card className="hover:border-silverlit-red/30 hover:shadow-[0_8px_24px_rgba(227,6,19,0.06)] hover:-translate-y-0.5 transition-all duration-200 cursor-pointer h-full">
          {inner}
        </Card>
      </Link>
    );
  }
  return <Card>{inner}</Card>;
}

interface BadgeProps {
  children: ReactNode;
  tone?: 'neutral' | 'success' | 'warn' | 'danger' | 'info';
  size?: 'sm' | 'md';
}
export function Badge({ children, tone = 'neutral', size = 'sm' }: BadgeProps) {
  const tones = {
    neutral: 'bg-surface-alt text-ink-subtle dark:bg-night-alt dark:text-night-muted',
    success: 'bg-brand-green/10 text-brand-green',
    warn: 'bg-brand-orange/10 text-brand-orange',
    danger: 'bg-brand-red/10 text-brand-red',
    info: 'bg-silverlit-red-soft text-silverlit-red dark:bg-night-alt dark:text-night-ink',
  }[tone];
  return (
    <span
      className={classNames(
        'inline-flex items-center rounded-full font-medium',
        size === 'sm' ? 'text-2xs px-2 py-0.5' : 'text-xs px-2.5 py-1',
        tones,
      )}
    >
      {children}
    </span>
  );
}

interface EmptyProps {
  title: string;
  hint?: string;
  icon?: ReactNode;
}
export function Empty({ title, hint, icon }: EmptyProps) {
  return (
    <div className="text-center py-12">
      {icon && <div className="text-ink-muted mb-3 flex justify-center">{icon}</div>}
      <p className="text-sm text-ink dark:text-night-ink">{title}</p>
      {hint && <p className="text-xs text-ink-muted mt-1">{hint}</p>}
    </div>
  );
}

export function ProgressBar({ value, intent = 'default' }: { value: number; intent?: 'default' | 'warn' | 'danger' }) {
  const color = {
    default: 'bg-ink dark:bg-night-ink',
    warn: 'bg-brand-orange',
    danger: 'bg-brand-red',
  }[intent];
  return (
    <div className="w-full h-1 rounded-full bg-surface-alt dark:bg-night-alt overflow-hidden">
      <div className={classNames('h-full transition-all', color)} style={{ width: `${Math.min(100, value)}%` }} />
    </div>
  );
}

interface SegmentedProps<T extends string> {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
}
export function Segmented<T extends string>({ options, value, onChange }: SegmentedProps<T>) {
  return (
    <div className="inline-flex bg-surface-alt dark:bg-night-alt rounded-lg p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={classNames(
            'text-2xs px-2.5 py-1 rounded-md transition-colors',
            value === o.value
              ? 'bg-white dark:bg-night-surface text-ink dark:text-night-ink shadow-[0_0.5px_0_rgba(0,0,0,0.06)]'
              : 'text-ink-muted dark:text-night-muted hover:text-ink dark:hover:text-night-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
