import { redirect } from 'next/navigation'

export default function LegacyImportPage() {
  redirect('/app/workflow?step=imports')
}
