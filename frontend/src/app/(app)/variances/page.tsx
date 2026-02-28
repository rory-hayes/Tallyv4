import { Badge, Button, Heading, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Text } from '@/components/ui'
import { varianceSamples } from '@/lib/mock-data'

export default function VariancesPage() {
  return (
    <div className="space-y-8">
      <section className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Heading className="text-2xl">Variance center</Heading>
          <Text className="mt-2 text-zinc-600">Each variance has a code, deterministic trigger, and explicit resolution path.</Text>
        </div>
        <Button href="/app/review" color="dark/zinc">
          Move to reviewer queue
        </Button>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>Code</TableHeader>
              <TableHeader>Type</TableHeader>
              <TableHeader>Severity</TableHeader>
              <TableHeader>Amount</TableHeader>
              <TableHeader>Status</TableHeader>
              <TableHeader>Next action</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {varianceSamples.map((item) => (
              <TableRow key={item.code}>
                <TableCell className="font-medium">{item.code}</TableCell>
                <TableCell>{item.type}</TableCell>
                <TableCell>
                  <Badge color={item.severity === 'BLOCKER' ? 'red' : item.severity === 'WARNING' ? 'amber' : 'zinc'}>
                    {item.severity}
                  </Badge>
                </TableCell>
                <TableCell className="tabular-nums">{item.amount}</TableCell>
                <TableCell>{item.status}</TableCell>
                <TableCell className="max-w-sm text-sm text-zinc-600">{item.action}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
    </div>
  )
}
