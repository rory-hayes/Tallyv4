import { Button, Description, Field, FieldGroup, Fieldset, Heading, Input, Label, Legend, Select, Text } from '@/components/ui'

export default function SetupPage() {
  return (
    <div className="space-y-8">
      <section>
        <Heading className="text-2xl">Firm setup</Heading>
        <Text className="mt-2 text-zinc-600">Provision workspace, roles, and first client in under three minutes.</Text>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs">
        <Fieldset>
          <Legend>Workspace details</Legend>
          <FieldGroup>
            <Field>
              <Label>Firm name</Label>
              <Input name="firm_name" defaultValue="Northgate Payroll Bureau" />
            </Field>
            <Field>
              <Label>Default country pack</Label>
              <Select name="country_pack" defaultValue="UK">
                <option value="UK">UK</option>
                <option value="IE">Ireland</option>
              </Select>
              <Description>Country pack controls liability schedule defaults and expected-later logic.</Description>
            </Field>
            <Field>
              <Label>Base currency</Label>
              <Select name="base_currency" defaultValue="GBP">
                <option value="GBP">GBP</option>
                <option value="EUR">EUR</option>
              </Select>
            </Field>
          </FieldGroup>
        </Fieldset>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs">
        <Fieldset>
          <Legend>Invite team member</Legend>
          <FieldGroup>
            <Field>
              <Label>Email</Label>
              <Input name="email" type="email" placeholder="reviewer@firm.co.uk" />
            </Field>
            <Field>
              <Label>Role</Label>
              <Select name="role" defaultValue="Reviewer">
                <option>Admin</option>
                <option>Preparer</option>
                <option>Reviewer</option>
              </Select>
            </Field>
          </FieldGroup>
        </Fieldset>
        <div className="mt-6 flex gap-3">
          <Button color="dark/zinc">Save workspace</Button>
          <Button outline href="/app/new-run">
            Continue to first run
          </Button>
        </div>
      </section>
    </div>
  )
}
