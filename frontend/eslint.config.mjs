import nextConfig from 'eslint-config-next'

const config = [
  ...nextConfig,
  {
    ignores: ['.next/**', 'out/**', 'node_modules/**'],
  },
  {
    files: ['src/components/catalyst/**/*.{ts,tsx}'],
    rules: {
      '@next/next/no-img-element': 'off',
    },
  },
]

export default config
