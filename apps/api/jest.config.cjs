/** @type {import('jest').Config} */
module.exports = {
  rootDir: 'src',
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: { module: 'CommonJS', moduleResolution: 'Node' } }],
  },
  // Le client Prisma généré est écrit en ESM et importé avec l'extension
  // `.js` (convention NodeNext) alors que les fichiers sont des `.ts` :
  // ts-jest/CommonJS ne résout pas ça nativement, d'où ce mapping.
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
