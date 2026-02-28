import {
  ArrowRightIcon,
  BanknotesIcon,
  CheckCircleIcon,
  ClockIcon,
  DocumentCheckIcon,
  ExclamationTriangleIcon,
  FingerPrintIcon,
  LockClosedIcon,
  ShieldCheckIcon,
  TableCellsIcon,
} from '@heroicons/react/20/solid'

import { Badge, Button, Divider, Heading, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Text } from '@/components/ui'

const supportedFormats = [
  ['Payroll', 'CSV, XLSX'],
  ['Bank', 'CSV, XLSX, OFX, QFX, QIF'],
  ['GL', 'CSV, XLSX'],
]

const topMetrics = [
  { label: 'Median reconciliation time', value: '<10 min', trend: 'from ~45-60 min' },
  { label: 'Deterministic variance catalog', value: '40 codes', trend: 'no AI tie decisions' },
  { label: 'Beta scope', value: 'UK + IE', trend: 'country schedule defaults' },
]

const workflowSteps = [
  'Define run scope and pay period',
  'Upload payroll, bank, and GL exports',
  'Pass confidence and validation gates',
  'Run deterministic reconciliation',
  'Resolve blocker variances with notes',
  'Approve run and export evidence pack',
]

export default function MarketingPage() {
  return (
    <div className="relative overflow-hidden bg-zinc-50">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_15%,rgba(15,23,42,0.06),transparent_38%),radial-gradient(circle_at_88%_5%,rgba(2,132,199,0.08),transparent_30%),linear-gradient(to_bottom,rgba(255,255,255,0.95),rgba(244,244,245,0.9))]" />
      <section className="relative mx-auto max-w-6xl px-6 pt-18 pb-16 sm:pt-24">
        <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
          <div>
            <Badge color="zinc">UK + Ireland private beta</Badge>
            <Heading className="mt-6 max-w-3xl text-4xl font-semibold tracking-tight text-zinc-950 sm:text-6xl">
              Payroll reconciliation teams can close with evidence, not spreadsheets.
            </Heading>
            <Text className="mt-6 max-w-2xl text-base text-zinc-600 sm:text-lg">
              Tally reconciles payroll expected, bank cash movement, and GL journals with deterministic rules. Every
              variance is categorized, explained, and reviewable.
            </Text>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button href="/app" color="dark/zinc">
                Open product
                <ArrowRightIcon data-slot="icon" />
              </Button>
              <Button href="/app?newRun=1" outline>
                Start new run
              </Button>
            </div>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {topMetrics.map((metric) => (
                <article key={metric.label} className="rounded-xl border border-zinc-200 bg-white/85 p-4 shadow-xs backdrop-blur-sm">
                  <Text className="text-xs font-medium uppercase tracking-wide text-zinc-500">{metric.label}</Text>
                  <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-950">{metric.value}</p>
                  <Text className="mt-1 text-xs text-zinc-600">{metric.trend}</Text>
                </article>
              ))}
            </div>
          </div>

          <div className="relative rounded-2xl border border-zinc-200 bg-white p-5 shadow-lg shadow-zinc-300/30">
            <div className="absolute inset-x-5 -top-3 h-7 rounded-full bg-gradient-to-r from-zinc-900/10 via-cyan-500/15 to-zinc-900/10 blur-xl" />
            <div className="relative space-y-4">
              <div className="flex items-center justify-between">
                <Text className="text-sm font-semibold text-zinc-900">Run close board</Text>
                <Badge color="green">Deterministic</Badge>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                  <Text className="text-xs text-zinc-500">Payroll total</Text>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-zinc-900">£93,412.77</p>
                </div>
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                  <Text className="text-xs text-zinc-500">Bank total</Text>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-zinc-900">£93,412.77</p>
                </div>
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                  <Text className="text-xs text-zinc-500">GL total</Text>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-zinc-900">£93,412.77</p>
                </div>
              </div>
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                <div className="flex items-center justify-between">
                  <Text className="text-xs text-zinc-500">Variance center</Text>
                  <Badge color="amber">1 warning</Badge>
                </div>
                <div className="mt-2 flex items-center justify-between rounded-md border border-zinc-200 bg-white px-2 py-1.5">
                  <Text className="text-xs font-medium text-zinc-800">TIME-001 Liability expected later</Text>
                  <Text className="text-xs tabular-nums text-zinc-600">£12,188.00</Text>
                </div>
              </div>
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                <Text className="text-xs text-zinc-500">Approval trail</Text>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge color="zinc">Preparer: complete</Badge>
                  <Badge color="zinc">Reviewer: approved</Badge>
                  <Badge color="green">Pack: generated</Badge>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative mx-auto max-w-6xl px-6 pb-10">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Heading className="text-xl">How one run closes</Heading>
            <Badge color="zinc">Gated wizard flow</Badge>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {workflowSteps.map((step, index) => (
              <div key={step} className="flex items-start gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-zinc-300 bg-white text-xs font-semibold tabular-nums text-zinc-700">
                  {index + 1}
                </span>
                <Text className="text-sm text-zinc-700">{step}</Text>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative mx-auto grid max-w-6xl gap-4 px-6 pb-6 lg:grid-cols-3">
        <article className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs">
          <ShieldCheckIcon className="h-5 w-5 text-zinc-700" />
          <Heading className="mt-3 text-lg">Deterministic engine</Heading>
          <Text className="mt-2 text-sm text-zinc-600">
            Tie-outs and status are rule driven. AI may assist mapping and narratives but never approves reconciliation.
          </Text>
        </article>
        <article className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs">
          <TableCellsIcon className="h-5 w-5 text-zinc-700" />
          <Heading className="mt-3 text-lg">Import confidence gates</Heading>
          <Text className="mt-2 text-sm text-zinc-600">
            Low-confidence schema or mapping is blocked. Parse failures over 1% cannot proceed.
          </Text>
        </article>
        <article className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs">
          <FingerPrintIcon className="h-5 w-5 text-zinc-700" />
          <Heading className="mt-3 text-lg">Immutable audit evidence</Heading>
          <Text className="mt-2 text-sm text-zinc-600">
            Source file hashes, approvals, rules, and manual actions are captured for reproducible close packs.
          </Text>
        </article>
      </section>

      <section className="relative mx-auto max-w-6xl px-6 pb-20">
        <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs">
            <Heading>Supported formats (MVP)</Heading>
            <Text className="mt-2 text-sm text-zinc-600">We support the formats below now. Additional templates are added weekly during beta.</Text>
            <Divider className="my-5" />
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeader>Source</TableHeader>
                  <TableHeader>Supported containers</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {supportedFormats.map(([source, formats]) => (
                  <TableRow key={source}>
                    <TableCell>{source}</TableCell>
                    <TableCell className="tabular-nums">{formats}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="mt-6 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <Text className="flex items-center gap-2 text-sm font-medium text-zinc-800">
                <CheckCircleIcon className="h-4 w-4 text-zinc-700" />
                Trust policy: low-confidence mappings cannot proceed without user confirmation.
              </Text>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs">
              <Text className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
                <ClockIcon className="h-4 w-4 text-zinc-700" />
                Operational targets
              </Text>
              <div className="mt-3 space-y-3 text-sm text-zinc-700">
                <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
                  <span>24h close velocity</span>
                  <span className="font-semibold tabular-nums">North-star</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
                  <span>False variance rate</span>
                  <span className="font-semibold tabular-nums">&le;5%</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
                  <span>Import success on partner files</span>
                  <span className="font-semibold tabular-nums">&ge;80%</span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs">
              <Text className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
                <DocumentCheckIcon className="h-4 w-4 text-zinc-700" />
                Compliance positioning
              </Text>
              <Text className="mt-2 text-sm text-zinc-600">
                Tally is reconciliation and evidence software. It is not payroll execution or tax filing software.
              </Text>
              <div className="mt-3 space-y-2">
                <Text className="flex items-center gap-2 text-sm text-zinc-700">
                  <CheckCircleIcon className="h-4 w-4 text-green-700" />
                  Country schedule packs to reduce false “missing” flags
                </Text>
                <Text className="flex items-center gap-2 text-sm text-zinc-700">
                  <LockClosedIcon className="h-4 w-4 text-zinc-700" />
                  RBAC and evidence logging per run
                </Text>
                <Text className="flex items-center gap-2 text-sm text-zinc-700">
                  <ExclamationTriangleIcon className="h-4 w-4 text-amber-600" />
                  Manual confirmation required on low-confidence imports
                </Text>
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-zinc-900 p-5 text-zinc-100 shadow-xs">
              <Text className="flex items-center gap-2 text-sm font-semibold text-white">
                <BanknotesIcon className="h-4 w-4 text-zinc-200" />
                Built for payroll bureaus
              </Text>
              <Text className="mt-2 text-sm text-zinc-300">
                Improve margin by reducing manual checks and reruns while giving reviewers cleaner audit packs.
              </Text>
              <div className="mt-4">
                <Button href="/app?newRun=1" color="light">
                  Start guided run
                  <ArrowRightIcon data-slot="icon" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
