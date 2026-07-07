import React, { useState, useRef, useEffect } from "react";
import { Check, ChevronDown } from "lucide-react";

interface CustomSelectOption {
  value: string;
  label: string | React.ReactNode;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: CustomSelectOption[];
  className?: string;
  disabled?: boolean;
  align?: "left" | "right";
}

export default function CustomSelect({
  value,
  onChange,
  options,
  className = "",
  disabled = false,
  align = "right",
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value) || options[0];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (val: string) => {
    if (disabled) return;
    onChange(val);
    setIsOpen(false);
  };

  const alignmentClass = align === "left" ? "left-0 origin-top-left" : "right-0 origin-top-right";

  return (
    <div
      ref={containerRef}
      className={`relative inline-block w-full text-left ${className}`}
      id={`custom-select-${value}`}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between gap-2 rounded-2xl border border-slate-150 bg-slate-50 hover:bg-slate-100 focus:bg-white px-4 py-3 text-sm font-bold text-slate-800 shadow-3xs outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all cursor-pointer disabled:opacity-50"
      >
        <span className="truncate flex items-center gap-2">{selectedOption?.label}</span>
        <ChevronDown
          className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className={`absolute ${alignmentClass} mt-2 z-50 w-full min-w-[200px] rounded-2xl border border-slate-100 bg-white p-1.5 shadow-lg ring-1 ring-black/5 animate-fade-in focus:outline-none`}>
          <div className="max-h-60 overflow-y-auto rounded-xl scrollbar-none">
            {options.map((option) => {
              const isSelected = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option.value)}
                  className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-bold transition-all text-left cursor-pointer ${
                    isSelected
                      ? "bg-indigo-50 text-indigo-700"
                      : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <span className="truncate flex items-center gap-2">{option.label}</span>
                  {isSelected && <Check className="h-4 w-4 text-indigo-600 flex-shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
