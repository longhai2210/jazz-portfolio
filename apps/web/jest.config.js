/** @type {import('jest').Config} */
const config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          // Override settings incompatible with ts-jest
          module: 'commonjs',
          moduleResolution: 'node',
          esModuleInterop: true,
          resolveJsonModule: true,
          strict: true,
          skipLibCheck: true,
        },
      },
    ],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: ['**/*.pbt.test.ts', '**/*.pbt.test.tsx', '**/*.test.ts', '**/*.test.tsx'],
};

module.exports = config;
