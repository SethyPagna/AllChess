"use client";

import { useId, useRef } from "react";
import { Check, ChevronDown } from "lucide-react";

import { closeDetails, useDismissableDetails } from "@/components/ui/use-dismissable-details";

type Option<T extends string> = { key: T; label: string; detail?: string };

/** Native disclosure + real buttons: touch targets, visible selection, Escape and outside dismissal. */
export function ChoicePicker<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: Option<T>[]; onChange: (value: T) => void }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const valueId = useId();
  const selected = options.find(option => option.key === value);
  useDismissableDetails(ref);
  return <details ref={ref} className="choice-picker"><summary className="focus-ring" aria-label={label} aria-describedby={valueId}><span><small>{label}</small><strong id={valueId}>{selected?.label ?? "Choose"}</strong></span><ChevronDown size={16} /></summary><div className="choice-picker-options" role="group" aria-label={`${label} options`}>{options.map(option => <button key={option.key} type="button" className="focus-ring" aria-pressed={value === option.key} onClick={() => { onChange(option.key); closeDetails(ref, { restoreFocus: true }); }}><span>{option.label}{option.detail ? <small>{option.detail}</small> : null}</span>{value === option.key ? <Check size={15} /> : null}</button>)}</div></details>;
}
