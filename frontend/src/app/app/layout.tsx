import { AppShell } from '@/components/app/app-shell'

export default function ApplicationLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>
}
