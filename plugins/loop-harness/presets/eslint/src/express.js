import importX, { createNodeResolver } from 'eslint-plugin-import-x';
import { typescript } from './typescript.js';

const layer = (name) => `./src/${name}`;

export const express = [
  ...typescript,
  {
    files: ['**/*.ts'],
    plugins: { 'import-x': importX },
    settings: { 'import-x/resolver-next': [createNodeResolver({ extensions: ['.ts', '.js'] })] },
    rules: {
      'import-x/no-restricted-paths': ['error', {
        zones: [
          { target: layer('routes'), from: [layer('repositories'), layer('models'), layer('services')],
            message: 'Routes wire middlewares and controllers only.' },
          { target: layer('controllers'), from: [layer('repositories'), layer('models')],
            message: 'Controllers talk to services only.' },
          { target: layer('services'), from: [layer('controllers'), layer('routes')],
            message: 'Services do not depend on the HTTP layer.' },
          { target: layer('repositories'), from: [layer('services'), layer('controllers'), layer('routes')],
            message: 'Repositories depend on models only.' },
        ],
      }],
    },
  },
  {
    files: ['src/routes/**/*.ts', 'src/controllers/**/*.ts', 'src/services/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: [{ name: 'mongoose', message: 'Only repositories and models talk to mongoose.' }],
      }],
    },
  },
];
