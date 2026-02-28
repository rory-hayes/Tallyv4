import fs from 'node:fs'
import path from 'node:path'

import { expect, test } from '@playwright/test'

const snapshotDir = path.join(process.cwd(), 'tests', 'visual', 'snapshots')

function ensureDir() {
  if (!fs.existsSync(snapshotDir)) {
    fs.mkdirSync(snapshotDir, { recursive: true })
  }
}

test('capture landing page snapshot', async ({ page }) => {
  ensureDir()
  await page.goto('/')
  await page.setViewportSize({ width: 1440, height: 1080 })
  const filePath = path.join(snapshotDir, 'landing-page.png')
  await page.screenshot({ path: filePath, fullPage: true })
  expect(fs.existsSync(filePath)).toBeTruthy()
})

test('capture guided workflow snapshot', async ({ page }) => {
  ensureDir()
  await page.goto('/app/workflow')
  await page.setViewportSize({ width: 1440, height: 1080 })
  const filePath = path.join(snapshotDir, 'guided-workflow.png')
  await page.screenshot({ path: filePath, fullPage: true })
  expect(fs.existsSync(filePath)).toBeTruthy()
})
