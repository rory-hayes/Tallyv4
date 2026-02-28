import '@/styles/tailwind.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: {
    default: 'Tally',
    template: '%s | Tally',
  },
  description: 'Deterministic payroll reconciliation and audit-ready close packs for UK and Ireland payroll bureaus.',
  icons: {
    icon: '/logo.ico',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="bg-zinc-50 text-zinc-950 antialiased">
      <head>
        <link rel="preconnect" href="https://rsms.me/" />
        <link rel="stylesheet" href="https://rsms.me/inter/inter.css" />
      </head>
      <body>{children}</body>
    </html>
  )
}
