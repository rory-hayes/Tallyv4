export type RunHistoryRecord = {
  runId: string
  clientId: string
  clientName: string
  firmName: string
  countryPack: 'UK' | 'IE'
  currency: 'GBP' | 'EUR'
  payDate: string
  payPeriodStart: string
  payPeriodEnd: string
  status: 'Tied' | 'NotTied' | 'NeedsReview'
  createdAt: string
  updatedAt: string
  hasExportPack: boolean
}

const RUN_HISTORY_STORAGE_KEY = 'tally.run-history.v1'
const MAX_RUNS = 100

function save(records: RunHistoryRecord[]): void {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.setItem(RUN_HISTORY_STORAGE_KEY, JSON.stringify(records.slice(0, MAX_RUNS)))
}

export function loadRunHistory(): RunHistoryRecord[] {
  if (typeof window === 'undefined') {
    return []
  }

  const raw = window.localStorage.getItem(RUN_HISTORY_STORAGE_KEY)
  if (!raw) {
    return []
  }

  try {
    const parsed = JSON.parse(raw) as RunHistoryRecord[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function upsertRunHistory(record: RunHistoryRecord): void {
  const existing = loadRunHistory()
  const rest = existing.filter((item) => item.runId !== record.runId)
  const next = [record, ...rest].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  save(next)
}

export function patchRunHistory(runId: string, patch: Partial<RunHistoryRecord>): void {
  const existing = loadRunHistory()
  const next = existing.map((item) => (item.runId === runId ? { ...item, ...patch } : item))
  save(next)
}
