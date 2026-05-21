type AnalysisPlyLinkOptions = {
  autoplay?: boolean;
};

export function analysisPlyHref(locale: string, gameId: string, ply: number, options: AnalysisPlyLinkOptions = {}) {
  const autoplayParam = options.autoplay ? "&autoplay=1" : "";

  return `/${locale}/analysis/${encodeURIComponent(gameId)}?ply=${ply}${autoplayParam}`;
}
