import { ArrowDownTrayIcon, DocumentTextIcon } from '@heroicons/react/20/solid'

import { Badge, Button, Heading, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Text } from '@/components/ui'

const packs = [
  {
    run: 'Northgate Ltd · Jan 2026',
    status: 'Approved',
    checksum: '53f4c6876a87b1b2...ef9a',
    generatedAt: '2026-02-01 12:04',
  },
  {
    run: 'Wilton Holdings · Jan 2026',
    status: 'Approved',
    checksum: '1f9dc2e9e77e1bd2...78b1',
    generatedAt: '2026-02-01 10:12',
  },
]

export default function ExportsPage() {
  return (
    <div className="space-y-8">
      <section className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Heading className="text-2xl">Audit pack exports</Heading>
          <Text className="mt-2 text-zinc-600">Each pack includes PDF summary, CSV variances, and evidence log with source hashes.</Text>
        </div>
        <Button color="dark/zinc">
          <ArrowDownTrayIcon data-slot="icon" />
          Generate pack
        </Button>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>Run</TableHeader>
              <TableHeader>Status</TableHeader>
              <TableHeader>Checksum</TableHeader>
              <TableHeader>Generated at</TableHeader>
              <TableHeader>Download</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {packs.map((pack) => (
              <TableRow key={pack.checksum}>
                <TableCell>{pack.run}</TableCell>
                <TableCell>
                  <Badge color="zinc">{pack.status}</Badge>
                </TableCell>
                <TableCell className="tabular-nums text-xs">{pack.checksum}</TableCell>
                <TableCell className="tabular-nums">{pack.generatedAt}</TableCell>
                <TableCell>
                  <Button plain href="#">
                    <DocumentTextIcon data-slot="icon" />
                    Download
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
    </div>
  )
}
