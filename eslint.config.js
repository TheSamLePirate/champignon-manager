import js from '@eslint/js';
import tseslint from 'typescript-eslint';

/**
 * Règles ESLint du dépôt.
 *
 * Deux familles de règles portent des décisions du cadrage :
 *
 * 1. `no-restricted-syntax` interdit `.skip`, `.only` et les exclusions de
 *    couverture. Sans ça, « 100 % de couverture » devient une métrique vanité
 *    (docs/22 §2.3).
 * 2. `no-restricted-imports` sur `packages/domain` garantit que le cœur reste
 *    pur : aucune I/O, aucune horloge, aucun aléatoire (docs/22 §2.1). C'est ce
 *    qui rend le 100 % atteignable.
 */
export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/reports/**',
      '**/.stryker-tmp/**',
      'docs/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        // Les fichiers de configuration racine ne font partie d'aucun projet
        // TypeScript composite ; on les rattache explicitement pour qu'ils
        // soient tout de même vérifiés.
        projectService: {
          allowDefaultProject: ['*.config.ts', '*.config.js', '*.config.mjs'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      // Le préfixe `_` marque un retrait volontaire (déstructuration qui écarte
      // un champ). C'est la seule échappatoire tolérée, et elle est visible.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      '@typescript-eslint/no-unnecessary-condition': 'error',
      'no-console': 'error',
      eqeqeq: ['error', 'always'],
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'MemberExpression[property.name=/^(only|skip)$/][object.name=/^(describe|it|test|suite|bench)$/]',
          message:
            'Interdit : un test désactivé ou isolé fausse la couverture. Corrige-le ou supprime-le.',
        },
      ],
    },
  },
  {
    // Le cœur du domaine doit rester pur : ni I/O, ni horloge, ni aléatoire.
    // Le temps et les identifiants sont injectés par la coquille impérative.
    files: ['packages/domain/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'node:*',
                'fs',
                'path',
                'crypto',
                'http',
                'https',
                'net',
                'mongodb',
                'hono',
                '@champi/persistence',
                '@champi/api',
              ],
              message:
                'packages/domain doit rester pur (docs/22 §2.1) : aucune I/O, aucune dépendance à un adaptateur.',
            },
          ],
        },
      ],
      // On vise l'impureté réelle — lire l'horloge ambiante — et non le type
      // `Date` lui-même : `Date.parse(isoInjecté)` est une fonction pure.
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: 'Injecte un générateur plutôt que Math.random().',
        },
        {
          object: 'Date',
          property: 'now',
          message: 'Injecte l’instant courant en paramètre plutôt que de lire Date.now().',
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'MemberExpression[property.name=/^(only|skip)$/][object.name=/^(describe|it|test|suite|bench)$/]',
          message:
            'Interdit : un test désactivé ou isolé fausse la couverture. Corrige-le ou supprime-le.',
        },
        {
          selector: 'NewExpression[callee.name="Date"][arguments.length=0]',
          message:
            'Injecte l’instant courant en paramètre plutôt que de construire `new Date()` dans le domaine.',
        },
      ],
    },
  },
  {
    files: ['**/*.test.ts', '**/__testing__/**/*.ts', '**/__fixtures__/**/*.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      'no-restricted-properties': 'off',
    },
  },
  {
    // Les fichiers de configuration racine n'appartiennent à aucun projet
    // TypeScript composite. Les règles typées ne peuvent donc pas s'y appliquer :
    // on les désactive plutôt que de fabriquer un projet artificiel pour trois
    // fichiers sans logique métier.
    files: ['*.config.ts', '*.config.js', '*.config.mjs'],
    extends: [tseslint.configs.disableTypeChecked],
    rules: { 'no-restricted-syntax': 'off' },
  },
);
