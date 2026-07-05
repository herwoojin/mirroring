'use client';

// BigButton (TRD 7.1) — 높이 88px+, 아이콘 40px + 라벨 24px+, 눌림 피드백(스케일 0.97 + 진동)
import { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'danger';

interface BigButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: ReactNode;
  label: string;
  sub?: string;
  variant?: Variant;
  tall?: boolean; // 첫 화면 초대형(화면 높이 ~35%)
}

const styles: Record<Variant, string> = {
  // accent #22D3EE + ink #06222A — 대비 8:1 ✅
  primary: 'bg-accent text-accent-ink',
  secondary: 'bg-transparent text-primary border-4 border-line',
  danger: 'bg-error text-[#2A0808]',
};

export default function BigButton({
  icon,
  label,
  sub,
  variant = 'primary',
  tall = false,
  className = '',
  onClick,
  ...rest
}: BigButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={(e) => {
        try {
          navigator.vibrate?.(10);
        } catch {}
        onClick?.(e);
      }}
      className={`pressable w-full rounded-big px-6 flex flex-col items-center justify-center gap-2 select-none ${
        tall ? 'min-h-[35vh]' : 'min-h-[88px]'
      } ${styles[variant]} ${className}`}
      {...rest}
    >
      {icon && (
        <span aria-hidden="true" className={tall ? 'text-6xl' : 'text-4xl'}>
          {icon}
        </span>
      )}
      <span className="text-button">{label}</span>
      {sub && <span className="text-caption opacity-80">{sub}</span>}
    </button>
  );
}
