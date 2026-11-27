#!/usr/bin/env node
// Renders a C4 diagram from a JSON spec into an SVG in the loop-harness house style.
// Usage: node diagram.mjs <spec.json> <out.svg>
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const FONT = 'Inter, Segoe UI, Helvetica, Arial, sans-serif';
const INK = '#0f172a';
const MUTED = '#64748b';
const LINE = '#475569';
const HEADER_HEIGHT = 70;
const MARGIN = 30;

const KINDS = {
  person: { fill: '#1e3a8a', sub: '#dbeafe', width: 130, height: 110, tag: 'Person' },
  system: { fill: '#1d4ed8', sub: '#dbeafe', width: 200, height: 110, tag: 'Software system' },
  container: { fill: '#2563eb', sub: '#dbeafe', width: 200, height: 110, tag: 'Container' },
  component: { fill: '#3b82f6', sub: '#eff6ff', width: 200, height: 100, tag: 'Component' },
  database: { fill: '#0f766e', sub: '#ccfbf1', width: 180, height: 110, tag: 'Database' },
  external: { fill: '#64748b', sub: '#f1f5f9', width: 180, height: 100, tag: 'External system' },
};

const ICONS = {
  person: '<circle cx="10" cy="6" r="4"/><path d="M2,19 C2,13 18,13 18,19"/>',
  system: '<rect x="1" y="3" width="18" height="14" rx="2"/><line x1="1" y1="7" x2="19" y2="7"/>',
  container: '<rect x="1" y="3" width="18" height="14" rx="2"/><path d="M6,10 l-3,2 l3,2 M14,10 l3,2 l-3,2"/>',
  component: '<rect x="4" y="2" width="14" height="16" rx="1"/><rect x="1" y="5" width="6" height="3"/><rect x="1" y="12" width="6" height="3"/>',
  database: '<ellipse cx="10" cy="4" rx="8" ry="3"/><path d="M2,4 V16 C2,18 18,18 18,16 V4 M2,10 C2,12 18,12 18,10"/>',
  external: '<path d="M5,17 C1,17 0,13 3,11 C3,6 9,5 11,8 C13,4 19,6 18,11 C21,12 21,17 17,17 Z"/>',
};

const escape = (text) => String(text ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const box = (node) => {
  const kind = KINDS[node.kind];
  if (!kind) throw new Error(`Unknown kind "${node.kind}" for node "${node.id}"`);
  return { ...node, ...kind, width: node.width ?? kind.width, height: node.height ?? kind.height };
};

const center = (n) => ({ x: n.x + n.width / 2, y: n.y + n.height / 2 });

const edgePoint = (n, dx, dy) => {
  const c = center(n);
  const scale = Math.min((n.width / 2) / Math.abs(dx || 1e-9), (n.height / 2) / Math.abs(dy || 1e-9));
  return { x: c.x + dx * scale, y: c.y + dy * scale };
};

const renderNode = (n) => [
  `<g filter="url(#sh)"><rect x="${n.x}" y="${n.y}" width="${n.width}" height="${n.height}" rx="10" fill="${n.fill}"/></g>`,
  `<g transform="translate(${n.x + 14},${n.y + 14})" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICONS[n.kind]}</g>`,
  `<text x="${n.x + 14}" y="${n.y + 56}" font-size="14" font-weight="700" fill="#fff">${escape(n.title)}</text>`,
  `<text x="${n.x + 14}" y="${n.y + 74}" font-size="11" fill="${n.sub}">[${escape(n.tech ?? n.tag)}]</text>`,
  n.desc ? `<text x="${n.x + 14}" y="${n.y + 91}" font-size="11" fill="${n.sub}">${escape(n.desc)}</text>` : '',
].join('');

const PARALLEL_GAP = 9;

const shift = (point, offset) => ({ x: point.x + offset.x, y: point.y + offset.y });

const parallelOffset = (edge, edges, a, b) => {
  const hasReverse = edges.some((other) => other.from === edge.to && other.to === edge.from);
  if (!hasReverse) return { x: 0, y: 0 };
  const side = edge.from < edge.to ? 1 : -1;
  const [p, q] = side === 1 ? [a, b] : [b, a];
  const length = Math.hypot(q.x - p.x, q.y - p.y) || 1;
  return { x: (-(q.y - p.y) / length) * PARALLEL_GAP * side, y: ((q.x - p.x) / length) * PARALLEL_GAP * side };
};

const renderEdge = (byId, edges) => (edge) => {
  const [from, to] = [byId[edge.from], byId[edge.to]];
  if (!from || !to) throw new Error(`Edge ${edge.from} -> ${edge.to} references an unknown node`);
  const [a, b] = [center(from), center(to)];
  const offset = parallelOffset(edge, edges, a, b);
  const start = shift(edgePoint(from, b.x - a.x, b.y - a.y), offset);
  const end = shift(edgePoint(to, a.x - b.x, a.y - b.y), offset);
  const labelLift = offset.y > 0 ? 16 : -7;
  const mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 + labelLift + 7 };
  const dash = edge.async ? ' stroke-dasharray="5 4"' : '';
  return `<line x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" stroke="${LINE}" stroke-width="1.6"${dash} marker-end="url(#ar)"/>`
    + `<text x="${mid.x}" y="${mid.y - 7}" text-anchor="middle" font-size="10.5" fill="#334155" paint-order="stroke" stroke="#fff" stroke-width="4">${escape(edge.label)}</text>`;
};

