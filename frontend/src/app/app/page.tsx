'use client'

import { ArrowRightIcon, ArrowTrendingDownIcon, ArrowTrendingUpIcon, MinusIcon } from '@heroicons/react/20/solid'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

import { NewRunWizardModal } from '@/components/app/new-run-wizard-modal'
import { type RunResponse, type RunSummaryResponse, getRun, getRunSummary } from '@/lib/api'
import { formatDate, formatEUR, formatGBP } from '@/lib/format'
import { loadRunHistory, upsertRunHistory, type RunHistoryRecord } from '@/lib/run-history'
import { loadSession, type SessionState } from '@/lib/session'
import { Badge, Button, Heading, Select, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Text } from '@/components/ui'

type DateRange = '7d' | '30d'

type DashboardRunRow = {
  history: RunHistoryRecord
  run: RunResponse
  summary: RunSummaryResponse
}

type MetricTone = 'green' | 'red' | 'zinc'

function greetingLabel(email: string): string {
  const hour = new Date().getHours()
  const part = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'
  const local = email.split('@')[0] ?? 'there'
  const name = local
    .split(/[._-]/)
    .filter(Boolean)
    .map((chunk) => chunk[0].toUpperCase() + chunk.slice(1))
    .join(' ')
  return `Good ${part}, ${name || 'there'}`
}

function toCurrency(value: number, currency: 'GBP' | 'EUR'): string {
  return currency === 'EUR' ? formatEUR(value) : formatGBP(value)
}

function toPercentage(value: number): string {
  return `${value.toFixed(1)}%`
}

function parseUtc(dateValue: string): Date {
  return new Date(dateValue)
}

function inRange(value: Date, start: Date, end: Date): boolean {
  return value.getTime() >= start.getTime() && value.getTime() <= end.getTime()
}

function metricDelta(current: number, previous: number, lowerIsBetter = false): { label: string; tone: MetricTone; icon: typeof ArrowTrendingUpIcon | typeof ArrowTrendingDownIcon | typeof MinusIcon } {
  if (previous === 0) {
    if (current === 0) {
      return { label: 'No change', tone: 'zinc', icon: MinusIcon }
    }
    return { label: 'New activity', tone: lowerIsBetter ? 'red' : 'green', icon: lowerIsBetter ? ArrowTrendingUpIcon : ArrowTrendingUpIcon }
  }

  const deltaPct = ((current - previous) / Math.abs(previous)) * 100
  const positive = deltaPct > 0
  const neutral = Math.abs(deltaPct) < 0.01

  if (neutral) {
    return { label: 'No change', tone: 'zinc', icon: MinusIcon }
  }

  const tone: MetricTone = lowerIsBetter ? (positive ? 'red' : 'green') : positive ? 'green' : 'red'
  const icon = positive ? ArrowTrendingUpIcon : ArrowTrendingDownIcon
  const sign = positive ? '+' : ''
  return { label: `${sign}${deltaPct.toFixed(1)}% vs prior window`, tone, icon }
}

function statusColor(status: RunResponse['status']): 'green' | 'amber' | 'red' {
  if (status === 'Tied') return 'green'
  if (status === 'NeedsReview') return 'amber'
  return 'red'
}

