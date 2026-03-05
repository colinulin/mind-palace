import tsParser from '@typescript-eslint/parser'
import eslint from '@eslint/js'
import tslint from 'typescript-eslint'
import stylistic from '@stylistic/eslint-plugin'

export default [
    { ignores: [ 'dist/*', 'test/*' ] },
    eslint.configs.recommended,
    ...tslint.configs.recommended,
    {
        plugins: {
            '@stylistic': stylistic,
        },
        languageOptions: {
            globals: {
                window: 'readonly',
                document: 'readonly',
                module: 'readonly',
            },
            parser: tsParser,
        },
        rules: {
            'no-console': 'error',
            'quotes': [ 'error', 'single' ],
            'comma-dangle': [ 'error', 'always-multiline' ],
            'semi': [ 'error', 'never' ],
            'max-len': [ 'error', { code: 120 }],
            'keyword-spacing': [ 'error', { before: true, after: true }],
            'object-curly-spacing': [ 'error', 'always' ],
            'array-bracket-spacing': [ 'error', 'always', { objectsInArrays: false, arraysInArrays: false }],
            'space-in-parens': [ 'error', 'never' ],
            'space-before-function-paren': [ 'error', 'always' ],
            'space-infix-ops': [ 'error', { int32Hint: true }],
            'eqeqeq': 'error',
            'prefer-const': 'error',
            'no-unused-vars': 'off',
            '@stylistic/indent': [ 'error', 4 ],
            'no-prototype-builtins': 'off',
            '@stylistic/member-delimiter-style': [ 'error', { multiline: { delimiter: 'none' } }],
            'eol-last': [ 'error', 'always' ],
            '@typescript-eslint/naming-convention': [ 'error', {
                selector: 'interface',
                format: [ 'PascalCase' ],
                custom: {
                    regex: '^I[A-Z][A-Z0-9a-z_]*',
                    match: true,
                },
            }],
            '@typescript-eslint/explicit-module-boundary-types': 'off',
            '@typescript-eslint/no-angle-bracket-type-assertion': 'off',
            '@typescript-eslint/explicit-function-return-type': 'off',
            '@typescript-eslint/explicit-member-accessibility': 'off',
            '@typescript-eslint/no-var-requires': 'off',
            '@typescript-eslint/no-use-before-define': 'off',
            '@typescript-eslint/no-wrapper-object-types': 'error',
            '@typescript-eslint/no-unused-expressions': [ 'error', { 'allowShortCircuit': true }],
        },
    },
]
