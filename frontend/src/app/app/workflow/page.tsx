'use client'

import { CheckCircleIcon, ExclamationTriangleIcon, InformationCircleIcon, PlayCircleIcon } from '@heroicons/react/20/solid'
import { useEffect, useMemo, useState } from 'react'

import {
  ApiError,
  API_BASE_URL,
  type AccessTokenResponse,
  type ClientResponse,
  type CountryPack,
  createClient,
  createExportPack,
  createFirm,
  createRun,
  detectSchema,
  extractTokenFromMagicLink,
  getExportPack,
  getRun,
  getRunSummary,
  listVariances,
  mapColumns,
  type ReconcileResponse,
  reconcileRun,
  requestMagicLink,
  resolveVariance,
  type RunResponse,
  type RunSummaryResponse,
  type SourceFileResponse,
  type SourceFileType,
  submitRunForReview,
  uploadSourceFile,
  validateSourceFile,
  verifyMagicLink,
  approveRun,
  approveVariance,
  type VarianceResponse,
  type VarianceSeverity,
  type VarianceStatus,
  type ValidateResponse,
  type DetectSchemaResponse,
  type MapColumnsResponse,
  type ExportPackResponse,
} from '@/lib/api'
import { formatDate, formatEUR, formatGBP } from '@/lib/format'
import {
  Badge,
  Button,
  Divider,
  Field,
  FieldGroup,
  Fieldset,
  Heading,
  Input,
  Label,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
  Textarea,
} from '@/components/ui'

type CurrencyCode = 'GBP' | 'EUR'

type SessionState = {
  email: string
  accessToken: string
  expiresAt: string
}

type RunContextState = {
  firmName: string
  clientName: string
  countryPack: CountryPack
  currency: CurrencyCode
  payPeriodStart: string
  payPeriodEnd: string
  payDate: string
}

type ImportProgress = {
  fileName?: string
  sourceFile?: SourceFileResponse
  detect?: DetectSchemaResponse
  map?: MapColumnsResponse
  validate?: ValidateResponse
  error?: string
}

type Notice = {
  tone: 'success' | 'warning' | 'error' | 'info'
  message: string
}

const SESSION_STORAGE_KEY = 'tally.session.v2'
const SOURCE_ORDER: SourceFileType[] = ['Payroll', 'Bank', 'GL']

const SOURCE_LABELS: Record<SourceFileType, string> = {
  Payroll: 'Payroll expected export',
  Bank: 'Bank transactions export',
  GL: 'General ledger journal export',
}

function defaultDates(): Pick<RunContextState, 'payPeriodStart' | 'payPeriodEnd' | 'payDate'> {
  const now = new Date()
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0))
  const iso = (value: Date) => value.toISOString().slice(0, 10)
  return {
    payPeriodStart: iso(start),
    payPeriodEnd: iso(end),
    payDate: iso(end),
  }
}

function emptyImportState(): Record<SourceFileType, ImportProgress> {
  return {
    Payroll: {},
    Bank: {},
    GL: {},
  }
}

function statusBadgeTone(severity: VarianceSeverity): 'red' | 'amber' | 'zinc' {
  if (severity === 'BLOCKER') return 'red'
  if (severity === 'WARNING') return 'amber'
  return 'zinc'
}

function runStatusTone(status: RunResponse['status'] | RunSummaryResponse['status'] | undefined): 'red' | 'amber' | 'green' | 'zinc' {
  if (!status) return 'zinc'
  if (status === 'Tied') return 'green'
  if (status === 'NotTied') return 'red'
  return 'amber'
}

function formatMoney(value: number | null | undefined, currency: CurrencyCode): string {
  if (value === null || value === undefined) return '-'
  return currency === 'EUR' ? formatEUR(value) : formatGBP(value)
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return `${error.message} (HTTP ${error.status})`
  }
  if (error instanceof Error) {
    return error.message
  }
  return 'An unexpected error occurred.'
}

function isVarianceActionable(status: VarianceStatus): boolean {
  return status === 'Open' || status === 'Matched' || status === 'Explained' || status === 'ExpectedLater' || status === 'Ignored'
}

