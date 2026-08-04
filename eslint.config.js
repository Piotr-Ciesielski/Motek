const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  {
    ignores: [
      '**/node_modules/**',
      '**/.worktrees/**',
      '**/build/**',
      '**/dist/**',
      '**/coverage/**',
      '**/tmp/**',
      '**/__pycache__/**',
    ],
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      // Existing modules intentionally expose a few compatibility globals.
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // These assignments preserve readable control flow in legacy handlers.
      'no-useless-assignment': 'off',
      // Error wrapping predates the Error.cause convention used by this rule.
      'preserve-caught-error': 'off',
    },
  },
];
