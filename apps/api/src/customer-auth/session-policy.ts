// Limits of the SMS code when it is confirmed and of the session that follows
// (docs/BUSINESS_RULES.md, RN-AUT-02 and RN-AUT-06).

/** A code accepts 5 wrong attempts; on the fifth it dies and the number is locked (RN-AUT-02). */
export const OTP_MAX_ATTEMPTS = 5;
/** The number stays locked for 15 minutes (RN-AUT-02). */
export const OTP_LOCK_SECONDS = 15 * 60;
/** The session of the customer lasts 90 days, renewed on every use (RN-AUT-06, [Premissa]). */
export const REFRESH_TTL_SECONDS = 90 * 24 * 60 * 60;
/** The user agent is only for the list of sessions; a very long one is cut. */
export const USER_AGENT_MAX_LENGTH = 255;
