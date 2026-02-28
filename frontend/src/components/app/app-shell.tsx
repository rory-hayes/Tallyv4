'use client'

import {
  Bars3Icon,
  PlusCircleIcon,
} from '@heroicons/react/20/solid'
import { usePathname } from 'next/navigation'

import { Avatar } from '@/components/catalyst/avatar'
import {
  Navbar,
  NavbarItem,
  NavbarLabel,
  NavbarSection,
  NavbarSpacer,
} from '@/components/catalyst/navbar'
import {
  Sidebar,
  SidebarBody,
  SidebarFooter,
  SidebarHeader,
  SidebarItem,
  SidebarLabel,
  SidebarSection,
} from '@/components/catalyst/sidebar'
import { Button } from '@/components/ui'
import { SidebarLayout } from '@/components/catalyst/sidebar-layout'
import { appNavigation } from '@/lib/navigation'

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <SidebarLayout
      navbar={
        <Navbar>
          <NavbarSection>
            <NavbarItem href="/app" aria-label="Open dashboard">
              <Bars3Icon />
            </NavbarItem>
            <NavbarItem href="/app">
              <NavbarLabel>Tally</NavbarLabel>
            </NavbarItem>
          </NavbarSection>
          <NavbarSpacer />
          <NavbarSection>
            <NavbarItem href="/app?newRun=1" aria-label="Start new run">
              <PlusCircleIcon />
            </NavbarItem>
            <NavbarItem href="/app/setup">
              <Avatar initials="RP" />
              <NavbarLabel>Reviewer</NavbarLabel>
            </NavbarItem>
          </NavbarSection>
        </Navbar>
      }
      sidebar={
        <Sidebar>
          <SidebarHeader>
            <div className="px-2">
              <p className="text-xs font-semibold tracking-wide text-zinc-500">TALLY</p>
              <p className="text-sm font-semibold text-zinc-950 dark:text-white">Payroll Reconciliation</p>
            </div>
            <div className="px-2 pt-3">
              <Button href="/app?newRun=1" color="dark/zinc" className="w-full justify-center">
                Start New Run
              </Button>
            </div>
          </SidebarHeader>
          <SidebarBody>
            <SidebarSection>
              {appNavigation.map((item) => (
                <SidebarItem key={item.href} href={item.href} current={pathname === item.href}>
                  <item.icon />
                  <SidebarLabel>{item.name}</SidebarLabel>
                </SidebarItem>
              ))}
            </SidebarSection>
          </SidebarBody>
          <SidebarFooter>
            <SidebarSection>
              <SidebarItem href="/">
                <SidebarLabel>Product site</SidebarLabel>
              </SidebarItem>
            </SidebarSection>
          </SidebarFooter>
        </Sidebar>
      }
    >
      {children}
    </SidebarLayout>
  )
}
