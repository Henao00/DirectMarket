/**
 * DirectMarket - Componentes UI Reutilizables
 *
 * Biblioteca de componentes atomicos del sistema de diseno.
 * Todos cumplen accesibilidad: area minima 44x44px, contraste adecuado,
 * labels asociados a inputs (checklist mockup items 4, 5, 6).
 */

import { forwardRef } from 'react';
import { AlertCircle, CheckCircle, AlertTriangle, Info, Lock, Star, X, Loader2 } from 'lucide-react';
import clsx from 'clsx';

// ---------------------------------------------------------------------------
// BUTTON
// ---------------------------------------------------------------------------

export const Button = forwardRef(function Button(
  { children, variant = 'primary', size = 'md', loading = false, className = '', ...props },
  ref
) {
  const base = 'btn';
  const variants = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    danger: 'btn-danger',
    ghost: 'btn-ghost'
  };
  const sizes = {
    sm: 'btn-sm',
    md: '',
    lg: 'btn-lg'
  };

  return (
    <button
      ref={ref}
      className={clsx(base, variants[variant], sizes[size], className)}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
});

// ---------------------------------------------------------------------------
// INPUT
// ---------------------------------------------------------------------------

export const Input = forwardRef(function Input(
  { label, error, hint, id, required, className = '', ...props },
  ref
) {
  const inputId = id || `input-${Math.random().toString(36).slice(2)}`;

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="form-label">
          {label}
          {required && <span className="text-danger-500 ml-0.5">*</span>}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        aria-invalid={!!error}
        aria-describedby={error ? `${inputId}-error` : undefined}
        className={clsx(error ? 'form-input-error' : 'form-input', className)}
        {...props}
      />
      {error && (
        <p id={`${inputId}-error`} className="form-error" role="alert">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          {error}
        </p>
      )}
      {hint && !error && <p className="form-hint">{hint}</p>}
    </div>
  );
});

// ---------------------------------------------------------------------------
// TEXTAREA
// ---------------------------------------------------------------------------

export const Textarea = forwardRef(function Textarea(
  { label, error, hint, id, required, className = '', ...props },
  ref
) {
  const inputId = id || `textarea-${Math.random().toString(36).slice(2)}`;

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="form-label">
          {label}
          {required && <span className="text-danger-500 ml-0.5">*</span>}
        </label>
      )}
      <textarea
        ref={ref}
        id={inputId}
        aria-invalid={!!error}
        className={clsx(
          'form-input resize-none',
          error && 'border-danger-500 focus:ring-danger-500',
          className
        )}
        {...props}
      />
      {error && (
        <p className="form-error" role="alert">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          {error}
        </p>
      )}
      {hint && !error && <p className="form-hint">{hint}</p>}
    </div>
  );
});

// ---------------------------------------------------------------------------
// SELECT
// ---------------------------------------------------------------------------

export const Select = forwardRef(function Select(
  { label, error, hint, id, required, options = [], placeholder, className = '', ...props },
  ref
) {
  const inputId = id || `select-${Math.random().toString(36).slice(2)}`;

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="form-label">
          {label}
          {required && <span className="text-danger-500 ml-0.5">*</span>}
        </label>
      )}
      <select
        ref={ref}
        id={inputId}
        className={clsx('form-input', error && 'border-danger-500', className)}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && (
        <p className="form-error" role="alert">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
});

// ---------------------------------------------------------------------------
// BADGE
// ---------------------------------------------------------------------------

const BADGE_VARIANTS = {
  success: 'badge-success',
  warning: 'badge-warning',
  danger: 'badge-danger',
  neutral: 'badge-neutral',
  brand: 'badge-brand'
};

export const Badge = ({ children, variant = 'neutral', className = '' }) => (
  <span className={clsx(BADGE_VARIANTS[variant], className)}>{children}</span>
);

// Mapeo de estado de transaccion a badge
export const TransactionStatusBadge = ({ status }) => {
  const config = {
    pending_payment: { label: 'Pago pendiente', variant: 'warning' },
    escrow_held:     { label: 'En escrow', variant: 'brand' },
    code_validated:  { label: 'Codigo validado', variant: 'success' },
    completed:       { label: 'Completada', variant: 'success' },
    disputed:        { label: 'En disputa', variant: 'danger' },
    refunded:        { label: 'Reembolsada', variant: 'neutral' },
    cancelled:       { label: 'Cancelada', variant: 'neutral' }
  };
  const { label, variant } = config[status] || { label: status, variant: 'neutral' };
  return <Badge variant={variant}>{label}</Badge>;
};

// ---------------------------------------------------------------------------
// ALERT / NOTIFICATION BANNER
// ---------------------------------------------------------------------------

