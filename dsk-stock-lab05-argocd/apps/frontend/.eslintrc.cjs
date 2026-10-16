module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true,
  },
  extends: ['eslint:recommended', 'plugin:react/recommended', 'plugin:@typescript-eslint/recommended'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  plugins: ['react', '@typescript-eslint', 'react-refresh'],
  // rules: {
  //   'react-refresh/only-export-components': 'warn',
  //   'react/react-in-jsx-scope': 'off',
  //   '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
  // },

  rules: {
  'react-refresh/only-export-components': 'off', // (ou 'warn' si tu préfères)
  'react/react-in-jsx-scope': 'off',

  // ✅ TS + React: pas besoin de prop-types
  'react/prop-types': 'off',

  // ✅ évite l’erreur sur apostrophes dans JSX (tu peux le laisser ON et corriger les lignes)
  'react/no-unescaped-entities': 'off',

  // ✅ on garde ton warning TS
  '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],

  // ✅ pour ton "any": si tu veux vraiment bloquer, laisse en error.
  // Si tu veux avancer vite, mets en warn.
  '@typescript-eslint/no-explicit-any': 'warn',
},

  settings: {
    react: {
      version: 'detect',
    },
  },
  
  
};
