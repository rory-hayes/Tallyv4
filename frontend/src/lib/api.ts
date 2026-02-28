const PRODUCTION_API_FALLBACK = 'https://tally-api-v4-probe.onrender.com'
const DEVELOPMENT_API_FALLBACK = 'http://127.0.0.1:8000'

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  (process.env.NODE_ENV === 'development' ? DEVELOPMENT_API_FALLBACK : PRODUCTION_API_FALLBACK)

export class ApiError extends Error {
  status: number
  payload: unknown

  constructor(status: number, detail: string, payload: unknown) {
    super(detail)
    this.name = 'ApiError'
    this.status = status
    this.payload = payload
  }
}

export type CountryPack = 'UK' | 'IE'
export type CurrencyCode = 'GBP' | 'EUR'
export type SourceFileType = 'Bank' | 'GL' | 'Payroll'
export type RunStatus = 'Tied' | 'NotTied' | 'NeedsReview'
export type VarianceSeverity = 'BLOCKER' | 'WARNING' | 'INFO'
export type VarianceStatus =
  | 'Open'
  | 'Matched'
  | 'Explained'
  | 'ExpectedLater'
  | 'Ignored'
  | 'Approved'
  | 'Closed'

export interface MagicLinkRequestResponse {
  message: string
  expires_at: string
  delivery_mode: string
  magic_link?: string | null
  verification_token?: string | null
}

export interface AccessTokenResponse {
  access_token: string
  token_type: 'bearer'
  expires_at: string
  user: {
    id: string
    email: string
  }
}

export interface FirmResponse {
  id: string
  name: string
  created_at: string
}

export interface ClientResponse {
  id: string
  firm_id: string
  name: string
  country_pack: CountryPack
  base_currency: CurrencyCode
  created_at: string
}

export interface RunResponse {
  id: string
  client_id: string
  pay_period_start: string
  pay_period_end: string
  pay_date: string
  currency: CurrencyCode
  country_pack: CountryPack
  status: RunStatus
  rule_version: string
  created_at: string
  updated_at: string
}

export interface SourceFileResponse {
  id: string
  run_id: string
  source_type: SourceFileType
  original_name: string
  container_type: string
  sha256_hash: string
  upload_timestamp: string
}

export interface DetectSchemaResponse {
  schema_type: string | null
  confidence: number
  reasons: string[]
  requires_confirmation: boolean
  blocked: boolean
  available_columns: string[]
  sample_rows: Array<Record<string, unknown>>
}

export interface MapColumnsResponse {
  schema_type: string
  confidence: number
  required_fields: Record<string, boolean>
  mapping: Record<string, unknown>
  blocked: boolean
  available_columns: string[]
  sample_rows: Array<Record<string, unknown>>
}

export interface ValidateResponse {
  row_count: number
  parsed_ok: number
  parsed_failed: number
  failure_rate: number
  blockers: string[]
  warnings: string[]
}

export interface ReconcileResponse {
  run_id: string
  status: RunStatus
  matched_groups: number
  created_variances: number
}

export interface RunSummaryResponse {
  run_id: string
  status: RunStatus
  payroll_total: number
  bank_total: number
  gl_total: number
  variance_total: number
  unresolved_blockers: number
}

