import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const dataPath = resolve(root, 'src/data/genealogy.json');
const dataText = await readFile(dataPath, 'utf8');
const data = JSON.parse(dataText);

const allowedTopLevelFields = new Set(['meta', 'threads', 'nodes', 'edges']);
const allowedMetaFields = new Set(['title', 'subtitle', 'description', 'startYear', 'endYear', 'updated']);
const allowedThreadFields = new Set(['id', 'label', 'shortLabel', 'color', 'order']);
const allowedNodeFields = new Set(['id', 'title', 'thread', 'date', 'endDate', 'kind', 'status', 'summary', 'question', 'significance', 'url', 'landmark', 'afterlifeSummary']);
const allowedEdgeFields = new Set(['source', 'target', 'relation', 'label', 'date', 'overview']);
const forbiddenFields = [
  'evidence', 'evidence_dates', 'opening_snippet', 'source_file', 'source_type',
  'source_line_start', 'source_line_end', 'line_start', 'line_end', 'confidence',
  'word_count', 'milestone_tags_auto', 'speaker', 'advisor', 'collaborator', 'quote', 'quotation'
];
const serializedKeys = new Set();
JSON.parse(dataText, (key, value) => { if (key) serializedKeys.add(key); return value; });
const leakedFields = forbiddenFields.filter((field) => serializedKeys.has(field));
if (leakedFields.length) throw new Error(`Public data includes forbidden source fields: ${leakedFields.join(', ')}`);

const assertAllowedFields = (value, allowed, context) => {
  const unexpected = Object.keys(value).filter((key) => !allowed.has(key));
  if (unexpected.length) throw new Error(`${context} includes fields outside the public schema: ${unexpected.join(', ')}`);
};

assertAllowedFields(data, allowedTopLevelFields, 'Public data');
assertAllowedFields(data.meta, allowedMetaFields, 'Public metadata');

const privateValuePatterns = [
  { label: 'email address', pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i },
  { label: 'absolute user path', pattern: /(?:\/Users\/|[A-Z]:\\Users\\)/i },
  { label: 'raw notes path', pattern: /research_meeting_notes|meeting_index\.csv|analysis_report\.md|idea_(?:nodes|edges)\.csv/i },
  { label: 'Notion export identifier', pattern: /\b[0-9a-f]{32}\b/i }
];
const publicText = JSON.stringify(data);
for (const { label, pattern } of privateValuePatterns) {
  if (pattern.test(publicText)) throw new Error(`Public data appears to contain a ${label}.`);
}

if (!Array.isArray(data.nodes) || !Array.isArray(data.edges) || !Array.isArray(data.threads)) throw new Error('Public data must contain nodes, edges, and threads arrays.');
for (const thread of data.threads) assertAllowedFields(thread, allowedThreadFields, `Thread ${thread.id || '(unknown)'}`);
const ids = new Set();
for (const node of data.nodes) {
  assertAllowedFields(node, allowedNodeFields, `Node ${node.id || '(unknown)'}`);
  for (const required of ['id', 'title', 'thread', 'date', 'kind', 'status', 'summary']) {
    if (node[required] === undefined || node[required] === '') throw new Error(`Node ${node.id || '(unknown)'} is missing ${required}.`);
  }
  if (ids.has(node.id)) throw new Error(`Duplicate public node id: ${node.id}`);
  ids.add(node.id);
}
for (const edge of data.edges) {
  assertAllowedFields(edge, allowedEdgeFields, `Edge ${edge.source || '(unknown)'} → ${edge.target || '(unknown)'}`);
  if (!ids.has(edge.source) || !ids.has(edge.target)) throw new Error(`Edge ${edge.source} → ${edge.target} references a missing public node.`);
}

const privateNames = ['research_meeting_notes', 'meeting_index.csv', 'analysis_report.md', 'idea_nodes.csv', 'idea_edges.csv'];
const buildScript = await readFile(resolve(root, 'scripts/build.mjs'), 'utf8');
for (const name of privateNames) {
  if (buildScript.includes(name)) throw new Error(`Build script references private artifact: ${name}`);
}

const sourceFiles = await readdir(resolve(root, 'src'));
if (sourceFiles.some((name) => privateNames.includes(name))) throw new Error('Private artifact found inside src/.');

console.log(`Validated public boundary: ${data.nodes.length} nodes, ${data.edges.length} edges, no source-evidence fields.`);
