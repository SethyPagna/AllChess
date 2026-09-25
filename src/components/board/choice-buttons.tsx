"use client";

import { useEffect, useRef } from "react";
import { Check, ChevronDown } from "lucide-react";

type Option<T extends string> = { key: T; label: string; detail?: string };

export function ChoiceButtons<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: Option<T>[]; onChange: (value: T) => void }) {
  return <div className="choice-field"><span className="choice-label">{label}</span><div className="choice-buttons" role="group" aria-label={label}>{options.map(option => <button type="button" className="focus-ring" key={option.key} aria-pressed={value === option.key} onClick={() => onChange(option.key)}><span>{option.label}</span>{option.detail ? <small>{option.detail}</small> : null}</button>)}</div></div>;
}

/** Native disclosure + real buttons: touch targets, visible selection, Escape and outside dismissal. */
export function ChoicePicker<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: Option<T>[]; onChange: (value: T) => void }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const selected = options.find(option => option.key === value);
  useEffect(() => {
    function key(event: KeyboardEvent) {
      if (event.key === "Escape" && ref.current?.open) { ref.current.open = false; ref.current.querySelector("summary")?.focus(); }
    }
    function outside(event: PointerEvent) {
      if (event.target instanceof Node && ref.current?.open && !ref.current.contains(event.target)) ref.current.open = false;
    }
    document.addEventListener("keydown", key); document.addEventListener("pointerdown", outside);
    return () => { document.removeEventListener("keydown", key); document.removeEventListener("pointerdown", outside); };
  }, []);
  return <details ref={ref} className="choice-picker"><summary className="focus-ring" aria-label={label}><span><small>{label}</small><strong>{selected?.label ?? "Choose"}</strong></span><ChevronDown size={16} /></summary><div className="choice-picker-options" role="group" aria-label={`${label} options`}>{options.map(option => <button key={option.key} type="button" className="focus-ring" aria-pressed={value === option.key} onClick={() => { onChange(option.key); if (ref.current) { ref.current.open = false; ref.current.querySelector("summary")?.focus(); } }}><span>{option.label}{option.detail ? <small>{option.detail}</small> : null}</span>{value === option.key ? <Check size={15} /> : null}</button>)}</div></details>;
}
