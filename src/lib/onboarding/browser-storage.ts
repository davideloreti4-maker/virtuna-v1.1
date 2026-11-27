/** The browser's storage, or null where it cannot be reached (the server, a blocked or private window). */
export function browserStorage(kind: "local" | "session"): Storage | null {
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}
