import {
  ArrowDownTrayIcon,
  BuildingOffice2Icon,
  ChartBarSquareIcon,
  ClipboardDocumentListIcon,
  DocumentCheckIcon,
  ExclamationTriangleIcon,
  InboxStackIcon,
} from '@heroicons/react/20/solid'

export const appNavigation = [
  { name: 'Dashboard', href: '/app', icon: ChartBarSquareIcon },
  { name: 'Firm Setup', href: '/app/setup', icon: BuildingOffice2Icon },
  { name: 'New Run', href: '/app/new-run', icon: ClipboardDocumentListIcon },
  { name: 'Import Mapping', href: '/app/import', icon: InboxStackIcon },
  { name: 'Reconciliation', href: '/app/reconciliation', icon: DocumentCheckIcon },
  { name: 'Variances', href: '/app/variances', icon: ExclamationTriangleIcon },
  { name: 'Review', href: '/app/review', icon: DocumentCheckIcon },
  { name: 'Export Packs', href: '/app/exports', icon: ArrowDownTrayIcon },
]
