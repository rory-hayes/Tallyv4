import {
  ArrowRightIcon,
  CheckCircleIcon,
  ClipboardDocumentListIcon,
  LockClosedIcon,
  ShieldCheckIcon,
} from '@heroicons/react/20/solid'

import { Badge, Button, Divider, Heading, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Text } from '@/components/ui'

const supportedFormats = [
  ['Payroll', 'CSV, XLSX'],
  ['Bank', 'CSV, XLSX, OFX, QFX, QIF'],
  ['GL', 'CSV, XLSX'],
]

export default function MarketingPage() {
  return (
    <div className="bg-gradient-to-b from-zinc-100 via-white to-zinc-50">
      <section className="mx-auto max-w-6xl px-6 pt-20 pb-16 sm:pt-28">
        <Badge color="zinc">UK + Ireland private beta</Badge>
        <Heading className="mt-6 max-w-3xl text-4xl font-semibold tracking-tight text-zinc-950 sm:text-6xl">
          Deterministic payroll reconciliation for bureaus that need audit-grade trust.
        </Heading>
        <Text className="mt-6 max-w-2xl text-base text-zinc-600 sm:text-lg">
          Upload payroll, bank, and GL exports. Tally ties what can be proven, flags what cannot, and records every
          action for review and close.
        </Text>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button href="/app" color="dark/zinc">
            Open product
            <ArrowRightIcon data-slot="icon" />
          </Button>
          <Button href="/app/workflow" outline>
            View guided run
          </Button>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-10">
        <div className="grid gap-4 sm:grid-cols-3">
          <article className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs">
            <ShieldCheckIcon className="h-5 w-5 text-zinc-700" />
            <Heading className="mt-3 text-lg">Deterministic Engine</Heading>
            <Text className="mt-2 text-sm text-zinc-600">No AI tie decisions. Every match and variance is rules-based and explainable.</Text>
          </article>
          <article className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs">
            <ClipboardDocumentListIcon className="h-5 w-5 text-zinc-700" />
            <Heading className="mt-3 text-lg">Variance Taxonomy</Heading>
            <Text className="mt-2 text-sm text-zinc-600">40 explicit variance codes with blocker/warning/info control and audit trace.</Text>
          </article>
          <article className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs">
            <LockClosedIcon className="h-5 w-5 text-zinc-700" />
            <Heading className="mt-3 text-lg">Reviewer Controls</Heading>
            <Text className="mt-2 text-sm text-zinc-600">Preparer and reviewer workflow with immutable evidence logs and approvals.</Text>
          </article>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
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
      </section>
    </div>
  )
}
