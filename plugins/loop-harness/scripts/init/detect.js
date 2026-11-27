import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const SKIPPED_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.venv', 'venv', '.dart_tool', 'coverage']);
const TEST_FILE = /(\.(test|spec)\.[cm]?[jt]sx?$)|(^test_.*\.py$)|(_test\.(py|dart)$)/;

const NPM_STACKS = {
  '@angular/core': 'angular',
  express: 'express',
  vue: 'vue',
  mongoose: 'mongo',
  mongodb: 'mongo',
  pg: 'postgres',
  '@prisma/client': 'postgres',
  '@ionic/angular': 'ionic',
  '@capacitor/core': 'ionic',
};

const PYTHON_STACKS = { fastapi: 'fastapi', psycopg: 'postgres', asyncpg: 'postgres', pymongo: 'mongo', motor: 'mongo' };

const readText = (dir, file) => (existsSync(join(dir, file)) ? readFileSync(join(dir, file), 'utf8') : '');

const npmDependencies = (dir) => {
  const text = readText(dir, 'package.json');
  if (!text) return [];
  const pkg = JSON.parse(text);
  return Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
};

const pythonText = (dir) => ['pyproject.toml', 'requirements.txt'].map((file) => readText(dir, file)).join('\n');

const detectLanguages = (dir, deps) => {
  const checks = {
    typescript: () => existsSync(join(dir, 'tsconfig.json')) || deps.includes('typescript'),
    javascript: () => deps.length > 0 && !deps.includes('typescript') && !existsSync(join(dir, 'tsconfig.json')),
    python: () => pythonText(dir).trim().length > 0,
    dart: () => existsSync(join(dir, 'pubspec.yaml')),
  };
  return Object.keys(checks).filter((language) => checks[language]());
};

const detectStacks = (dir, deps) => {
  const fromNpm = deps.filter((dep) => dep in NPM_STACKS).map((dep) => NPM_STACKS[dep]);
  const python = pythonText(dir).toLowerCase();
  const fromPython = Object.keys(PYTHON_STACKS).filter((pkg) => python.includes(pkg)).map((pkg) => PYTHON_STACKS[pkg]);
  const fromDart = readText(dir, 'pubspec.yaml').includes('flutter') ? ['flutter'] : [];
  return [...new Set([...fromNpm, ...fromPython, ...fromDart])].sort();
};

const hasTests = (dir) =>
  readdirSync(dir, { withFileTypes: true }).some((entry) =>
    entry.isDirectory()
      ? !SKIPPED_DIRS.has(entry.name) && hasTests(join(dir, entry.name))
      : TEST_FILE.test(entry.name),
  );

export const detect = (dir) => {
  const deps = npmDependencies(dir);
  return {
    languages: detectLanguages(dir, deps),
    stacks: detectStacks(dir, deps),
    hasTests: hasTests(dir),
    hasCi: existsSync(join(dir, '.github', 'workflows')),
    hasLoopConfig: existsSync(join(dir, '.loop', 'config.yml')),
  };
};
