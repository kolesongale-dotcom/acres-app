/** Shared auth constants (used by middleware + the login server action). */
export const COOKIE_NAME = "acres_session";

/** True when a back-office password is configured (i.e. the login gate is on). */
export function authEnabled(): boolean {
  return !!process.env.APP_PASSWORD;
}
