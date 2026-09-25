"use client";

import { useState } from "react";
import { PieceIcon } from "./piece-icon";
import { janggiFormationKeys, janggiFormations, type JanggiFormation, type JanggiSide } from "@/lib/variants/janggi-formations";

export function JanggiFormationPicker({ side, value, disabled = false, onChange, onConfirm }: {
  side: JanggiSide; value: JanggiFormation; disabled?: boolean;
  onChange: (value: JanggiFormation) => void; onConfirm?: () => void;
}) {
  const name = side === "red" ? "Red Han" : "Blue Cho";
  return <section className="janggi-formation-picker" aria-label={`${name} formation`}>
    <div className="formation-heading"><strong>{name}</strong><span>From your seat</span></div>
    <div className="formation-options" role="group" aria-label={`${name} opening choices`}>
      {janggiFormationKeys.map(key => <button type="button" key={key} className="focus-ring" disabled={disabled} aria-pressed={value === key} onClick={() => onChange(key)}>
        <span className="formation-pieces" aria-hidden="true">{janggiFormations[key].pieces.map((code, index) => <span key={index} className={index === 2 ? "formation-right-wing" : undefined}><PieceIcon variantKey="janggi" code={code} owner={side} /></span>)}</span>
        <span>{janggiFormations[key].label}</span>
      </button>)}
    </div>
    {onConfirm ? <button type="button" className="focus-ring action-primary formation-confirm" disabled={disabled} onClick={onConfirm}>Confirm formation</button> : null}
  </section>;
}

export function JanggiLocalSetup({ values, onChange }: { values: Record<JanggiSide, JanggiFormation>; onChange: (side: JanggiSide, value: JanggiFormation) => void }) {
  const [side, setSide] = useState<JanggiSide>("red");
  return <div className="janggi-local-setup">
    <div className="formation-heading"><strong>Opening formation</strong><div role="group" aria-label="Formation side">{(["red", "blue"] as const).map(color => <button type="button" key={color} className="focus-ring" aria-pressed={side === color} onClick={() => setSide(color)}>{color === "red" ? "Han" : "Cho"}</button>)}</div></div>
    <JanggiFormationPicker side={side} value={values[side]} onChange={value => onChange(side, value)} />
  </div>;
}

export function JanggiRoomSetup({ side, canChoose, disabled, onConfirm }: { side: JanggiSide; canChoose: boolean; disabled: boolean; onConfirm: (value: JanggiFormation) => void }) {
  const [value, setValue] = useState<JanggiFormation>("inner");
  if (!canChoose) return <div className="janggi-formation-wait" role="status">{side === "red" ? "Han is choosing a formation first." : "Cho is choosing a formation. Blue moves first."} Clocks are stopped.</div>;
  return <JanggiFormationPicker side={side} value={value} onChange={setValue} disabled={disabled} onConfirm={() => onConfirm(value)} />;
}
