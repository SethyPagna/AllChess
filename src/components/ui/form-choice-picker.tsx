"use client";

import { useState } from "react";
import { ChoicePicker } from "@/components/board/choice-buttons";

/** Keep the selected button value in ordinary GET form submissions. */
export function FormChoicePicker({ name, label, defaultValue, options }: { name: string; label: string; defaultValue: string; options: { key: string; label: string }[] }) {
  const [value, setValue] = useState(defaultValue);
  return <div className="form-choice-picker"><input type="hidden" name={name} value={value} /><ChoicePicker label={label} value={value} onChange={setValue} options={options} /></div>;
}
