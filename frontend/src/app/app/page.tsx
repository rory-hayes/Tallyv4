import { ArrowRightIcon, CheckCircleIcon, ClipboardDocumentListIcon, ShieldCheckIcon } from '@heroicons/react/20/solid'

import { Badge, Button, Heading, Text } from '@/components/ui'

const journeySteps = [
  'Authenticate and define run scope',
  'Upload payroll, bank, and GL files',
  'Validate mapping and parsing with hard blockers',
  'Run deterministic reconciliation',
  'Resolve and approve blocker variances',
  'Submit, approve, and export audit pack',
]

export default function AppDashboardPage() {
  return (
    <div className="space-y-10">
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs">
        <Badge color="zinc">Trust-first workflow</Badge>
        <Heading className="mt-4 text-3xl">Run payroll reconciliation through one guided journey</Heading>
        <Text className="mt-3 max-w-3xl text-zinc-600">
          This workflow mirrors real bureau operations: scope the run, gather evidence, reconcile deterministically,
          clear exceptions, and close with reviewer approval and an export pack.
        </Text>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button href="/app/workflow" color="dark/zinc">
            Start guided run
            <ArrowRightIcon data-slot="icon" />
          </Button>
          <Button href="/app/setup" outline>
            Configure firm workspace
          </Button>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs">
          <ClipboardDocumentListIcon className="h-5 w-5 text-zinc-700" />
          <Heading className="mt-3 text-lg">One place per run</Heading>
          <Text className="mt-2 text-sm text-zinc-600">
            Users complete the run top-to-bottom in one workspace instead of jumping across disconnected tabs.
          </Text>
        </article>
        <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs">
          <ShieldCheckIcon className="h-5 w-5 text-zinc-700" />
          <Heading className="mt-3 text-lg">Deterministic decisions</Heading>
          <Text className="mt-2 text-sm text-zinc-600">
            Reconciliation status and variance outcomes are rules-based. Low-confidence inputs are explicitly blocked.
          </Text>
        </article>
        <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs">
          <CheckCircleIcon className="h-5 w-5 text-zinc-700" />
          <Heading className="mt-3 text-lg">Close-ready output</Heading>
          <Text className="mt-2 text-sm text-zinc-600">
            Reviewer approval and export generation happen at the end of the same guided journey.
          </Text>
        </article>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs">
        <Heading className="text-xl">Manual reconciliation mirrored in-product</Heading>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {journeySteps.map((step, index) => (
            <div key={step} className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
              <Text className="text-sm font-medium text-zinc-900">
                {index + 1}. {step}
              </Text>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