export interface VarianceResponse {
  id: string
  run_id: string
  code: string
  title: string
  severity: VarianceSeverity
  status: VarianceStatus
  amount: number | null
  default_action: string
  explanation: string | null
  resolution_note: string | null
  trigger_snapshot: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface ExportPackResponse {
  id: string
  run_id: string
  storage_key: string
  checksum: string
  format: string
  reproducibility_fingerprint: string
  created_at: string
}

export interface ExportPackDownloadResponse {
  id: string
  run_id: string
  download_url: string
  checksum: string
}

type RequestOptions = Omit<RequestInit, 'headers'> & {
  headers?: HeadersInit
}

async function request<T>(path: string, options: RequestOptions = {}, accessToken?: string): Promise<T> {
  const headers = new Headers(options.headers)

  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`)
  }

  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData
  if (options.body && !isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    cache: 'no-store',
  })

  const raw = await response.text()
  let payload: unknown = null
  if (raw) {
    try {
      payload = JSON.parse(raw)
    } catch {
      payload = raw
    }
  }

  if (!response.ok) {
    const detail =
      typeof payload === 'object' && payload !== null && 'detail' in payload
        ? String((payload as { detail: unknown }).detail)
        : typeof payload === 'object' && payload !== null && 'message' in payload
          ? String((payload as { message: unknown }).message)
          : `Request failed (${response.status})`

    throw new ApiError(response.status, detail, payload)
  }

  return payload as T
}

export function extractTokenFromMagicLink(magicLink: string): string {
  const url = new URL(magicLink)
  const token = url.searchParams.get('token')
  if (!token) {
    throw new Error('Magic link token missing from response')
  }
  return token
}

export async function requestMagicLink(email: string): Promise<MagicLinkRequestResponse> {
  return request<MagicLinkRequestResponse>('/v1/auth/magic-link/request', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

export async function verifyMagicLink(token: string): Promise<AccessTokenResponse> {
  return request<AccessTokenResponse>('/v1/auth/magic-link/verify', {
    method: 'POST',
    body: JSON.stringify({ token }),
  })
}

export async function createFirm(name: string, accessToken: string): Promise<FirmResponse> {
  return request<FirmResponse>(
    '/v1/firms',
    {
      method: 'POST',
      body: JSON.stringify({ name }),
    },
    accessToken
  )
}

export async function createClient(
  payload: {
    firm_id: string
    name: string
    country_pack: CountryPack
    base_currency: CurrencyCode
  },
  accessToken: string
): Promise<ClientResponse> {
  return request<ClientResponse>(
    '/v1/clients',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    accessToken
  )
}

export async function createRun(
  clientId: string,
  payload: {
    pay_period_start: string
    pay_period_end: string
    pay_date: string
    currency: CurrencyCode
    country_pack: CountryPack
  },
  accessToken: string
): Promise<RunResponse> {
  return request<RunResponse>(
    `/v1/clients/${clientId}/runs`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    accessToken
  )
}

export async function getRun(runId: string, accessToken: string): Promise<RunResponse> {
  return request<RunResponse>(`/v1/runs/${runId}`, {}, accessToken)
}

export async function uploadSourceFile(
  runId: string,
  sourceType: SourceFileType,
  file: File,
  accessToken: string
): Promise<SourceFileResponse> {
  const body = new FormData()
  body.set('source_type', sourceType)
  body.set('file', file)

  return request<SourceFileResponse>(
    `/v1/runs/${runId}/source-files`,
    {
      method: 'POST',
      body,
    },
    accessToken
  )
}

export async function detectSchema(fileId: string, accessToken: string): Promise<DetectSchemaResponse> {
  return request<DetectSchemaResponse>(
    `/v1/source-files/${fileId}/detect-schema`,
    {
      method: 'POST',
      body: JSON.stringify({}),
    },
    accessToken
  )
}

export async function mapColumns(
  fileId: string,
  accessToken: string,
  mapping?: Record<string, unknown>,
  schemaType?: string
): Promise<MapColumnsResponse> {
  return request<MapColumnsResponse>(
    `/v1/source-files/${fileId}/map-columns`,
    {
      method: 'POST',
      body: JSON.stringify({ mapping, schema_type: schemaType }),
    },
    accessToken
  )
}

export async function validateSourceFile(fileId: string, accessToken: string): Promise<ValidateResponse> {
  return request<ValidateResponse>(
    `/v1/source-files/${fileId}/validate`,
    {
      method: 'POST',
      body: JSON.stringify({}),
    },
    accessToken
  )
}

export async function reconcileRun(runId: string, accessToken: string): Promise<ReconcileResponse> {
  return request<ReconcileResponse>(
    `/v1/runs/${runId}/reconcile`,
    {
      method: 'POST',
      body: JSON.stringify({}),
    },
    accessToken
  )
}

export async function getRunSummary(runId: string, accessToken: string): Promise<RunSummaryResponse> {
  return request<RunSummaryResponse>(`/v1/runs/${runId}/summary`, {}, accessToken)
}

export async function listVariances(runId: string, accessToken: string): Promise<VarianceResponse[]> {
  return request<VarianceResponse[]>(`/v1/runs/${runId}/variances`, {}, accessToken)
}

export async function resolveVariance(
  varianceId: string,
  payload: {
    status: VarianceStatus
    note?: string
    explanation?: string
  },
  accessToken: string,
  allowIgnorePolicy = false
): Promise<VarianceResponse> {
  const suffix = allowIgnorePolicy ? '?allow_ignore_policy=true' : ''
  return request<VarianceResponse>(
    `/v1/variances/${varianceId}/resolve${suffix}`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    accessToken
  )
}

export async function approveVariance(
  varianceId: string,
  note: string | undefined,
  accessToken: string
): Promise<VarianceResponse> {
  return request<VarianceResponse>(
    `/v1/variances/${varianceId}/approve`,
    {
      method: 'POST',
      body: JSON.stringify({ note }),
    },
    accessToken
  )
}

export async function submitRunForReview(runId: string, note: string, accessToken: string): Promise<RunResponse> {
  return request<RunResponse>(
    `/v1/runs/${runId}/submit-for-review`,
    {
      method: 'POST',
      body: JSON.stringify({ note }),
    },
    accessToken
  )
}

export async function approveRun(runId: string, note: string, accessToken: string): Promise<RunResponse> {
  return request<RunResponse>(
    `/v1/runs/${runId}/approve`,
    {
      method: 'POST',
      body: JSON.stringify({ note }),
    },
    accessToken
  )
}

export async function createExportPack(runId: string, accessToken: string): Promise<ExportPackResponse> {
  return request<ExportPackResponse>(
    `/v1/runs/${runId}/export-pack`,
    {
      method: 'POST',
      body: JSON.stringify({}),
    },
    accessToken
  )
}

export async function getExportPack(runId: string, packId: string, accessToken: string): Promise<ExportPackDownloadResponse> {
  return request<ExportPackDownloadResponse>(`/v1/runs/${runId}/export-pack/${packId}`, {}, accessToken)
}
