import type { ReactNode } from 'react';

export interface AlertProps {
  variant?: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  children: ReactNode;
  className?: string;
}

const variantClasses = {
  info: 'bg-indigo-50 border-indigo-200 text-indigo-800',
  success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  warning: 'bg-amber-50 border-amber-200 text-amber-800',
  error: 'bg-red-50 border-red-200 text-red-800',
};

export function Alert({ variant = 'info', title, children, className = '' }: AlertProps) {
  return (
    <div className={`rounded-lg border p-4 ${variantClasses[variant]} ${className}`}>
      {title && <h4 className="mb-1 font-medium">{title}</h4>}
      <div className="text-sm">{children}</div>
    </div>
  );
}
