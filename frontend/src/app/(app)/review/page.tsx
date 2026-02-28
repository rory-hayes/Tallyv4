import { CheckCircleIcon, ClockIcon } from '@heroicons/react/20/solid'

import { Badge, Button, Heading, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Text } from '@/components/ui'

const approvals = [
  {
    run: 'Northgate Ltd · Jan 2026',
    submittedBy: 'alice@northgate.co.uk',
    submittedAt: '2026-02-01 10:42',
    blockers: 1,
    warnings: 2,
  },
  {
    run: 'Wilton Holdings · Jan 2026',
    submittedBy: 'sam@wilton.ie',
    submittedAt: '2026-02-01 09:18',
    blockers: 0,
    warnings: 1,
  },
]

export default function ReviewPage() {
  return (
    <div className="space-y-8">
      <section className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Heading className="text-2xl">Reviewer approvals</Heading>
          <Text className="mt-2 text-zinc-600">Approvals are required for all manual matches and policy exceptions.</Text>
        </div>
        <Badge color="amber">1 blocker unresolved</Badge>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>Run</TableHeader>
              <TableHeader>Submitted by</TableHeader>
              <TableHeader>Submitted at</TableHeader>
              <TableHeader>Blockers</TableHeader>
              <TableHeader>Warnings</TableHeader>
              <TableHeader>Decision</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {approvals.map((item) => (
              <TableRow key={item.run}>
                <TableCell>{item.run}</TableCell>
                <TableCell>{item.submittedBy}</TableCell>
                <TableCell className="tabular-nums">{item.submittedAt}</TableCell>
                <TableCell className="tabular-nums">{item.blockers}</TableCell>
                <TableCell className="tabular-nums">{item.warnings}</TableCell>
                <TableCell>
                  {item.blockers > 0 ? (
                    <span className="inline-flex items-center gap-1 text-sm text-amber-700">
                      <ClockIcon className="h-4 w-4" />
                      Needs action
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-sm text-zinc-700">
                      <CheckCircleIcon className="h-4 w-4" />
                      Ready to approve
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="mt-6 flex gap-3">
          <Button color="dark/zinc" href="/app/exports">
            Approve selected run
          </Button>
          <Button outline href="/app/variances">
            Return to variances
          </Button>
        </div>
      </section>
    </div>
  )
}
