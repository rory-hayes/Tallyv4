import { Badge, Button, Heading, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Text } from '@/components/ui'
import { formatGBP } from '@/lib/format'

const summaryRows = [
  { source: 'Payroll expected', total: 12998.0 },
  { source: 'Bank actual', total: 12998.0 },
  { source: 'GL posted', total: 13072.1 },
]

export default function ReconciliationPage() {
  return (
    <div className="space-y-8">
      <section className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Heading className="text-2xl">Run reconciliation summary</Heading>
          <Text className="mt-2 text-zinc-600">Status is deterministic and driven by unresolved blocker variances.</Text>
        </div>
        <Badge color="red">Not Tied</Badge>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>Dataset</TableHeader>
              <TableHeader>Total</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {summaryRows.map((row) => (
              <TableRow key={row.source}>
                <TableCell>{row.source}</TableCell>
                <TableCell className="tabular-nums">{formatGBP(row.total)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4">
          <Text className="text-sm text-amber-900">Variance delta: {formatGBP(74.1)}. Reviewer action required before close.</Text>
        </div>

        <div className="mt-6 flex gap-3">
          <Button color="dark/zinc" href="/app/variances">
            Resolve variances
          </Button>
          <Button outline href="/app/review">
            Submit for review
          </Button>
        </div>
      </section>
    </div>
  )
}
