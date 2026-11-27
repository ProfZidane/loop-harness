import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { express, angular } from '../src/index.js';
import { expressCases, angularCases } from './cases.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '.fixtures');

const TSCONFIG = {
  compilerOptions: {
    strict: true, target: 'ES2022', module: 'ES2022', moduleResolution: 'bundler',
    experimentalDecorators: true, skipLibCheck: true, noEmit: true, types: [],
  },
  include: ['src/**/*.ts'],
};

const materialize = (name, cases) => {
  const dir = join(root, name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'tsconfig.json'), JSON.stringify(TSCONFIG));
  cases.forEach(({ file, code }) => {
    mkdirSync(dirname(join(dir, file)), { recursive: true });
    writeFileSync(join(dir, file), code);
  });
  return dir;
};

const suite = (name, preset, cases) => {
  const cwd = materialize(name, cases);
  const eslint = new ESLint({
    cwd,
    overrideConfigFile: true,
    overrideConfig: [...preset, { languageOptions: { parserOptions: { tsconfigRootDir: cwd } } }],
  });
  cases.forEach(({ name: caseName, file, expect }) => {
    test(`${name}: ${caseName}`, async () => {
      process.chdir(cwd);
      const [result] = await eslint.lintFiles([join(cwd, file)]);
      const errors = result.messages.filter((m) => m.severity === 2);
      const ruleIds = [...new Set(errors.map((m) => m.ruleId))].sort();
      const detail = errors.map((m) => `${String(m.ruleId)}: ${m.message}`).join('\n');
      if (expect.length === 0) {
        assert.deepEqual(ruleIds, [], detail);
        return;
      }
      expect.forEach((ruleId) => assert.ok(ruleIds.includes(ruleId), `missing ${ruleId}\n${detail}`));
    });
  });
};

suite('express', express, expressCases);
suite('angular', angular, angularCases);
