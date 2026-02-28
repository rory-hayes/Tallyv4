import {
  BuildingOffice2Icon,
  ChartBarSquareIcon,
  ClipboardDocumentListIcon,
} from '@heroicons/react/20/solid'

export const appNavigation = [
  { name: 'Dashboard', href: '/app', icon: ChartBarSquareIcon },
  { name: 'Guided Run', href: '/app?newRun=1', icon: ClipboardDocumentListIcon },
  { name: 'Firm Setup', href: '/app/setup', icon: BuildingOffice2Icon },
]
