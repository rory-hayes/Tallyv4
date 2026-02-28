import { redirect } from 'next/navigation'

export default function LegacyReviewPage() {
  redirect('/app/workflow?step=review')
}
