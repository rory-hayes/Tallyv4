import { CheckCircleIcon, ClockIcon, ExclamationTriangleIcon } from '@heroicons/react/20/solid'

import { Badge, Button, Heading, Text } from '@/components/ui'
import { kpis, varianceSamples } from '@/lib/mock-data'

export default function AppDashboardPage() {
  return (
    <div className="space-y-10">
      <section>
        <Heading className="text-3xl">Operations overview</Heading>
        <Text className="mt-2 text-zinc-600">Deterministic close metrics across UK and Ireland payroll clients.</Text>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <article key={kpi.label} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs">
            <Text className="text-xs font-medium uppercase tracking-wide text-zinc-500">{kpi.label}</Text>
            <p className="mt-3 tabular-nums text-2xl font-semibold text-zinc-950">{kpi.value}</p>
            <Text className="mt-2 text-sm text-zinc-600">{kpi.note}</Text>
          </article>
        ))}
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs">
        <div className="flex items-center justify-between">
          <Heading className="text-xl">Current review queue</Heading>
          <Button href="/app/variances" outline>
            Open variance center
          </Button>
        </div>
        <div className="mt-5 space-y-3">
          {varianceSamples.map((item) => (
            <div key={item.code} className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
              <Badge color={item.severity === 'BLOCKER' ? 'red' : item.severity === 'WARNING' ? 'amber' : 'zinc'}>
                {item.code}
              </Badge>
              <Text className="font-medium text-zinc-900">{item.type}</Text>
              <Text className="tabular-nums text-zinc-600">{item.amount}</Text>
              <Text className="text-zinc-500">{item.status}</Text>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs">
          <CheckCircleIcon className="h-5 w-5 text-zinc-700" />
          <Heading className="mt-3 text-lg">Tied runs</Heading>
          <Text className="mt-2 text-sm text-zinc-600">24 runs tied without manual matching this month.</Text>
        </article>
        <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs">
          <ClockIcon className="h-5 w-5 text-zinc-700" />
          <Heading className="mt-3 text-lg">Expected later</Heading>
          <Text className="mt-2 text-sm text-zinc-600">7 liabilities tracked to statutory due windows.</Text>
        </article>
        <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs">
          <ExclamationTriangleIcon className="h-5 w-5 text-zinc-700" />
          <Heading className="mt-3 text-lg">Blockers open</Heading>
          <Text className="mt-2 text-sm text-zinc-600">2 blockers require reviewer decision before close.</Text>
        </article>
      </section>
    </div>
  )
}
