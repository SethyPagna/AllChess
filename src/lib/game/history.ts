export type TimelineState<T> = {
  past: T[];
  present: T;
  future: T[];
};

export function pushTimeline<T>(past: T[], present: T, nextPresent: T): TimelineState<T> {
  return {
    past: [...past, present],
    present: nextPresent,
    future: []
  };
}

export function undoTimeline<T>(past: T[], present: T, future: T[]): TimelineState<T> | null {
  const previous = past.at(-1);
  if (!previous) return null;

  return {
    past: past.slice(0, -1),
    present: previous,
    future: [present, ...future]
  };
}

export function redoTimeline<T>(past: T[], present: T, future: T[]): TimelineState<T> | null {
  const next = future[0];
  if (!next) return null;

  return {
    past: [...past, present],
    present: next,
    future: future.slice(1)
  };
}
