import { redirect } from 'next/navigation'

export default function LegacyNewRunPage() {
  redirect('/app/workflow?step=scope')
}
