import { redirect } from 'next/navigation'

export default function LegacyReconciliationPage() {
  redirect('/app/workflow?step=reconcile')
}
