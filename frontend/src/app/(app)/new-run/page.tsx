import { Button, Description, Field, FieldGroup, Fieldset, Heading, Input, Label, Select, Text } from '@/components/ui'

export default function NewRunPage() {
  return (
    <div className="space-y-8">
      <section>
        <Heading className="text-2xl">Create payroll run</Heading>
        <Text className="mt-2 text-zinc-600">Define pay period metadata before uploading files.</Text>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs">
        <Fieldset>
          <FieldGroup>
            <Field>
              <Label>Client</Label>
              <Select defaultValue="northgate-ltd">
                <option value="northgate-ltd">Northgate Ltd</option>
                <option value="wilton-holdings">Wilton Holdings</option>
              </Select>
            </Field>
            <Field>
              <Label>Pay period start</Label>
              <Input type="date" defaultValue="2026-01-01" />
            </Field>
            <Field>
              <Label>Pay period end</Label>
              <Input type="date" defaultValue="2026-01-31" />
            </Field>
            <Field>
              <Label>Pay date</Label>
              <Input type="date" defaultValue="2026-01-31" />
            </Field>
            <Field>
              <Label>Currency</Label>
              <Select defaultValue="GBP">
                <option value="GBP">GBP</option>
                <option value="EUR">EUR</option>
              </Select>
              <Description>Single-run currency is enforced unless explicit FX mode is enabled.</Description>
            </Field>
          </FieldGroup>
        </Fieldset>
        <div className="mt-6 flex gap-3">
          <Button color="dark/zinc" href="/app/import">
            Create and continue
          </Button>
          <Button outline href="/app">
            Save draft
          </Button>
        </div>
      </section>
    </div>
  )
}
