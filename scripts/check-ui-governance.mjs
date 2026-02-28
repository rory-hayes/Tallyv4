import fs from 'node:fs'
import path from 'node:path'

const repoRoot = path.resolve(process.cwd())
const frontendRoot = path.join(repoRoot, 'frontend')
const packageJsonPath = path.join(frontendRoot, 'package.json')

const bannedPackages = [
  '@mui/material',
  '@mui/icons-material',
  'antd',
  '@chakra-ui/react',
  'bootstrap',
  'react-bootstrap',
  '@mantine/core',
  '@radix-ui/themes',
]

const bannedImportPatterns = [
  /from\s+['"]@mui\//,
  /from\s+['"]antd['"]/, 
  /from\s+['"]@chakra-ui\//,
  /from\s+['"]bootstrap['"]/, 
  /from\s+['"]react-bootstrap['"]/, 
  /from\s+['"]@mantine\//,
  /from\s+['"]@radix-ui\//,
]

function fail(message) {
  console.error(`UI governance check failed: ${message}`)
  process.exit(1)
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
}

function walk(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name)
    if (entry.isDirectory()) {
      files.push(...walk(fullPath))
    } else if (entry.isFile() && /\.(tsx?|jsx?)$/.test(entry.name)) {
      files.push(fullPath)
    }
  }
  return files
}

if (!fs.existsSync(packageJsonPath)) {
  fail('frontend/package.json not found')
}

const packageJson = readJson(packageJsonPath)
const dependencySets = [
  packageJson.dependencies || {},
  packageJson.devDependencies || {},
  packageJson.peerDependencies || {},
]

for (const bannedPackage of bannedPackages) {
  const found = dependencySets.some((deps) => Object.prototype.hasOwnProperty.call(deps, bannedPackage))
  if (found) {
    fail(`banned dependency present: ${bannedPackage}`)
  }
}

const sourceRoot = path.join(frontendRoot, 'src')
if (!fs.existsSync(sourceRoot)) {
  fail('frontend/src not found')
}

const sourceFiles = walk(sourceRoot)
for (const sourceFile of sourceFiles) {
  const content = fs.readFileSync(sourceFile, 'utf-8')
  for (const pattern of bannedImportPatterns) {
    if (pattern.test(content)) {
      fail(`banned UI import found in ${path.relative(repoRoot, sourceFile)}: ${pattern}`)
    }
  }
}

console.log('UI governance check passed')