const renderBoundary = (b) => b
  ? `<rect x="${b.x}" y="${b.y}" width="${b.width}" height="${b.height}" rx="14" fill="none" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="6 5"/><text x="${b.x + 16}" y="${b.y + 20}" font-size="11" fill="${MUTED}">${escape(b.label)}</text>`
  : '';

const renderLegend = (nodes, height) => {
  const kinds = [...new Set(nodes.map((n) => n.kind))];
  return kinds.map((kind, i) => `<rect x="${MARGIN + i * 150}" y="${height - 32}" width="12" height="12" rx="3" fill="${KINDS[kind].fill}"/><text x="${MARGIN + i * 150 + 18}" y="${height - 22}" font-size="11" fill="${MUTED}">${KINDS[kind].tag}</text>`).join('');
};

const DEFS = '<defs><marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#475569"/></marker><filter id="sh" x="-10%" y="-10%" width="120%" height="140%"><feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#0f172a" flood-opacity="0.14"/></filter></defs>';

export const render = (spec) => {
  const nodes = spec.nodes.map(box).map((n) => ({ ...n, y: n.y + HEADER_HEIGHT }));
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const boundary = spec.boundary && { ...spec.boundary, y: spec.boundary.y + HEADER_HEIGHT };
  const width = Math.max(...nodes.map((n) => n.x + n.width), boundary ? boundary.x + boundary.width : 0) + MARGIN;
  const height = Math.max(...nodes.map((n) => n.y + n.height), boundary ? boundary.y + boundary.height : 0) + MARGIN + 40;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" font-family="${FONT}">`, DEFS,
    `<rect width="${width}" height="${height}" fill="#fff"/>`,
    `<text x="${MARGIN}" y="36" font-size="18" font-weight="700" fill="${INK}">${escape(spec.title)}</text>`,
    `<text x="${MARGIN}" y="56" font-size="12" fill="${MUTED}">${escape(spec.subtitle)}</text>`,
    renderBoundary(boundary), ...(spec.edges ?? []).map(renderEdge(byId, spec.edges ?? [])), ...nodes.map(renderNode),
    renderLegend(nodes, height), '</svg>',
  ].join('\n');
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [specPath, outPath] = process.argv.slice(2);
  writeFileSync(outPath, `${render(JSON.parse(readFileSync(specPath, 'utf8')))}\n`);
}
