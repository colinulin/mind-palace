const swcTransform = ['@swc/jest', {
    jsc: {
        parser: { syntax: 'typescript' },
        target: 'es2024',
    },
    module: { type: 'commonjs' },
}]

export default {
    testEnvironment: 'node',
    transform: {
        '^.+\\.ts$': swcTransform,
    },
    moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
    },
    testMatch: [ '<rootDir>/test/**/*.test.ts' ],
}
