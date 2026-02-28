'use client'

import { CheckCircleIcon, ChevronLeftIcon, ChevronRightIcon, ExclamationTriangleIcon, PlayCircleIcon } from '@heroicons/react/20/solid'
import clsx from 'clsx'
import { useEffect, useMemo, useState } from 'react'

import {
  ApiError,
  type AccessTokenResponse,
  API_BASE_URL,
  approveRun,
  approveVariance,
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
  reconcileRun,
  requestMagicLink,
  resolveVariance,
  type ClientResponse,
  type CountryPack,
  type DetectSchemaResponse,
  type ExportPackResponse,
  type MapColumnsResponse,
  type RunResponse,
  type RunSummaryResponse,
  type SourceFileResponse,
  type SourceFileType,
  submitRunForReview,
  uploadSourceFile,
  type ValidateResponse,
  validateSourceFile,
  verifyMagicLink,
  type VarianceResponse,
  type VarianceSeverity,
  type VarianceStatus,
} from '@/lib/api'
import { formatDate, formatEUR, formatGBP } from '@/lib/format'
import { patchRunHistory, upsertRunHistory } from '@/lib/run-history'
import { loadSession, persistSession, type SessionState } from '@/lib/session'
import {
  Badge,
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
  Divider,
  Field,
  FieldGroup,
  Fieldset,
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

const WIZARD_STEPS = [
  { key: 'scope', title: 'Run Scope' },
  { key: 'imports', title: 'Imports' },
  { key: 'reconcile', title: 'Reconcile' },
  { key: 'variances', title: 'Variances' },
  { key: 'review', title: 'Approval' },
  { key: 'export', title: 'Export Pack' },
] as const

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

function canApproveVariance(status: VarianceStatus): boolean {
  return status === 'Matched' || status === 'Explained' || status === 'ExpectedLater' || status === 'Ignored'
}

type NewRunWizardModalProps = {
  open: boolean
  onClose: () => void
  onRunUpdated?: () => void
}

export function NewRunWizardModal({ open, onClose, onRunUpdated }: NewRunWizardModalProps) {
  const defaults = useMemo(() => defaultDates(), [])
  const defaultContext = useMemo<RunContextState>(
    () => ({
      firmName: 'Northgate Payroll Bureau',
      clientName: 'Northgate Ltd',
      countryPack: 'UK',
      currency: 'GBP',
      payPeriodStart: defaults.payPeriodStart,
      payPeriodEnd: defaults.payPeriodEnd,
      payDate: defaults.payDate,
    }),
    [defaults.payDate, defaults.payPeriodEnd, defaults.payPeriodStart]
  )

  const [currentStep, setCurrentStep] = useState(0)

  const [session, setSession] = useState<SessionState | null>(null)
  const [authEmail, setAuthEmail] = useState('')
  const [authLoading, setAuthLoading] = useState(false)

  const [context, setContext] = useState<RunContextState>(defaultContext)

  const [clientRecord, setClientRecord] = useState<ClientResponse | null>(null)
  const [runRecord, setRunRecord] = useState<RunResponse | null>(null)

  const [selectedFiles, setSelectedFiles] = useState<Partial<Record<SourceFileType, File>>>({})
  const [imports, setImports] = useState<Record<SourceFileType, ImportProgress>>(emptyImportState())

  const [summary, setSummary] = useState<RunSummaryResponse | null>(null)
  const [variances, setVariances] = useState<VarianceResponse[]>([])
  const [varianceNotes, setVarianceNotes] = useState<Record<string, string>>({})
  const [reviewSubmitted, setReviewSubmitted] = useState(false)
  const [reviewApproved, setReviewApproved] = useState(false)

  const [exportPack, setExportPack] = useState<ExportPackResponse | null>(null)
  const [exportDownloadUrl, setExportDownloadUrl] = useState<string | null>(null)

  const [working, setWorking] = useState<string | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)

  useEffect(() => {
    if (!open) return

    const existing = loadSession()
    setSession(existing)
    setAuthEmail(existing?.email ?? '')

    setCurrentStep(0)
    setContext(defaultContext)
    setClientRecord(null)
    setRunRecord(null)
    setSelectedFiles({})
    setImports(emptyImportState())
    setSummary(null)
    setVariances([])
    setVarianceNotes({})
    setReviewSubmitted(false)
    setReviewApproved(false)
    setExportPack(null)
    setExportDownloadUrl(null)
    setWorking(null)
    setNotice(null)
  }, [defaultContext, open])

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

  const stepCompletion = useMemo(
    () => [
      Boolean(session && runRecord),
      importsReady,
      Boolean(summary),
      Boolean(summary) && blockers.length === 0,
      reviewSubmitted && reviewApproved && runRecord?.status === 'Tied',
      Boolean(exportPack),
    ],
    [blockers.length, exportPack, importsReady, reviewApproved, reviewSubmitted, runRecord, session, summary]
  )

  const maxAvailableStep = useMemo(() => {
    const firstIncomplete = stepCompletion.findIndex((done) => !done)
    return firstIncomplete === -1 ? WIZARD_STEPS.length - 1 : firstIncomplete
  }, [stepCompletion])

  useEffect(() => {
    if (currentStep > maxAvailableStep) {
      setCurrentStep(maxAvailableStep)
    }
  }, [currentStep, maxAvailableStep])

  const currentStepRequirements = useMemo(() => {
    if (currentStep === 0) {
      const requirements: string[] = []
      if (!session) requirements.push('Start secure session.')
      if (session && !runRecord) requirements.push('Create run context.')
      return requirements
    }

    if (currentStep === 1) {
      const requirements: string[] = []
      for (const sourceType of SOURCE_ORDER) {
        const entry = imports[sourceType]
        if (!entry.sourceFile) {
          requirements.push(`Process ${SOURCE_LABELS[sourceType]}.`)
          continue
        }
        if (entry.detect?.blocked) requirements.push(`${sourceType}: schema confidence is below the required threshold.`)
        if (entry.map?.blocked) requirements.push(`${sourceType}: required mapping fields are not fully confirmed.`)
        if ((entry.validate?.blockers.length ?? 0) > 0) requirements.push(`${sourceType}: resolve validation blockers.`)
      }
      return requirements
    }

    if (currentStep === 2) {
      return summary ? [] : ['Run reconciliation to generate status and variance results.']
    }

    if (currentStep === 3) {
      return blockers.length > 0 ? ['Resolve and approve all blocker variances.'] : []
    }

    if (currentStep === 4) {
      const requirements: string[] = []
      if (!reviewSubmitted) requirements.push('Submit run for review.')
      if (reviewSubmitted && !reviewApproved) requirements.push('Approve run as reviewer.')
      if (reviewApproved && runRecord?.status !== 'Tied') {
        requirements.push('Run is not tied yet. Go back to Variances and clear remaining open items.')
      }
      return requirements
    }

    return exportPack ? [] : ['Generate export pack.']
  }, [blockers.length, currentStep, exportPack, imports, reviewApproved, reviewSubmitted, runRecord, session, summary])

  function updateSession(nextSession: SessionState | null) {
    setSession(nextSession)
    persistSession(nextSession)
  }

  function ensureToken(): string {
    if (!session?.accessToken) {
      throw new Error('Start a secure session before continuing.')
    }
    return session.accessToken
  }

  function resetDownstream() {
    setSummary(null)
    setVariances([])
    setVarianceNotes({})
    setReviewSubmitted(false)
    setReviewApproved(false)
    setExportPack(null)
    setExportDownloadUrl(null)
  }

  function setSelectedFile(sourceType: SourceFileType, file: File | null) {
    setSelectedFiles((current) => ({
      ...current,
      [sourceType]: file ?? undefined,
    }))
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
    patchRunHistory(runId, { status: updatedRun.status, updatedAt: updatedRun.updated_at })
    onRunUpdated?.()
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

      updateSession({
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
      resetDownstream()
      setReviewSubmitted(false)
      setReviewApproved(false)

      upsertRunHistory({
        runId: run.id,
        clientId: client.id,
        clientName: client.name,
        firmName: context.firmName.trim(),
        countryPack: context.countryPack,
        currency: context.currency,
        payDate: run.pay_date,
        payPeriodStart: run.pay_period_start,
        payPeriodEnd: run.pay_period_end,
        status: run.status,
        createdAt: run.created_at,
        updatedAt: run.updated_at,
        hasExportPack: false,
      })
      onRunUpdated?.()

      setNotice({ tone: 'success', message: `Run ${run.id.slice(0, 8)} created. Continue to imports.` })
    } catch (error) {
      setNotice({ tone: 'error', message: getErrorMessage(error) })
    } finally {
      setWorking(null)
    }
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
          message: `${sourceType} import needs attention before reconciliation.`,
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
        const note = varianceNotes[blocker.id]?.trim() ?? 'Reviewed by preparer during run wizard.'
        let nextStatus = blocker.status
        if (blocker.status === 'Open') {
          const resolved = await resolveVariance(
            blocker.id,
            {
              status: 'Explained',
              note,
              explanation: note,
            },
            accessToken
          )
          nextStatus = resolved.status
        }

        if (canApproveVariance(nextStatus)) {
          await approveVariance(blocker.id, note, accessToken)
        }
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

      const submitted = await submitRunForReview(runRecord.id, 'Submitted from run wizard.', accessToken)
      setRunRecord(submitted)
      setReviewSubmitted(true)
      patchRunHistory(runRecord.id, { status: submitted.status, updatedAt: submitted.updated_at })
      onRunUpdated?.()
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

      const approved = await approveRun(runRecord.id, 'Approved from run wizard.', accessToken)
      setRunRecord(approved)
      setReviewApproved(true)
      patchRunHistory(runRecord.id, { status: approved.status, updatedAt: approved.updated_at })
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
      patchRunHistory(runRecord.id, { hasExportPack: true })
      onRunUpdated?.()
      setNotice({ tone: 'success', message: 'Audit pack generated successfully.' })
    } catch (error) {
      setNotice({ tone: 'error', message: getErrorMessage(error) })
    } finally {
      setWorking(null)
    }
  }

  function handleRequestClose() {
    if (working) return
    onClose()
  }

  function handleBackStep() {
    setCurrentStep((step) => Math.max(0, step - 1))
  }

  function handleNextStep() {
    if (!stepCompletion[currentStep]) return
    setCurrentStep((step) => Math.min(WIZARD_STEPS.length - 1, step + 1))
  }

  function renderStepContent() {
    if (currentStep === 0) {
      return (
        <div className="space-y-6">
          <div>
            <Text className="text-sm text-zinc-600">Start a secure session, then define run scope for this payroll close.</Text>
            <Text className="mt-1 text-xs text-zinc-500">API base: {API_BASE_URL}</Text>
          </div>

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

          <div className="flex flex-wrap items-center gap-3">
            <Button color="dark/zinc" disabled={authLoading} onClick={handleStartSession}>
              {authLoading ? 'Starting session...' : 'Start secure session'}
            </Button>
            <Button outline onClick={() => updateSession(null)}>
              Clear session
            </Button>
            {session ? <Badge color="green">Authenticated as {session.email}</Badge> : <Badge color="amber">No active session</Badge>}
          </div>

          <Divider />

          <Fieldset>
            <FieldGroup>
              <Field>
                <Label>Firm name</Label>
                <Input value={context.firmName} onChange={(event) => setContext((current) => ({ ...current, firmName: event.target.value }))} />
              </Field>
              <Field>
                <Label>Client name</Label>
                <Input value={context.clientName} onChange={(event) => setContext((current) => ({ ...current, clientName: event.target.value }))} />
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
                <Select value={context.currency} onChange={(event) => setContext((current) => ({ ...current, currency: event.target.value as CurrencyCode }))}>
                  <option value="GBP">GBP</option>
                  <option value="EUR">EUR</option>
                </Select>
              </Field>
              <Field>
                <Label>Pay period start</Label>
                <Input type="date" value={context.payPeriodStart} onChange={(event) => setContext((current) => ({ ...current, payPeriodStart: event.target.value }))} />
              </Field>
              <Field>
                <Label>Pay period end</Label>
                <Input type="date" value={context.payPeriodEnd} onChange={(event) => setContext((current) => ({ ...current, payPeriodEnd: event.target.value }))} />
              </Field>
              <Field>
                <Label>Pay date</Label>
                <Input type="date" value={context.payDate} onChange={(event) => setContext((current) => ({ ...current, payDate: event.target.value }))} />
              </Field>
            </FieldGroup>
          </Fieldset>

          <div className="flex flex-wrap items-center gap-3">
            <Button color="dark/zinc" disabled={working === 'create-context' || !session} onClick={handleCreateRunContext}>
              {working === 'create-context' ? 'Creating run...' : 'Create run context'}
            </Button>
            {runRecord ? <Badge color={runStatusTone(runRecord.status)}>Run {runRecord.id.slice(0, 8)}</Badge> : null}
            {clientRecord ? <Badge color="zinc">Client {clientRecord.name}</Badge> : null}
          </div>
        </div>
      )
    }

    if (currentStep === 1) {
      return (
        <div className="space-y-6">
          <Text className="text-sm text-zinc-600">
            Upload payroll, bank, and GL files. Every file must pass schema, mapping, and validation before the next step unlocks.
          </Text>

          <div className="grid gap-4 lg:grid-cols-3">
            {SOURCE_ORDER.map((sourceType) => (
              <article key={sourceType} className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                <Text className="text-sm font-semibold text-zinc-900">{SOURCE_LABELS[sourceType]}</Text>
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

          <div className="flex flex-wrap items-center gap-3">
            <Button color="dark/zinc" disabled={!runRecord || Boolean(working)} onClick={processAllSources}>
              {working === 'process-Payroll' || working === 'process-Bank' || working === 'process-GL' ? 'Processing files...' : 'Process all files'}
            </Button>
            <Badge color={importsReady ? 'green' : 'amber'}>{importsReady ? 'All files validated' : 'Validation pending'}</Badge>
          </div>

          <Table>
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
        </div>
      )
    }

    if (currentStep === 2) {
      return (
        <div className="space-y-6">
          <Text className="text-sm text-zinc-600">
            Reconciliation is deterministic only. You cannot run this step until all source files are validated.
          </Text>

          <div className="flex flex-wrap items-center gap-3">
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
            <Table>
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
        </div>
      )
    }

    if (currentStep === 3) {
      return (
        <div className="space-y-6">
          <Text className="text-sm text-zinc-600">
            Resolve blocker variances and capture notes. This step must be clean before reviewer approval is available.
          </Text>

          <div className="flex flex-wrap items-center gap-3">
            <Badge color="red">Blockers: {blockers.length}</Badge>
            <Badge color="amber">Warnings: {variances.filter((item) => item.severity === 'WARNING').length}</Badge>
            <Badge color="zinc">Info: {variances.filter((item) => item.severity === 'INFO').length}</Badge>
            <Button outline disabled={!runRecord || blockers.length === 0 || Boolean(working)} onClick={handleResolveAndApproveBlockers}>
              {working === 'resolve-blockers' ? 'Resolving blockers...' : 'Resolve + approve blockers'}
            </Button>
          </div>

          {variances.length === 0 ? (
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <Text className="text-sm text-zinc-700">No variances listed yet. Reconcile the run first.</Text>
            </div>
          ) : (
            <div className="space-y-3">
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
                      Expected later
                    </Button>
                    <Button
                      color="dark/zinc"
                      disabled={!canApproveVariance(variance.status) || variance.status === 'Approved' || variance.status === 'Closed' || Boolean(working)}
                      onClick={() => handleApproveVariance(variance)}
                    >
                      Approve
                    </Button>
                  </div>
                  {variance.status === 'Open' ? (
                    <Text className="mt-2 text-xs text-zinc-500">Resolve first using Explain or Expected later, then approve.</Text>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </div>
      )
    }

    if (currentStep === 4) {
      return (
        <div className="space-y-6">
          <Text className="text-sm text-zinc-600">
            Preparer submits the run, reviewer approves it. Approval is blocked while blocker variances remain unresolved.
          </Text>

          <div className="flex flex-wrap items-center gap-3">
            <Button outline disabled={!runRecord || Boolean(working)} onClick={handleSubmitForReview}>
              {working === 'submit-review' ? 'Submitting...' : 'Submit for review'}
            </Button>
            <Button color="dark/zinc" disabled={!runRecord || blockers.length > 0 || !reviewSubmitted || Boolean(working)} onClick={handleApproveRun}>
              {working === 'approve-run' ? 'Approving...' : 'Approve run'}
            </Button>
            {runRecord ? <Badge color={runStatusTone(runRecord.status)}>Run status: {runRecord.status}</Badge> : null}
            <Badge color={reviewSubmitted ? 'green' : 'zinc'}>{reviewSubmitted ? 'Submitted' : 'Not submitted'}</Badge>
            <Badge color={reviewApproved ? 'green' : 'zinc'}>{reviewApproved ? 'Approved' : 'Not approved'}</Badge>
          </div>
          {!reviewSubmitted ? <Text className="text-xs text-zinc-500">Submit for review first to unlock Approve run.</Text> : null}
        </div>
      )
    }

    return (
      <div className="space-y-6">
        <Text className="text-sm text-zinc-600">Generate the reproducible close pack after approval.</Text>

        <div className="flex flex-wrap items-center gap-3">
          <Button color="dark/zinc" disabled={!runRecord || runRecord.status !== 'Tied' || Boolean(working)} onClick={handleCreateExportPack}>
            {working === 'export-pack' ? 'Generating pack...' : 'Generate export pack'}
          </Button>
          {exportPack ? <Badge color="green">Pack created</Badge> : <Badge color="zinc">No pack yet</Badge>}
        </div>

        {exportPack ? (
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
            <Text className="text-sm text-zinc-700">Pack ID: {exportPack.id}</Text>
            <Text className="text-sm text-zinc-700">Checksum: {exportPack.checksum}</Text>
            <Text className="text-sm text-zinc-700">Created: {formatDate(exportPack.created_at)}</Text>
            <Text className="mt-2 text-xs text-zinc-500">{exportDownloadUrl ? `Download URL: ${exportDownloadUrl}` : 'Download URL unavailable for current storage mode.'}</Text>
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <Dialog open={open} onClose={handleRequestClose} size="5xl">
      <DialogTitle>New payroll reconciliation run</DialogTitle>
      <DialogDescription>
        Complete each step in order. Next is locked until the current step is complete to reduce mistakes and rework.
      </DialogDescription>

      <DialogBody className="space-y-6">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {WIZARD_STEPS.map((step, index) => {
            const done = stepCompletion[index]
            const active = currentStep === index
            const locked = index > maxAvailableStep
            return (
              <button
                key={step.key}
                type="button"
                disabled={locked}
                onClick={() => setCurrentStep(index)}
                className={clsx(
                  'flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition',
                  active ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-200 bg-white text-zinc-700',
                  done && !active ? 'border-green-300 bg-green-50 text-green-900' : null,
                  locked ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                )}
              >
                {done ? <CheckCircleIcon className="h-4 w-4 shrink-0" /> : active ? <PlayCircleIcon className="h-4 w-4 shrink-0" /> : <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-current text-[10px]">{index + 1}</span>}
                <span className="font-medium">{step.title}</span>
              </button>
            )
          })}
        </div>

        {notice ? (
          <section
            className={`rounded-xl border p-3 ${
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

        <section className="max-h-[56vh] overflow-y-auto pr-1">{renderStepContent()}</section>

        {!importsReady && runRecord && currentStep >= 2 ? (
          <section className="rounded-xl border border-zinc-200 bg-zinc-100 p-3">
            <Text className="flex items-start gap-2 text-sm text-amber-800">
              <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
              Reconciliation stays locked until all three sources are validated with zero blockers.
            </Text>
          </section>
        ) : null}

        <section
          className={clsx(
            'rounded-xl border p-3',
            stepCompletion[currentStep] ? 'border-green-300 bg-green-50 text-green-900' : 'border-amber-300 bg-amber-50 text-amber-900'
          )}
        >
          {stepCompletion[currentStep] ? (
            <Text className="text-sm">Step complete. Next is unlocked.</Text>
          ) : (
            <>
              <Text className="text-sm font-medium">To unlock Next, complete:</Text>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                {currentStepRequirements.map((requirement) => (
                  <li key={requirement}>{requirement}</li>
                ))}
              </ul>
            </>
          )}
        </section>
      </DialogBody>

      <DialogActions>
        <Button outline disabled={Boolean(working)} onClick={handleRequestClose}>
          Close
        </Button>
        <Button outline disabled={currentStep === 0 || Boolean(working)} onClick={handleBackStep}>
          <ChevronLeftIcon data-slot="icon" />
          Back
        </Button>
        {currentStep < WIZARD_STEPS.length - 1 ? (
          <Button color="dark/zinc" disabled={!stepCompletion[currentStep] || Boolean(working)} onClick={handleNextStep}>
            Next
            <ChevronRightIcon data-slot="icon" />
          </Button>
        ) : (
          <Button color="dark/zinc" disabled={!stepCompletion[WIZARD_STEPS.length - 1] || Boolean(working)} onClick={handleRequestClose}>
            Finish
            <CheckCircleIcon data-slot="icon" />
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}
