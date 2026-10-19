import React, { useState, useRef, useEffect } from 'react';
import { HelpCircle, X } from 'lucide-react';

interface InfoPopoverProps {
  title: string;
  description: string;
  example?: string;
}

export const InfoPopover: React.FC<InfoPopoverProps> = ({ title, description, example }) => {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Keyboard navigation & click outside
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    };

    const handleClickOutside = (event: MouseEvent) => {
      if (
        isOpen &&
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="relative inline-block text-left">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="p-1 text-slate-400 hover:text-slate-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-600 transition-colors"
        aria-label={`Learn more about ${title}`}
        aria-expanded={isOpen}
      >
        <HelpCircle className="w-4 h-4" />
      </button>

      {isOpen && (
        <div
          ref={popoverRef}
          role="dialog"
          aria-modal="false"
          aria-label={title}
          className="absolute z-50 left-1/2 -translate-x-1/2 bottom-full mb-2 w-72 p-3.5 bg-white border border-slate-200 rounded-xl shadow-sm text-xs text-slate-700 animate-in fade-in zoom-in-95 duration-100"
        >
          <div className="flex items-center justify-between font-semibold text-slate-900 pb-1.5 border-b border-slate-100 mb-2">
            <span>{title}</span>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                buttonRef.current?.focus();
              }}
              className="text-slate-400 hover:text-slate-600 rounded p-0.5 focus:outline-none focus:ring-1 focus:ring-blue-600"
              aria-label="Close popover"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="leading-relaxed text-slate-600">{description}</p>
          {example && (
            <div className="mt-2 pt-2 border-t border-slate-100 text-slate-500 font-mono text-[11px] bg-slate-50 p-1.5 rounded">
              <span className="font-semibold text-slate-700 not-mono font-sans">Example: </span>
              {example}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
