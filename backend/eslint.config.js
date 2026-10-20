import js from '@eslint/js';
export default [js.configs.recommended, { languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: { process: 'readonly', console: 'readonly', Buffer: 'readonly', URL: 'readonly', setTimeout: 'readonly' } }, rules: { 'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }] }, ignores: ['coverage/**'] }];
