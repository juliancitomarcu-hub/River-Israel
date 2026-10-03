/** Pure policy; intentionally does not import the app or credentials. */
export type DeliveryMode = "disabled" | "make" | "direct";
export function isolatedReview(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.ISOLATED_REVIEW === "true";
}
export function automationAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
  return !isolatedReview(env) && env.AUTOMATION_ENABLED !== "false";
}
export function assertServerAllowed(env: NodeJS.ProcessEnv = process.env): void {
  if (isolatedReview(env)) throw new Error("ISOLATED_REVIEW=true: server and manual endpoints are disabled");
}
export function instagramDeliveryMode(env: NodeJS.ProcessEnv = process.env): DeliveryMode {
  const raw = env.INSTAGRAM_DELIVERY_MODE ?? (isolatedReview(env) ? "disabled" : "make");
  if (raw !== "disabled" && raw !== "make" && raw !== "direct") {
    throw new Error("INSTAGRAM_DELIVERY_MODE must be disabled, make or direct");
  }
  return isolatedReview(env) ? "disabled" : raw;
}
export function makeAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
  return automationAllowed(env) && instagramDeliveryMode(env) === "make";
}
export function directAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
  return automationAllowed(env) && instagramDeliveryMode(env) === "direct";
}