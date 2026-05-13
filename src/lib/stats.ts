export type SiteStat = {
  label: string;
  value: string;
  isEstimated: boolean;
};

export function createDefaultStats() {
  return {
    playersOnline: {
      label: "Players online",
      value: "Live soon",
      isEstimated: false
    },
    variants: {
      label: "Variants",
      value: "11",
      isEstimated: false
    },
    review: {
      label: "Review",
      value: "D1-ready",
      isEstimated: false
    },
    bots: {
      label: "Bots",
      value: "6 levels",
      isEstimated: false
    }
  } satisfies Record<string, SiteStat>;
}
