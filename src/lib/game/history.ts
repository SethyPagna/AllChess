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

export function undoTimelineUntil<T>(past: T[], present: T, future: T[], shouldStop: (present: T) => boolean): TimelineState<T> | null {
  return stepTimelineUntil(undoTimeline(past, present, future), undoTimeline, shouldStop);
}

export function redoTimelineUntil<T>(past: T[], present: T, future: T[], shouldStop: (present: T) => boolean): TimelineState<T> | null {
  return stepTimelineUntil(redoTimeline(past, present, future), redoTimeline, shouldStop);
}

function stepTimelineUntil<T>(
  firstStep: TimelineState<T> | null,
  step: (past: T[], present: T, future: T[]) => TimelineState<T> | null,
  shouldStop: (present: T) => boolean
) {
  if (!firstStep) return null;
  let next = firstStep;
  while (!shouldStop(next.present)) {
    const stepped = step(next.past, next.present, next.future);
    if (!stepped) break;
    next = stepped;
  }
  return next;
}
