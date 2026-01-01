import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
        window: 'readonly',
        document: 'readonly',
        localStorage: 'readonly',
        Blob: 'readonly',
        File: 'readonly',
        setTimeout: 'readonly',
        confirm: 'readonly',
        React: 'readonly',
        HTMLDivElement: 'readonly',
        HTMLButtonElement: 'readonly',
        HTMLInputElement: 'readonly',
        HTMLTextAreaElement: 'readonly',
        HTMLParagraphElement: 'readonly',
        HTMLHeadingElement: 'readonly',
      },
    },
    settings: {
      react: {
        version: '18.3',
      },
    },
    rules: {
      'semi': ['error', 'always'],
      'eqeqeq': ['error', 'always'],
      'no-undef': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-constant-condition': 'off',
    },
  },
  {
    ignores: ['dist/', 'node_modules/', '*.d.ts', '*.js'],
  }
);
