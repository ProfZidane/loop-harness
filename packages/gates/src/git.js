import { execFileSync } from 'node:child_process';

const HUNK_FILE = /^\+\+\+ b\/(.+)$/;
const HUNK_START = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/;
const RECORD_SEPARATOR = '\u001e';
const MAX_OUTPUT_BYTES = 64 * 1024 * 1024;

export const git = (args, cwd = process.cwd()) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: MAX_OUTPUT_BYTES });

const parseDiffLine = (state, line) => {
  const file = HUNK_FILE.exec(line);
  if (file) return { ...state, file: file[1] };
  const hunk = HUNK_START.exec(line);
  if (hunk) return { ...state, next: Number(hunk[1]) };
  if (line.startsWith('+') && !line.startsWith('+++')) {
    const added = { file: state.file, line: state.next, text: line.slice(1) };
    return { ...state, next: state.next + 1, added: [...state.added, added] };
  }
  return line.startsWith('-') ? state : { ...state, next: state.next + 1 };
};

export const parseAddedLines = (diff) =>
  diff.split('\n').reduce(parseDiffLine, { file: '', next: 0, added: [] }).added;

export const addedLines = ({ range, staged, cwd }) => {
  const target = staged ? ['--cached'] : [range];
  return parseAddedLines(git(['diff', '--unified=0', '--no-color', '--no-ext-diff', ...target], cwd));
};

export const commitMessages = ({ range, cwd }) =>
  git(['log', '--no-merges', `--format=%H%n%B${RECORD_SEPARATOR}`, range], cwd)
    .split(RECORD_SEPARATOR)
    .map((record) => record.trim())
    .filter((record) => record.length > 0)
    .map((record) => {
      const [sha, ...body] = record.split('\n');
      return { sha, message: body.join('\n').trim() };
    });
