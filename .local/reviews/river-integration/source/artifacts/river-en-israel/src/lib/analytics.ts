type AnalyticsData = Record<string, string | number | boolean>;

declare global {
  interface Window {
    umami?: { track(name: string, data?: AnalyticsData): void | Promise<unknown> };
  }
}

export function trackEvent(name: string, data?: AnalyticsData): void {
  if (typeof window === "undefined") return;
  try {
    const result = window.umami?.track(name, data);
    if (result && typeof result.catch === "function") result.catch(() => {});
  } catch {
    // Analytics must never interrupt navigation or form submission.
  }
}