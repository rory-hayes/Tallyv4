import { BuildingOffice2Icon, ShieldCheckIcon, UserGroupIcon } from '@heroicons/react/20/solid'

import { Button, Heading, Text } from '@/components/ui'

export default function SetupPage() {
  return (
    <div className="space-y-8">
      <section>
        <Heading className="text-2xl">Firm setup</Heading>
        <Text className="mt-2 text-zinc-600">
          During private beta, workspace provisioning is handled inside the guided run so preparers can start immediately
          without extra navigation.
        </Text>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs">
          <BuildingOffice2Icon className="h-5 w-5 text-zinc-700" />
          <Heading className="mt-3 text-lg">Firm and client context</Heading>
          <Text className="mt-2 text-sm text-zinc-600">
            The guided workflow creates firm, client, and run context in one deterministic sequence.
          </Text>
        </article>

        <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs">
          <UserGroupIcon className="h-5 w-5 text-zinc-700" />
          <Heading className="mt-3 text-lg">Role controls</Heading>
          <Text className="mt-2 text-sm text-zinc-600">
            Run approval still enforces reviewer/admin permissions through backend role checks.
          </Text>
        </article>

        <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs">
          <ShieldCheckIcon className="h-5 w-5 text-zinc-700" />
          <Heading className="mt-3 text-lg">Trust-first import gates</Heading>
          <Text className="mt-2 text-sm text-zinc-600">
            Required mapping confidence and parse thresholds block progression before reconciliation.
          </Text>
        </article>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs">
        <Heading className="text-lg">Recommended next step</Heading>
        <Text className="mt-2 text-zinc-600">
          Start in the guided run workspace to complete setup, import, reconciliation, variance handling, approval, and
          export in one journey.
        </Text>
        <div className="mt-5">
          <Button href="/app/workflow" color="dark/zinc">
            Open guided run workspace
          </Button>
        </div>
      </section>
    </div>
  )
}
