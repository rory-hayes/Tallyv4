import fs from 'node:fs/promises'
import path from 'node:path'

import { expect, test } from '@playwright/test'

async function writeFixtureFiles(dir: string) {
  await fs.mkdir(dir, { recursive: true })
  const payrollPath = path.join(dir, 'payroll_expected.csv')
  const bankPath = path.join(dir, 'bank_transactions.csv')
  const glPath = path.join(dir, 'gl_journal.csv')

  await fs.writeFile(
    payrollPath,
    [
      'pay_date,gross_total,net_pay_total,employer_taxes,employee_taxes,pension,fees,currency',
      '2026-02-28,12000,9300,1500,1200,0,0,GBP',
    ].join('\n')
  )

  await fs.writeFile(
    bankPath,
    [
      'posting_date,amount,description,reference,currency,account_id',
      '2026-02-28,-9000,Payroll batch,BNK-9000,GBP,Main',
    ].join('\n')
  )

  await fs.writeFile(
    glPath,
    [
      'journal_date,account_code,debit,credit,memo,currency',
      '2026-02-28,5000-payroll-expense,12000,0,Payroll gross,GBP',
      '2026-02-28,2100-payroll-liability,0,12000,Payroll accrual,GBP',
    ].join('\n')
  )

  return { payrollPath, bankPath, glPath }
}

test('completes full payroll reconciliation wizard and resumes from dashboard', async ({ page }, testInfo) => {
  test.setTimeout(180_000)

  const fixtures = await writeFixtureFiles(testInfo.outputPath('fixtures'))

  await page.goto('/app?newRun=1')
  await page.evaluate(() => window.localStorage.clear())
  await page.goto('/app?newRun=1')
  await expect(page.getByRole('heading', { name: 'New payroll reconciliation run' })).toBeVisible()

  await page.getByLabel('Work email').fill(`qa+playwright-${Date.now()}@example.com`)
  await page.getByRole('button', { name: 'Request verification code' }).click()
  await page.getByRole('button', { name: 'Verify code' }).click()
  await expect(page.getByText('Authenticated as')).toBeVisible({ timeout: 20_000 })

  await page.getByRole('button', { name: 'Create run context' }).click()
  await expect(page.getByRole('button', { name: 'Next' })).toBeEnabled({ timeout: 30_000 })
  await page.getByRole('button', { name: 'Next' }).click()

  const fileInputs = page.locator('input[type="file"]')
  await fileInputs.nth(0).setInputFiles(fixtures.payrollPath)
  await fileInputs.nth(1).setInputFiles(fixtures.bankPath)
  await fileInputs.nth(2).setInputFiles(fixtures.glPath)
  await page.getByRole('button', { name: 'Process all files' }).click()
  await expect(page.getByText('All files validated')).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: 'Next' }).click()

  await page.getByRole('button', { name: 'Run reconciliation' }).click()
  await expect(page.getByText(/Reconciliation complete/)).toBeVisible({ timeout: 20_000 })
  const dialog = page.getByRole('dialog', { name: 'New payroll reconciliation run' })
  await expect(dialog.getByText('Variance total')).toBeVisible()
  await expect(dialog.getByRole('cell', { name: '£300.00' }).first()).toBeVisible()
  await page.getByRole('button', { name: 'Next' }).click()

  await page.getByRole('button', { name: 'Resolve + approve open' }).click()
  await expect(page.getByText('All open variances were resolved and approved.')).toBeVisible({ timeout: 20_000 })
  await page.getByRole('button', { name: 'Next' }).click()

  await page.getByRole('button', { name: 'Submit for review' }).click()
  await expect(page.getByText('Run submitted for reviewer approval.')).toBeVisible({ timeout: 20_000 })
  await page.getByRole('button', { name: 'Approve run' }).click()
  await expect(page.getByText('Run status: Tied')).toBeVisible({ timeout: 20_000 })
  await page.getByRole('button', { name: 'Next' }).click()

  await page.getByRole('button', { name: 'Generate export pack' }).click()
  await expect(page.getByText('Pack created')).toBeVisible({ timeout: 20_000 })
  await page.getByRole('button', { name: 'Close' }).click()

  await expect(page.getByRole('heading', { name: 'Recent runs' })).toBeVisible()
  await page.getByRole('button', { name: 'Resume' }).first().click()
  await expect(page.getByText(/Loaded run/)).toBeVisible({ timeout: 20_000 })
})
