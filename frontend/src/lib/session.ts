export type SessionState = {
  email: string
  accessToken: string
  expiresAt: string
}

export const SESSION_STORAGE_KEY = 'tally.session.v2'

export function loadSession(): SessionState | null {
  if (typeof window === 'undefined') {
    return null
  }

  const raw = window.localStorage.getItem(SESSION_STORAGE_KEY)
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as SessionState
    if (!parsed.expiresAt || new Date(parsed.expiresAt).getTime() <= Date.now()) {
      window.localStorage.removeItem(SESSION_STORAGE_KEY)
      return null
    }
    return parsed
  } catch {
    window.localStorage.removeItem(SESSION_STORAGE_KEY)
    return null
  }
}

export function persistSession(session: SessionState | null): void {
  if (typeof window === 'undefined') {
    return
  }

  if (session) {
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session))
    return
  }

  window.localStorage.removeItem(SESSION_STORAGE_KEY)
}