export default function RunWorkflowPage() {
  const defaults = useMemo(() => defaultDates(), [])

  const [session, setSession] = useState<SessionState | null>(null)
  const [authEmail, setAuthEmail] = useState('')
  const [authLoading, setAuthLoading] = useState(false)

  const [context, setContext] = useState<RunContextState>({
    firmName: 'Northgate Payroll Bureau',
    clientName: 'Northgate Ltd',
    countryPack: 'UK',
    currency: 'GBP',
    payPeriodStart: defaults.payPeriodStart,
    payPeriodEnd: defaults.payPeriodEnd,
    payDate: defaults.payDate,
  })

  const [clientRecord, setClientRecord] = useState<ClientResponse | null>(null)
  const [runRecord, setRunRecord] = useState<RunResponse | null>(null)

  const [selectedFiles, setSelectedFiles] = useState<Partial<Record<SourceFileType, File>>>({})
  const [imports, setImports] = useState<Record<SourceFileType, ImportProgress>>(emptyImportState())

  const [reconcileRecord, setReconcileRecord] = useState<ReconcileResponse | null>(null)
  const [summary, setSummary] = useState<RunSummaryResponse | null>(null)
  const [variances, setVariances] = useState<VarianceResponse[]>([])
  const [varianceNotes, setVarianceNotes] = useState<Record<string, string>>({})

  const [exportPack, setExportPack] = useState<ExportPackResponse | null>(null)
  const [exportDownloadUrl, setExportDownloadUrl] = useState<string | null>(null)

  const [working, setWorking] = useState<string | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY)
    if (!raw) return

    try {
      const parsed = JSON.parse(raw) as SessionState
      if (parsed.expiresAt && new Date(parsed.expiresAt).getTime() > Date.now()) {
        setSession(parsed)
        setAuthEmail(parsed.email)
      } else {
        window.localStorage.removeItem(SESSION_STORAGE_KEY)
      }
    } catch {
      window.localStorage.removeItem(SESSION_STORAGE_KEY)
    }
  }, [])

  const blockers = useMemo(
    () => variances.filter((item) => item.severity === 'BLOCKER' && item.status !== 'Approved' && item.status !== 'Closed'),
    [variances]
  )

  const importsReady = useMemo(
    () =>
      SOURCE_ORDER.every((sourceType) => {
        const entry = imports[sourceType]
        return Boolean(
          entry.sourceFile &&
            entry.detect &&
            !entry.detect.blocked &&
            entry.map &&
            !entry.map.blocked &&
            entry.validate &&
            entry.validate.blockers.length === 0
        )
      }),
    [imports]
  )

  const stepStatus = useMemo(() => {
    return [
      {
        label: '1. Authenticate and define run scope',
        done: Boolean(session && runRecord),
      },
      {
        label: '2. Upload and validate payroll/bank/GL files',
        done: importsReady,
      },
      {
        label: '3. Run deterministic reconciliation',
        done: Boolean(reconcileRecord),
      },
      {
        label: '4. Resolve and approve blocker variances',
        done: Boolean(reconcileRecord) && blockers.length === 0,
      },
      {
        label: '5. Submit and reviewer approve the run',
        done: runRecord?.status === 'Tied',
      },
      {
        label: '6. Generate audit pack',
        done: Boolean(exportPack),
      },
    ]
  }, [blockers.length, exportPack, importsReady, reconcileRecord, runRecord, session])

  function persistSession(nextSession: SessionState | null) {
    setSession(nextSession)
    if (typeof window === 'undefined') return

    if (nextSession) {
      window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(nextSession))
    } else {
      window.localStorage.removeItem(SESSION_STORAGE_KEY)
    }
  }

  async function handleStartSession() {
    if (!authEmail.trim()) {
      setNotice({ tone: 'warning', message: 'Enter your work email to start a secure session.' })
      return
    }

    setAuthLoading(true)
    setNotice(null)

    try {
      const requested = await requestMagicLink(authEmail.trim().toLowerCase())
      const token = extractTokenFromMagicLink(requested.magic_link)
      const verified: AccessTokenResponse = await verifyMagicLink(token)

      persistSession({
        email: verified.user.email,
        accessToken: verified.access_token,
        expiresAt: verified.expires_at,
      })

      setAuthEmail(verified.user.email)
      setNotice({ tone: 'success', message: 'Session started. Continue with run setup.' })
    } catch (error) {
      setNotice({ tone: 'error', message: getErrorMessage(error) })
    } finally {
      setAuthLoading(false)
    }
  }

  function ensureToken(): string {
    if (!session?.accessToken) {
      throw new Error('Start a session before continuing.')
    }
    return session.accessToken
  }

  async function handleCreateRunContext() {
    try {
      const accessToken = ensureToken()
      setWorking('create-context')
      setNotice(null)

      const firm = await createFirm(context.firmName.trim(), accessToken)
      const client = await createClient(
        {
          firm_id: firm.id,
          name: context.clientName.trim(),
          country_pack: context.countryPack,
          base_currency: context.currency,
        },
        accessToken
      )
      const run = await createRun(
        client.id,
        {
          pay_period_start: context.payPeriodStart,
          pay_period_end: context.payPeriodEnd,
          pay_date: context.payDate,
          currency: context.currency,
          country_pack: context.countryPack,
        },
        accessToken
      )

      setClientRecord(client)
      setRunRecord(run)
      setImports(emptyImportState())
      setSelectedFiles({})
      setReconcileRecord(null)
      setSummary(null)
      setVariances([])
      setVarianceNotes({})
      setExportPack(null)
      setExportDownloadUrl(null)

      setNotice({ tone: 'success', message: `Run ${run.id.slice(0, 8)} created. Upload source files next.` })
    } catch (error) {
      setNotice({ tone: 'error', message: getErrorMessage(error) })
    } finally {
      setWorking(null)
    }
  }

  function setSelectedFile(sourceType: SourceFileType, file: File | null) {
    setSelectedFiles((current) => ({
      ...current,
      [sourceType]: file ?? undefined,
    }))
  }

  function resetDownstream() {
    setReconcileRecord(null)
    setSummary(null)
    setVariances([])
    setVarianceNotes({})
    setExportPack(null)
    setExportDownloadUrl(null)
  }

  async function processSourceType(sourceType: SourceFileType) {
    try {
      const accessToken = ensureToken()
      if (!runRecord) {
        throw new Error('Create the run context before importing files.')
      }

      const file = selectedFiles[sourceType]
      if (!file) {
        throw new Error(`Choose a file for ${SOURCE_LABELS[sourceType]}.`)
      }

      setWorking(`process-${sourceType}`)
      setNotice(null)

      const uploaded = await uploadSourceFile(runRecord.id, sourceType, file, accessToken)
      const detected = await detectSchema(uploaded.id, accessToken)
      const mapped = await mapColumns(uploaded.id, accessToken)
      const validated = await validateSourceFile(uploaded.id, accessToken)

      setImports((current) => ({
        ...current,
        [sourceType]: {
          fileName: file.name,
          sourceFile: uploaded,
          detect: detected,
          map: mapped,
          validate: validated,
          error: undefined,
        },
      }))

      resetDownstream()

      if (detected.blocked || mapped.blocked || validated.blockers.length > 0) {
        setNotice({
          tone: 'warning',
          message: `${sourceType} import needs attention before reconciliation. Review blocker details in the table.`,
        })
      } else {
        setNotice({ tone: 'success', message: `${sourceType} file uploaded and validated.` })
      }
    } catch (error) {
      setImports((current) => ({
        ...current,
        [sourceType]: {
          ...current[sourceType],
          error: getErrorMessage(error),
        },
      }))
      setNotice({ tone: 'error', message: getErrorMessage(error) })
    } finally {
      setWorking(null)
    }
  }

  async function processAllSources() {
    for (const sourceType of SOURCE_ORDER) {
      const file = selectedFiles[sourceType]
      if (file) {
        await processSourceType(sourceType)
      }
    }
  }

  async function refreshReconciliationViews(runId: string, accessToken: string) {
    const [updatedRun, nextSummary, nextVariances] = await Promise.all([
      getRun(runId, accessToken),
      getRunSummary(runId, accessToken),
      listVariances(runId, accessToken),
    ])

    setRunRecord(updatedRun)
    setSummary(nextSummary)
    setVariances(nextVariances)
  }

  async function handleReconcile() {
    try {
      const accessToken = ensureToken()
      if (!runRecord) {
        throw new Error('Create a run and import validated files before reconciling.')
      }
      if (!importsReady) {
        throw new Error('All three source files must be validated without blockers before reconciliation.')
      }

      setWorking('reconcile')
      setNotice(null)

      const record = await reconcileRun(runRecord.id, accessToken)
      setReconcileRecord(record)
      await refreshReconciliationViews(runRecord.id, accessToken)
      setNotice({ tone: 'success', message: `Reconciliation complete. Run status: ${record.status}.` })
    } catch (error) {
      setNotice({ tone: 'error', message: getErrorMessage(error) })
    } finally {
      setWorking(null)
    }
  }

  async function handleResolveVariance(variance: VarianceResponse, status: VarianceStatus) {
    try {
      const accessToken = ensureToken()
      if (!runRecord) {
        throw new Error('Create and reconcile a run first.')
      }

      setWorking(`resolve-${variance.id}`)
      setNotice(null)

      const note = varianceNotes[variance.id]?.trim()
      await resolveVariance(
        variance.id,
        {
          status,
          note,
          explanation: note,
        },
        accessToken,
        status === 'Ignored'
      )

      await refreshReconciliationViews(runRecord.id, accessToken)
      setNotice({ tone: 'success', message: `${variance.code} moved to ${status}.` })
    } catch (error) {
      setNotice({ tone: 'error', message: getErrorMessage(error) })
    } finally {
      setWorking(null)
    }
  }

  async function handleApproveVariance(variance: VarianceResponse) {
    try {
      const accessToken = ensureToken()
      if (!runRecord) {
        throw new Error('Create and reconcile a run first.')
      }

      setWorking(`approve-variance-${variance.id}`)
      setNotice(null)

      const note = varianceNotes[variance.id]?.trim()
      await approveVariance(variance.id, note, accessToken)
      await refreshReconciliationViews(runRecord.id, accessToken)
      setNotice({ tone: 'success', message: `${variance.code} approved.` })
    } catch (error) {
      setNotice({ tone: 'error', message: getErrorMessage(error) })
    } finally {
      setWorking(null)
    }
  }

  async function handleResolveAndApproveBlockers() {
    try {
      const accessToken = ensureToken()
      if (!runRecord) {
        throw new Error('Create and reconcile a run first.')
      }

      setWorking('resolve-blockers')
      setNotice(null)

      for (const blocker of blockers) {
        const note = varianceNotes[blocker.id]?.trim() ?? 'Reviewed by preparer during guided run.'
        if (blocker.status === 'Open') {
          await resolveVariance(
            blocker.id,
            {
              status: 'Explained',
              note,
              explanation: note,
            },
            accessToken
          )
        }
        await approveVariance(blocker.id, note, accessToken)
      }

      await refreshReconciliationViews(runRecord.id, accessToken)
      setNotice({ tone: 'success', message: 'All blocker variances were resolved and approved.' })
    } catch (error) {
      setNotice({ tone: 'error', message: getErrorMessage(error) })
    } finally {
      setWorking(null)
    }
  }

  async function handleSubmitForReview() {
    try {
      const accessToken = ensureToken()
      if (!runRecord) {
        throw new Error('Create and reconcile a run first.')
      }

      setWorking('submit-review')
      setNotice(null)

      const submitted = await submitRunForReview(runRecord.id, 'Submitted from guided reconciliation workflow.', accessToken)
      setRunRecord(submitted)
      setNotice({ tone: 'success', message: 'Run submitted for reviewer approval.' })
    } catch (error) {
      setNotice({ tone: 'error', message: getErrorMessage(error) })
    } finally {
      setWorking(null)
    }
  }

  async function handleApproveRun() {
    try {
      const accessToken = ensureToken()
      if (!runRecord) {
        throw new Error('Create and reconcile a run first.')
      }

      setWorking('approve-run')
      setNotice(null)

      const approved = await approveRun(runRecord.id, 'Approved from guided reconciliation workflow.', accessToken)
      setRunRecord(approved)
      await refreshReconciliationViews(runRecord.id, accessToken)
      setNotice({ tone: 'success', message: `Run approved. Current status: ${approved.status}.` })
    } catch (error) {
      setNotice({ tone: 'error', message: getErrorMessage(error) })
    } finally {
      setWorking(null)
    }
  }

  async function handleCreateExportPack() {
    try {
      const accessToken = ensureToken()
      if (!runRecord) {
        throw new Error('Create and approve a run before exporting a pack.')
      }

      setWorking('export-pack')
      setNotice(null)

      const pack = await createExportPack(runRecord.id, accessToken)
      const download = await getExportPack(runRecord.id, pack.id, accessToken)

      setExportPack(pack)
      setExportDownloadUrl(download.download_url)
      setNotice({ tone: 'success', message: 'Audit pack generated successfully.' })
    } catch (error) {
      setNotice({ tone: 'error', message: getErrorMessage(error) })
    } finally {
      setWorking(null)
    }
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <Heading className="text-3xl">Guided payroll reconciliation journey</Heading>
        <Text className="text-zinc-600">
          Real payroll teams usually reconcile in one sequence: define run scope, import evidence files, reconcile, resolve
          exceptions, reviewer approval, and export the close pack. This page mirrors that exact flow.
        </Text>
        <Text className="text-sm text-zinc-500">API base: {API_BASE_URL}</Text>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {stepStatus.map((step) => (
          <article key={step.label} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs">
            <Text className="flex items-center gap-2 text-sm font-medium text-zinc-900">
              {step.done ? <CheckCircleIcon className="h-4 w-4 text-green-700" /> : <PlayCircleIcon className="h-4 w-4 text-zinc-500" />}
              {step.label}
            </Text>
          </article>
        ))}
      </section>

      {notice ? (
        <section
          className={`rounded-2xl border p-4 ${
            notice.tone === 'success'
              ? 'border-green-300 bg-green-50 text-green-900'
              : notice.tone === 'warning'
                ? 'border-amber-300 bg-amber-50 text-amber-900'
                : notice.tone === 'error'
                  ? 'border-red-300 bg-red-50 text-red-900'
                  : 'border-zinc-300 bg-zinc-100 text-zinc-900'
          }`}
        >
          <Text className="text-sm">{notice.message}</Text>
        </section>
      ) : null}

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs">
        <Heading className="text-xl">1. Authenticate and define run scope</Heading>
        <Text className="mt-2 text-zinc-600">
          Start a secure session, then define client and period details. In production, bearer token auth is required.
        </Text>

        <Divider className="my-5" />

        <Fieldset>
          <FieldGroup>
            <Field>
              <Label>Work email</Label>
              <Input
                type="email"
                value={authEmail}
                onChange={(event) => setAuthEmail(event.target.value)}
                placeholder="payroll.manager@firm.co.uk"
              />
            </Field>
          </FieldGroup>
        </Fieldset>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button color="dark/zinc" disabled={authLoading} onClick={handleStartSession}>
            {authLoading ? 'Starting session...' : 'Start secure session'}
          </Button>
          <Button outline onClick={() => persistSession(null)}>
            Clear session
          </Button>
          {session ? (
            <Badge color="green" className="truncate">
              Authenticated as {session.email}
            </Badge>
          ) : (
            <Badge color="amber">No active session</Badge>
          )}
        </div>

        <Divider className="my-6" />

        <Fieldset>
          <FieldGroup>
            <Field>
              <Label>Firm name</Label>
              <Input
                value={context.firmName}
                onChange={(event) => setContext((current) => ({ ...current, firmName: event.target.value }))}
              />
            </Field>
            <Field>
              <Label>Client name</Label>
              <Input
                value={context.clientName}
                onChange={(event) => setContext((current) => ({ ...current, clientName: event.target.value }))}
              />
            </Field>
            <Field>
              <Label>Country pack</Label>
              <Select
                value={context.countryPack}
                onChange={(event) =>
                  setContext((current) => ({
                    ...current,
                    countryPack: event.target.value as CountryPack,
                    currency: event.target.value === 'UK' ? 'GBP' : 'EUR',
                  }))
                }
              >
                <option value="UK">UK</option>
                <option value="IE">Ireland</option>
              </Select>
            </Field>
            <Field>
              <Label>Currency</Label>
              <Select
                value={context.currency}
                onChange={(event) => setContext((current) => ({ ...current, currency: event.target.value as CurrencyCode }))}
              >
                <option value="GBP">GBP</option>
                <option value="EUR">EUR</option>
              </Select>
            </Field>
            <Field>
              <Label>Pay period start</Label>
              <Input
                type="date"
                value={context.payPeriodStart}
                onChange={(event) => setContext((current) => ({ ...current, payPeriodStart: event.target.value }))}
              />
            </Field>
            <Field>
              <Label>Pay period end</Label>
              <Input
                type="date"
                value={context.payPeriodEnd}
                onChange={(event) => setContext((current) => ({ ...current, payPeriodEnd: event.target.value }))}
              />
            </Field>
            <Field>
              <Label>Pay date</Label>
              <Input
                type="date"
                value={context.payDate}
                onChange={(event) => setContext((current) => ({ ...current, payDate: event.target.value }))}
              />
            </Field>
          </FieldGroup>
        </Fieldset>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button color="dark/zinc" disabled={working === 'create-context' || !session} onClick={handleCreateRunContext}>
            {working === 'create-context' ? 'Creating run...' : 'Create run context'}
          </Button>
          {runRecord ? <Badge color={runStatusTone(runRecord.status)}>Run {runRecord.id.slice(0, 8)}</Badge> : null}
          {clientRecord ? <Badge color="zinc">Client {clientRecord.name}</Badge> : null}
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs">
        <Heading className="text-xl">2. Upload and validate source files</Heading>
        <Text className="mt-2 text-zinc-600">
          Upload payroll, bank, and GL exports. Each file runs through schema detection, mapping, and strict validation.
        </Text>

        <Divider className="my-5" />

        <div className="grid gap-4 lg:grid-cols-3">
          {SOURCE_ORDER.map((sourceType) => (
            <article key={sourceType} className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <Heading className="text-base">{SOURCE_LABELS[sourceType]}</Heading>
              <Input type="file" className="mt-3" onChange={(event) => setSelectedFile(sourceType, event.target.files?.[0] ?? null)} />
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button outline disabled={!runRecord || !selectedFiles[sourceType] || Boolean(working)} onClick={() => processSourceType(sourceType)}>
                  {working === `process-${sourceType}` ? 'Processing...' : 'Process file'}
                </Button>
                {imports[sourceType].sourceFile ? <Badge color="green">Imported</Badge> : <Badge color="zinc">Pending</Badge>}
              </div>
              {imports[sourceType].error ? <Text className="mt-2 text-sm text-red-700">{imports[sourceType].error}</Text> : null}
            </article>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button color="dark/zinc" disabled={!runRecord || Boolean(working)} onClick={processAllSources}>
            {working === 'process-Payroll' || working === 'process-Bank' || working === 'process-GL' ? 'Processing files...' : 'Process all files'}
          </Button>
          <Badge color={importsReady ? 'green' : 'amber'}>{importsReady ? 'All files validated' : 'Validation pending'}</Badge>
        </div>

        <Table className="mt-6">
          <TableHead>
            <TableRow>
              <TableHeader>Source</TableHeader>
              <TableHeader>Schema confidence</TableHeader>
              <TableHeader>Mapping confidence</TableHeader>
              <TableHeader>Rows OK</TableHeader>
              <TableHeader>Parse failure</TableHeader>
              <TableHeader>Validation blockers</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {SOURCE_ORDER.map((sourceType) => {
              const entry = imports[sourceType]
              const blockerCount = entry.validate?.blockers.length ?? 0
              return (
                <TableRow key={sourceType}>
                  <TableCell>{sourceType}</TableCell>
                  <TableCell className="tabular-nums">{entry.detect ? `${Math.round(entry.detect.confidence * 100)}%` : '-'}</TableCell>
                  <TableCell className="tabular-nums">{entry.map ? `${Math.round(entry.map.confidence * 100)}%` : '-'}</TableCell>
                  <TableCell className="tabular-nums">{entry.validate ? `${entry.validate.parsed_ok}/${entry.validate.row_count}` : '-'}</TableCell>
                  <TableCell className="tabular-nums">{entry.validate ? `${(entry.validate.failure_rate * 100).toFixed(2)}%` : '-'}</TableCell>
                  <TableCell>
                    {blockerCount > 0 || entry.map?.blocked || entry.detect?.blocked ? (
                      <Badge color="red">Needs fix</Badge>
                    ) : entry.validate ? (
                      <Badge color="green">Ready</Badge>
                    ) : (
                      <Badge color="zinc">Pending</Badge>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs">
        <Heading className="text-xl">3. Run deterministic reconciliation</Heading>
        <Text className="mt-2 text-zinc-600">
          Reconciliation only runs after all three datasets pass validation. No AI approvals, only deterministic rules.
        </Text>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button color="dark/zinc" disabled={!runRecord || !importsReady || Boolean(working)} onClick={handleReconcile}>
            {working === 'reconcile' ? 'Reconciling...' : 'Run reconciliation'}
          </Button>
          <Button
            outline
            disabled={!runRecord || Boolean(working)}
            onClick={async () => {
              try {
                if (!runRecord) return
                const token = ensureToken()
                setWorking('refresh-summary')
                await refreshReconciliationViews(runRecord.id, token)
                setNotice({ tone: 'info', message: 'Run summary and variances refreshed.' })
              } catch (error) {
                setNotice({ tone: 'error', message: getErrorMessage(error) })
              } finally {
                setWorking(null)
              }
            }}
          >
            Refresh results
          </Button>
          {summary ? <Badge color={runStatusTone(summary.status)}>{summary.status}</Badge> : <Badge color="zinc">Not reconciled</Badge>}
        </div>

        {summary ? (
          <Table className="mt-6">
            <TableHead>
              <TableRow>
                <TableHeader>Metric</TableHeader>
                <TableHeader>Value</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow>
                <TableCell>Payroll total</TableCell>
                <TableCell className="tabular-nums">{formatMoney(summary.payroll_total, context.currency)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Bank total</TableCell>
                <TableCell className="tabular-nums">{formatMoney(summary.bank_total, context.currency)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>GL total</TableCell>
                <TableCell className="tabular-nums">{formatMoney(summary.gl_total, context.currency)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Variance total</TableCell>
                <TableCell className="tabular-nums">{formatMoney(summary.variance_total, context.currency)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Unresolved blockers</TableCell>
                <TableCell className="tabular-nums">{summary.unresolved_blockers}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        ) : null}
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs">
        <Heading className="text-xl">4. Resolve variances</Heading>
        <Text className="mt-2 text-zinc-600">
          Review each variance, add an explanation, move to an allowed status, and approve blockers so the run can close.
        </Text>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Badge color="red">Blockers: {blockers.length}</Badge>
          <Badge color="amber">Warnings: {variances.filter((item) => item.severity === 'WARNING').length}</Badge>
          <Badge color="zinc">Info: {variances.filter((item) => item.severity === 'INFO').length}</Badge>
          <Button outline disabled={!runRecord || blockers.length === 0 || Boolean(working)} onClick={handleResolveAndApproveBlockers}>
            {working === 'resolve-blockers' ? 'Resolving blockers...' : 'Resolve + approve all blockers'}
          </Button>
        </div>

        {variances.length === 0 ? (
          <div className="mt-5 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
            <Text className="text-sm text-zinc-700">No variances listed yet. Run reconciliation to populate this section.</Text>
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            {variances.map((variance) => (
              <article key={variance.id} className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge color={statusBadgeTone(variance.severity)}>{variance.code}</Badge>
                  <Text className="font-medium text-zinc-900">{variance.title}</Text>
                  <Text className="tabular-nums text-zinc-600">{formatMoney(variance.amount, context.currency)}</Text>
                  <Badge color={variance.status === 'Approved' || variance.status === 'Closed' ? 'green' : 'zinc'}>{variance.status}</Badge>
                </div>
                <Text className="mt-2 text-sm text-zinc-600">{variance.default_action}</Text>
                <Field className="mt-3">
                  <Label>Explanation or reviewer note</Label>
                  <Textarea
                    value={varianceNotes[variance.id] ?? variance.explanation ?? variance.resolution_note ?? ''}
                    rows={2}
                    onChange={(event) =>
                      setVarianceNotes((current) => ({
                        ...current,
                        [variance.id]: event.target.value,
                      }))
                    }
                  />
                </Field>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    outline
                    disabled={!isVarianceActionable(variance.status) || Boolean(working)}
                    onClick={() => handleResolveVariance(variance, 'Explained')}
                  >
                    Explain
                  </Button>
                  <Button
                    outline
                    disabled={!isVarianceActionable(variance.status) || Boolean(working)}
                    onClick={() => handleResolveVariance(variance, 'ExpectedLater')}
                  >
                    Mark expected later
                  </Button>
                  <Button
                    color="dark/zinc"
                    disabled={variance.status === 'Approved' || variance.status === 'Closed' || Boolean(working)}
                    onClick={() => handleApproveVariance(variance)}
                  >
                    Approve variance
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs">
        <Heading className="text-xl">5. Submit and approve run</Heading>
        <Text className="mt-2 text-zinc-600">
          In real bureau workflows, preparers submit and reviewers approve only after blockers are resolved with notes.
        </Text>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button outline disabled={!runRecord || Boolean(working)} onClick={handleSubmitForReview}>
            {working === 'submit-review' ? 'Submitting...' : 'Submit for review'}
          </Button>
          <Button color="dark/zinc" disabled={!runRecord || blockers.length > 0 || Boolean(working)} onClick={handleApproveRun}>
            {working === 'approve-run' ? 'Approving...' : 'Approve run'}
          </Button>
          {runRecord ? <Badge color={runStatusTone(runRecord.status)}>Run status: {runRecord.status}</Badge> : null}
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs">
        <Heading className="text-xl">6. Generate audit pack</Heading>
        <Text className="mt-2 text-zinc-600">
          Generate the reproducible evidence pack after approval. Pack metadata includes hash and timestamp.
        </Text>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button color="dark/zinc" disabled={!runRecord || runRecord.status !== 'Tied' || Boolean(working)} onClick={handleCreateExportPack}>
            {working === 'export-pack' ? 'Generating pack...' : 'Generate export pack'}
          </Button>
          {exportPack ? <Badge color="green">Pack created</Badge> : <Badge color="zinc">No pack yet</Badge>}
        </div>

        {exportPack ? (
          <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
            <Text className="text-sm text-zinc-700">Pack ID: {exportPack.id}</Text>
            <Text className="text-sm text-zinc-700">Checksum: {exportPack.checksum}</Text>
            <Text className="text-sm text-zinc-700">Created: {formatDate(exportPack.created_at)}</Text>
            {exportDownloadUrl ? (
              <Text className="mt-2 text-xs text-zinc-500">Download URL: {exportDownloadUrl}</Text>
            ) : (
              <Text className="mt-2 text-xs text-zinc-500">Download URL unavailable for current storage mode.</Text>
            )}
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-zinc-100 p-5">
        <Text className="flex items-start gap-2 text-sm text-zinc-700">
          <InformationCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
          Journey note: this guided workspace replaces the old tab-by-tab navigation. Teams should execute runs from top to
          bottom here, then return for next run.
        </Text>
        {!importsReady && runRecord ? (
          <Text className="mt-3 flex items-start gap-2 text-sm text-amber-800">
            <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
            Reconciliation is intentionally blocked until all three sources are validated without blockers.
          </Text>
        ) : null}
      </section>
    </div>
  )
}
