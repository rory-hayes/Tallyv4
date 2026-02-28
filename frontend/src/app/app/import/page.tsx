import { CheckCircleIcon, ExclamationTriangleIcon, InformationCircleIcon } from '@heroicons/react/20/solid'

import {
  Badge,
  Button,
  Divider,
  Field,
  FieldGroup,
  Heading,
  Input,
  Label,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
} from '@/components/ui'
import { uploadSteps } from '@/lib/mock-data'

const mappingRows = [
  { canonical: 'posting_date', source: 'Transaction Date', confidence: 0.99, required: true },
  { canonical: 'amount', source: 'Money Out - Money In', confidence: 0.94, required: true },
  { canonical: 'description', source: 'Narrative', confidence: 0.96, required: true },
  { canonical: 'reference', source: 'Reference', confidence: 0.88, required: false },
]

export default function ImportPage() {
  return (
    <div className="space-y-8">
      <section>
        <Heading className="text-2xl">Import mapping workflow</Heading>
        <Text className="mt-2 text-zinc-600">Confidence-gated schema and field mapping with no silent guesses.</Text>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs">
        <div className="flex flex-wrap gap-2">
          {uploadSteps.map((step, index) => (
            <Badge key={step} color={index < 3 ? 'zinc' : 'indigo'}>
              {index + 1}. {step}
            </Badge>
          ))}
        </div>

        <Divider className="my-6" />

        <FieldGroup>
          <Field>
            <Label>Dataset type</Label>
            <Select defaultValue="Bank">
              <option>Bank</option>
              <option>GL</option>
              <option>Payroll</option>
            </Select>
          </Field>
          <Field>
            <Label>Upload file</Label>
            <Input type="file" />
          </Field>
        </FieldGroup>

        <div className="mt-6 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
          <Text className="flex items-center gap-2 text-sm">
            <InformationCircleIcon className="h-4 w-4 text-zinc-600" />
            Schema confidence 0.88: user confirmation required before continuing.
          </Text>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs">
        <Heading className="text-lg">Column mapping preview</Heading>
        <Table className="mt-4">
          <TableHead>
            <TableRow>
              <TableHeader>Canonical field</TableHeader>
              <TableHeader>Source column</TableHeader>
              <TableHeader>Confidence</TableHeader>
              <TableHeader>State</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {mappingRows.map((row) => {
              const blocked = row.required && row.confidence < 0.9
              return (
                <TableRow key={row.canonical}>
                  <TableCell className="font-medium">{row.canonical}</TableCell>
                  <TableCell>{row.source}</TableCell>
                  <TableCell className="tabular-nums">{(row.confidence * 100).toFixed(0)}%</TableCell>
                  <TableCell>
                    {blocked ? (
                      <span className="inline-flex items-center gap-1 text-sm text-red-700">
                        <ExclamationTriangleIcon className="h-4 w-4" />
                        Blocked
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-sm text-zinc-700">
                        <CheckCircleIcon className="h-4 w-4" />
                        Ready
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
        <div className="mt-6 flex gap-3">
          <Button color="dark/zinc" href="/app/reconciliation">
            Validate and continue
          </Button>
          <Button outline>Save template</Button>
        </div>
      </section>
    </div>
  )
}
