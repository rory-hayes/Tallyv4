import { redirect } from 'next/navigation'

export default function LegacyExportsPage() {
  redirect('/app/workflow?step=export')
}
