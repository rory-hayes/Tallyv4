import { redirect } from 'next/navigation'

export default function LegacyVariancesPage() {
  redirect('/app/workflow?step=variances')
}
