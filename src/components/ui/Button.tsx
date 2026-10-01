import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'default' | 'operator' | 'primary' | 'clear';
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  children: ReactNode;
}
export const Button = ({ variant = 'default', children, className = '', ...props }: ButtonProps) => (
  <button type="button" className={`calc-key calc-key--${variant} ${className}`} {...props}><span>{children}</span></button>
);
