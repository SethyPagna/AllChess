type WatchLinkOptions = {
  q?: string;
  sort?: string;
  status?: string;
};

export function watchHref(locale: string, values: WatchLinkOptions = {}) {
  const query = new URLSearchParams();
  if (values.q) query.set("q", values.q);
  if (values.status && values.status !== "all") query.set("status", values.status);
  if (values.sort && values.sort !== "recent") query.set("sort", values.sort);
  const suffix = query.toString();

  return suffix ? `/${locale}/watch?${suffix}` : `/${locale}/watch`;
}
