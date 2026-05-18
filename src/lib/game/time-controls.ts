export type TimeControlKey = "bullet" | "blitz" | "rapid" | "classical" | "correspondence" | "freestyle";

export type TimeControl = {
  key: TimeControlKey;
  label: string;
  baseSeconds: number;
  incrementSeconds: number;
  description: string;
};

export const timeControls: TimeControl[] = [
  { key: "bullet", label: "Bullet 1+0", baseSeconds: 60, incrementSeconds: 0, description: "Fast tactical games." },
  { key: "blitz", label: "Blitz 5+0", baseSeconds: 300, incrementSeconds: 0, description: "Short competitive games." },
  { key: "rapid", label: "Rapid 10+0", baseSeconds: 600, incrementSeconds: 0, description: "Balanced play and review without clock growth." },
  { key: "classical", label: "Classical 30+20", baseSeconds: 1800, incrementSeconds: 20, description: "Deep calculation." },
  { key: "correspondence", label: "Daily", baseSeconds: 86400, incrementSeconds: 0, description: "Long-form async games." },
  { key: "freestyle", label: "Freestyle", baseSeconds: 0, incrementSeconds: 0, description: "Untimed analysis-friendly play." }
];

export function getTimeControl(key: string | undefined) {
  return timeControls.find((control) => control.key === key) ?? timeControls[2];
}
