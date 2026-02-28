export const kpis = [
  { label: 'Runs Closed <24h', value: '78%', note: '+8pp this cycle' },
  { label: 'Median Reconcile Time', value: '8m 42s', note: 'target <10m' },
  { label: 'Import Success Rate', value: '84%', note: 'partner baseline' },
  { label: 'False Variance Rate', value: '3.1%', note: 'target <=5%' },
]

export const varianceSamples = [
  {
    code: 'BNK-001',
    type: 'Missing net pay withdrawal(s)',
    severity: 'BLOCKER',
    amount: '£12,998.00',
    status: 'Open',
    action: 'Check bank export date range and staged payment policy.',
  },
  {
    code: 'TIME-001',
    type: 'Liability payment expected later',
    severity: 'INFO',
    amount: '£3,245.20',
    status: 'ExpectedLater',
    action: 'Auto-classified to due date window (UK HMRC schedule).',
  },
  {
    code: 'GL-003',
    type: 'Journal totals mismatch vs payroll expected',
    severity: 'BLOCKER',
    amount: '£74.10',
    status: 'Explained',
    action: 'Mapping updated; awaiting reviewer approval.',
  },
]

export const uploadSteps = [
  'Upload',
  'Schema Detection',
  'Column Mapping',
  'Transformations',
  'Validation',
  'Template Save',
]