const ALERT_ICONS = {
  success: <CheckCircle className="w-5 h-5 text-success-600 flex-shrink-0" />,
  warning: <AlertTriangle className="w-5 h-5 text-warning-600 flex-shrink-0" />,
  danger:  <AlertCircle className="w-5 h-5 text-danger-600 flex-shrink-0" />,
  info:    <Info className="w-5 h-5 text-brand-600 flex-shrink-0" />
};

const ALERT_STYLES = {
  success: 'bg-success-50 border-success-200 text-success-700',
  warning: 'bg-warning-50 border-warning-200 text-warning-700',
  danger:  'bg-danger-50 border-danger-200 text-danger-700',
  info:    'bg-brand-50 border-brand-200 text-brand-700'
};

export const Alert = ({ type = 'info', children, onClose, className = '' }) => (
  <div
    role="alert"
    className={clsx(
      'flex items-start gap-3 px-4 py-3 rounded-lg border text-sm',
      ALERT_STYLES[type],
      className
    )}
  >
    {ALERT_ICONS[type]}
    <div className="flex-1">{children}</div>
    {onClose && (
      <button
        onClick={onClose}
        className="text-current opacity-60 hover:opacity-100 transition-opacity"
        aria-label="Cerrar"
      >
        <X className="w-4 h-4" />
      </button>
    )}
  </div>
);

// ---------------------------------------------------------------------------
// MODAL
// ---------------------------------------------------------------------------

export const Modal = ({ isOpen, onClose, title, children, size = 'md' }) => {
  if (!isOpen) return null;

  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl'
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Panel */}
      <div
        className={clsx(
          'relative w-full bg-white rounded-2xl shadow-modal animate-fade-in',
          sizes[size]
        )}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
          <h2 id="modal-title" className="text-lg font-semibold text-neutral-900">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// STAR RATING
// CP-010: rango 1-5 estrellas
// ---------------------------------------------------------------------------

export const StarRating = ({ value, onChange, readonly = false, size = 'md' }) => {
  const starSizes = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-8 h-8' };
  const sz = starSizes[size] || starSizes.md;

  return (
    <div className="flex items-center gap-1" role={readonly ? 'img' : 'group'} aria-label={`Calificacion: ${value} de 5 estrellas`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          onClick={() => onChange && onChange(star)}
          className={clsx(
            'transition-transform',
            !readonly && 'hover:scale-110 cursor-pointer',
            readonly && 'cursor-default'
          )}
          aria-label={`${star} estrella${star > 1 ? 's' : ''}`}
        >
          <Star
            className={clsx(
              sz,
              star <= value ? 'fill-warning-500 text-warning-500' : 'text-neutral-300'
            )}
          />
        </button>
      ))}
    </div>
  );
};

// ---------------------------------------------------------------------------
// SECURE BADGE (Indicador HTTPS - checklist item 11)
// ---------------------------------------------------------------------------

export const SecureBadge = () => (
  <div className="secure-badge">
    <Lock className="w-3.5 h-3.5" />
    Pago seguro HTTPS
  </div>
);

// ---------------------------------------------------------------------------
// SPINNER / LOADING
// ---------------------------------------------------------------------------

export const Spinner = ({ size = 'md', className = '' }) => {
  const sizes = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-8 h-8' };
  return (
    <Loader2
      className={clsx('animate-spin text-brand-600', sizes[size] || sizes.md, className)}
    />
  );
};

export const PageLoader = () => (
  <div className="flex items-center justify-center min-h-64">
    <Spinner size="lg" />
  </div>
);

// ---------------------------------------------------------------------------
// EMPTY STATE
// ---------------------------------------------------------------------------

export const EmptyState = ({ icon: Icon, title, description, action }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    {Icon && (
      <div className="w-16 h-16 bg-neutral-100 rounded-2xl flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-neutral-400" />
      </div>
    )}
    <h3 className="text-base font-semibold text-neutral-700 mb-1">{title}</h3>
    {description && <p className="text-sm text-neutral-500 max-w-xs mb-6">{description}</p>}
    {action}
  </div>
);

// ---------------------------------------------------------------------------
// COUNTDOWN TIMER - Para la expiracion del codigo escrow (RNF-02)
// ---------------------------------------------------------------------------

import { useState, useEffect } from 'react';

export const CountdownTimer = ({ expiresAt, onExpired }) => {
  const [remaining, setRemaining] = useState('');
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const expiry = new Date(expiresAt);
      const diff = expiry - now;

      if (diff <= 0) {
        setIsExpired(true);
        setRemaining('00:00:00');
        onExpired?.();
        return;
      }

      const hours   = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);

      setRemaining(
        `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
      );
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, onExpired]);

  return (
    <div className={clsx(
      'text-center font-mono text-sm font-medium',
      isExpired ? 'text-danger-600' : remaining.startsWith('00:0') ? 'text-warning-600' : 'text-neutral-600'
    )}>
      {isExpired ? 'EXPIRADO' : `Expira en: ${remaining}`}
    </div>
  );
};
