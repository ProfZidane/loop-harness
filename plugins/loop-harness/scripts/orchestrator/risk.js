import { matchesAny } from './glob.js';

const ALWAYS_SENSITIVE = ['.loop/**', '.claude/**', '.github/workflows/**', '.githooks/**', '.env*', '**/.env*'];
const DEPENDENCY_FILES = ['package.json', 'pyproject.toml', 'requirements.txt', 'pubspec.yaml'];

const reasonsFromFiles = (files, config) => {
  const sensitivePaths = [...ALWAYS_SENSITIVE, ...(config.sensitivePaths ?? [])];
  const corePaths = config.coreBusinessPaths ?? [];
  return [
    ...files.filter((file) => matchesAny(file, sensitivePaths)).map((file) => `sensitive path: ${file}`),
    ...files.filter((file) => corePaths.length > 0 && matchesAny(file, corePaths)).map((file) => `core business path: ${file}`),
  ];
};

const TRIGGER_REASONS = {
  sensitive: 'planner: sensitive change',
  coreBusiness: 'planner: core business',
  thirdParty: 'planner: third-party integration',
  tradeOff: 'planner: trade-off to settle',
};

const reasonsFromTriggers = (triggers = {}) =>
  Object.keys(TRIGGER_REASONS).filter((key) => triggers[key]).map((key) => TRIGGER_REASONS[key]);

// Plan gate: does the human validate the plan before any code is written?
export const planGate = ({ plan, issue, config }) => {
  const labels = issue.labels ?? [];
  const reasons = [
    ...reasonsFromTriggers(plan.triggers),
    ...reasonsFromFiles(plan.files ?? [], config),
    ...labels.filter((label) => (config.coreBusinessLabels ?? []).includes(label)).map((label) => `label: ${label}`),
  ];
  return { human: reasons.length > 0, reasons: [...new Set(reasons)] };
};

// Merge gate: can the loop merge alone? Risk can only go up: plan reasons are kept.
export const mergeGate = ({ changedFiles, planReasons = [], config, breakingApi = false }) => {
  const reasons = [
    ...planReasons,
    ...reasonsFromFiles(changedFiles, config),
    ...changedFiles.filter((file) => DEPENDENCY_FILES.some((dep) => file.endsWith(dep))).map(() => 'dependency manifest changed'),
    ...(breakingApi ? ['breaking API change'] : []),
    ...(config.autoMerge ? [] : ['auto-merge disabled (phase 1)']),
  ];
  const unique = [...new Set(reasons)];
  return { risk: unique.length > 0 ? 'sensitive' : 'low', reasons: unique };
};