export default function AppDashboardPage() {
  const router = useRouter()
  const [session, setSession] = useState<SessionState | null>(null)
  const [rows, setRows] = useState<DashboardRunRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [range, setRange] = useState<DateRange>('7d')
  const [wizardOpen, setWizardOpen] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)

  const refreshDashboard = useCallback(() => {
    setReloadToken((value) => value + 1)
  }, [])

  const closeWizard = useCallback(() => {
    setWizardOpen(false)
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    if (url.searchParams.get('newRun') === '1') {
      url.searchParams.delete('newRun')
      const nextQuery = url.searchParams.toString()
      router.replace(nextQuery ? `${url.pathname}?${nextQuery}` : url.pathname)
    }
  }, [router])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (params.get('newRun') === '1') {
      setWizardOpen(true)
    }
  }, [])

  useEffect(() => {
    const activeSession = loadSession()
    setSession(activeSession)

    if (!activeSession) {
      setRows([])
      setLoading(false)
      return
    }

    const history = loadRunHistory().slice(0, 40)
    if (history.length === 0) {
      setRows([])
      setLoading(false)
      return
    }
    const accessToken = activeSession.accessToken

    let cancelled = false

    async function loadDashboard() {
      setLoading(true)
      setError(null)

      try {
        const loaded = await Promise.all(
          history.map(async (record) => {
            try {
              const [run, summary] = await Promise.all([
                getRun(record.runId, accessToken),
                getRunSummary(record.runId, accessToken),
              ])

              const refreshed: RunHistoryRecord = {
                ...record,
                status: run.status,
                payDate: run.pay_date,
                payPeriodStart: run.pay_period_start,
                payPeriodEnd: run.pay_period_end,
                currency: (run.currency === 'EUR' ? 'EUR' : 'GBP') as 'GBP' | 'EUR',
                updatedAt: run.updated_at,
              }
              upsertRunHistory(refreshed)

              return {
                history: refreshed,
                run,
                summary,
              }
            } catch {
              return null
            }
          })
        )

        if (cancelled) return

        const filtered = loaded.filter((item): item is DashboardRunRow => item !== null)
        filtered.sort((a, b) => parseUtc(b.run.updated_at).getTime() - parseUtc(a.run.updated_at).getTime())
        setRows(filtered)
      } catch {
        if (!cancelled) {
          setError('Unable to load dashboard metrics. Start a new guided run to refresh data.')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadDashboard()

    return () => {
      cancelled = true
    }
  }, [reloadToken])

  const metrics = useMemo(() => {
    const now = new Date()
    const windowDays = range === '7d' ? 7 : 30

    const currentStart = new Date(now)
    currentStart.setUTCDate(now.getUTCDate() - windowDays)

    const previousEnd = new Date(currentStart)
    previousEnd.setUTCDate(previousEnd.getUTCDate() - 1)

    const previousStart = new Date(previousEnd)
    previousStart.setUTCDate(previousEnd.getUTCDate() - windowDays)

    const currentRuns = rows.filter((row) => inRange(parseUtc(row.run.updated_at), currentStart, now))
    const previousRuns = rows.filter((row) => inRange(parseUtc(row.run.updated_at), previousStart, previousEnd))

    const fallback = currentRuns.length > 0 ? currentRuns : rows
    const displayCurrency: 'GBP' | 'EUR' = fallback[0]?.history.currency ?? 'GBP'

    const sum = (items: DashboardRunRow[], selector: (row: DashboardRunRow) => number) => items.reduce((total, item) => total + selector(item), 0)

    const currentRunCount = currentRuns.length
    const previousRunCount = previousRuns.length

    const currentTiedRate = currentRuns.length ? (currentRuns.filter((row) => row.run.status === 'Tied').length / currentRuns.length) * 100 : 0
    const previousTiedRate = previousRuns.length ? (previousRuns.filter((row) => row.run.status === 'Tied').length / previousRuns.length) * 100 : 0

    const currentBlockers = sum(currentRuns, (row) => row.summary.unresolved_blockers)
    const previousBlockers = sum(previousRuns, (row) => row.summary.unresolved_blockers)

    const currentVarianceExposure = sum(currentRuns, (row) => row.summary.variance_total)
    const previousVarianceExposure = sum(previousRuns, (row) => row.summary.variance_total)

    return {
      periodLabel: range === '7d' ? 'Last 7 days' : 'Last 30 days',
      rowsForTable: fallback.slice(0, 12),
      cards: [
        {
          label: 'Runs processed',
          value: String(currentRunCount),
          delta: metricDelta(currentRunCount, previousRunCount),
        },
        {
          label: 'Tied run rate',
          value: toPercentage(currentTiedRate),
          delta: metricDelta(currentTiedRate, previousTiedRate),
        },
        {
          label: 'Open blockers',
          value: String(currentBlockers),
          delta: metricDelta(currentBlockers, previousBlockers, true),
        },
        {
          label: 'Variance exposure',
          value: toCurrency(currentVarianceExposure, displayCurrency),
          delta: metricDelta(currentVarianceExposure, previousVarianceExposure, true),
        },
      ],
    }
  }, [range, rows])

  if (!session) {
    return (
      <div className="space-y-6">
        <Heading className="text-3xl">Dashboard</Heading>
        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs">
          <Text className="text-zinc-700">Start a new run wizard to begin secure session setup and load live dashboard metrics.</Text>
          <div className="mt-4">
            <Button color="dark/zinc" onClick={() => setWizardOpen(true)}>
              Start new run
            </Button>
          </div>
        </section>
        <NewRunWizardModal open={wizardOpen} onClose={closeWizard} onRunUpdated={refreshDashboard} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs md:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Heading className="text-3xl">{greetingLabel(session.email)}</Heading>
            <Text className="mt-2 text-zinc-600">Operational overview of recent payroll reconciliation runs.</Text>
          </div>
          <div className="w-48">
            <Select value={range} onChange={(event) => setRange(event.target.value as DateRange)}>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
            </Select>
          </div>
        </div>

        <div className="mt-10">
          <Heading className="text-xl">Overview</Heading>
          <div className="mt-4 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.cards.map((card) => {
              const DeltaIcon = card.delta.icon
              return (
                <article key={card.label} className="border-t border-zinc-200 pt-5">
                  <Text className="text-sm font-medium text-zinc-600">{card.label}</Text>
                  <p className="mt-3 text-4xl font-semibold tabular-nums text-zinc-950">{card.value}</p>
                  <div className="mt-3">
                    <Badge color={card.delta.tone === 'green' ? 'green' : card.delta.tone === 'red' ? 'red' : 'zinc'}>
                      <DeltaIcon data-slot="icon" />
                      {card.delta.label}
                    </Badge>
                  </div>
                </article>
              )
            })}
          </div>
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-between gap-3">
          <div>
            <Heading className="text-xl">Recent runs</Heading>
            <Text className="mt-1 text-zinc-600">{metrics.periodLabel} with live status and variance totals.</Text>
          </div>
          <Button outline onClick={() => setWizardOpen(true)}>
            Start new run
            <ArrowRightIcon data-slot="icon" />
          </Button>
        </div>

        {loading ? (
          <div className="mt-6 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
            <Text className="text-sm text-zinc-700">Loading dashboard data...</Text>
          </div>
        ) : error ? (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4">
            <Text className="text-sm text-red-800">{error}</Text>
          </div>
        ) : metrics.rowsForTable.length === 0 ? (
          <div className="mt-6 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
            <Text className="text-sm text-zinc-700">No runs found for this profile yet. Create your first guided run to populate this dashboard.</Text>
          </div>
        ) : (
          <Table className="mt-6">
            <TableHead>
              <TableRow>
                <TableHeader>Run ID</TableHeader>
                <TableHeader>Pay date</TableHeader>
                <TableHeader>Client</TableHeader>
                <TableHeader>Period</TableHeader>
                <TableHeader>Status</TableHeader>
                <TableHeader>Blockers</TableHeader>
                <TableHeader>Variance total</TableHeader>
                <TableHeader>Updated</TableHeader>
                <TableHeader className="min-w-36">Action</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {metrics.rowsForTable.map((row) => (
                <TableRow key={row.run.id}>
                  <TableCell className="font-medium tabular-nums">{row.run.id.slice(0, 8)}</TableCell>
                  <TableCell className="tabular-nums">{formatDate(row.run.pay_date)}</TableCell>
                  <TableCell>{row.history.clientName}</TableCell>
                  <TableCell className="tabular-nums">
                    {formatDate(row.run.pay_period_start)} - {formatDate(row.run.pay_period_end)}
                  </TableCell>
                  <TableCell>
                    <Badge color={statusColor(row.run.status)}>{row.run.status}</Badge>
                  </TableCell>
                  <TableCell className="tabular-nums">{row.summary.unresolved_blockers}</TableCell>
                  <TableCell className="tabular-nums">{toCurrency(row.summary.variance_total, row.history.currency)}</TableCell>
                  <TableCell className="tabular-nums">{formatDate(row.run.updated_at)}</TableCell>
                  <TableCell className="min-w-36 whitespace-nowrap">
                    <Button plain className="whitespace-nowrap" onClick={() => setWizardOpen(true)}>
                      Open wizard
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
      <NewRunWizardModal open={wizardOpen} onClose={closeWizard} onRunUpdated={refreshDashboard} />
    </div>
  )
}
