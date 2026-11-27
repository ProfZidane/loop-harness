// Reads and edits the subset of YAML used by .loop/config.yml:
// nested maps with 2-space indentation, scalars, inline lists and "- item" block lists.

const KEY_LINE = /^(\s*)([A-Za-z][\w-]*):(\s*)(.*)$/;
const ITEM_LINE = /^\s*-\s+(.*)$/;

const COMMENT = /(^|\s+)#.*$/;

const stripComment = (value) => value.replace(COMMENT, '').trim();

const unquote = (value) => value.replace(/^(['"])(.*)\1$/, '$2');

const parseValue = (raw) => {
  const value = stripComment(raw);
  if (value.startsWith('[')) {
    return value.slice(1, -1).split(',').map((item) => unquote(item.trim())).filter((item) => item.length > 0);
  }
  return value === 'null' ? null : unquote(value);
};

const indexKeys = (lines) =>
  lines.reduce(
    (state, line, index) => {
      const match = KEY_LINE.exec(line);
      if (!match) return state;
      const indent = match[1].length;
      const parents = state.stack.filter((entry) => entry.indent < indent);
      const path = [...parents.map((entry) => entry.key), match[2]].join('.');
      return { stack: [...parents, { indent, key: match[2] }], keys: [...state.keys, { path, index, match }] };
    },
    { stack: [], keys: [] },
  ).keys;

const blockItems = (lines, from) => {
  const rest = lines.slice(from + 1);
  const end = rest.findIndex((line) => line.trim().length > 0 && !ITEM_LINE.test(line));
  return (end === -1 ? rest : rest.slice(0, end))
    .map((line) => ITEM_LINE.exec(line))
    .filter(Boolean)
    .map((item) => unquote(stripComment(item[1])));
};

export const getValue = (text, path) => {
  const lines = text.split('\n');
  const entry = indexKeys(lines).find((key) => key.path === path);
  if (!entry) return undefined;
  const raw = entry.match[4];
  return stripComment(raw) === '' ? blockItems(lines, entry.index) : parseValue(raw);
};

const formatValue = (value) => {
  if (Array.isArray(value)) return `[${value.join(', ')}]`;
  if (value === null) return 'null';
  const text = String(value);
  return /^[\w./@~-]*$/.test(text) && text !== '' ? text : JSON.stringify(text);
};

export const setValue = (text, path, value) => {
  const lines = text.split('\n');
  const entry = indexKeys(lines).find((key) => key.path === path);
  if (!entry) throw new Error(`Unknown config key: ${path}`);
  const [, indent, key, , raw] = entry.match;
  const comment = COMMENT.exec(raw)?.[0].trim() ?? '';
  const updated = `${indent}${key}: ${formatValue(value)}${comment ? `   ${comment}` : ''}`;
  return [...lines.slice(0, entry.index), updated, ...lines.slice(entry.index + 1)].join('\n');
};
