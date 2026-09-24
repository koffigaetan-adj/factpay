'use client';

import { useFormStatus } from 'react-dom';

export default function SubmitButton({ children, pendingText, className = '', ...props }) {
  const { pending } = useFormStatus();
  
  return (
    <button
      {...props}
      disabled={pending || props.disabled}
      className={`${className} ${pending ? 'is-loading' : ''}`.trim()}
    >
      {pending && (
        <svg className="spinner" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeLinecap="round" />
        </svg>
      )}
      <span>{pending && pendingText ? pendingText : children}</span>
    </button>
  );
}
