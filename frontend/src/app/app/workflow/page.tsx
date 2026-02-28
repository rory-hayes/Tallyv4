import { redirect } from 'next/navigation'

export default function WorkflowRedirectPage() {
  redirect('/app?newRun=1')
}
