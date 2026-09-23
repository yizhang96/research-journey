import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { cell += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { row.push(cell); cell = ''; }
    else if (char === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (char !== '\r') cell += char;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const headers = rows.shift();
  return rows.filter((item) => item.length === headers.length).map((item) => Object.fromEntries(headers.map((header, index) => [header, item[index]])));
}

const safeSummary = {
  E10: 'Changes in task format and in what participants could consciously report helped identify where the proposed learning process did and did not generalize.',
  N05: 'This idea proposed that people use the density of a social network to infer what the group considers normal. Those inferred norms may then shape how strongly people identify with the group.',
  N12: 'Different measures of network position did not tell the same story, reopening the question of what centrality actually captures about a person’s social standing.',
  N13: 'The project asks how being seen as representative of a group relates to identification, perceived fit, social position, and wellbeing.',
  N14: 'The project treats prototypicality—being seen as representative of the group—as a network property distinct from friendship and ordinary popularity.',
  M05: 'The data did not support the proposed causal mechanism, so the project broadened into a theory of how relationship needs shape moral thought and behavior.',
  M15: 'An unexpected pattern in conversation data required more cautious claims and a clearer separation between what people did and the psychological mechanisms that might explain it.'
};

const nodeDetail = {
  E01: ['Can another person’s outcomes acquire value through experience?', 'This seed turned empathy from a stable trait into a learnable relation between observer, target, and outcome.'],
  E02: ['Could a basic associative mechanism explain changes in empathic response?', 'The initial question became an experimental program with explicit learning predictions.'],
  E03: ['How can learning, felt empathy, and later choice be separated?', 'A staged paradigm made it possible to distinguish acquisition, evaluation, and action.'],
  E04: ['What is represented when learning generalizes beyond a specific cue?', 'The project moved from asking whether learning occurs to asking what kind of mental representation is learned.'],
  E05: ['Is the mechanism best described as associative or evaluative learning?', 'Clarifying the mechanism tightened the claim without abandoning the larger learning framework.'],
  E06: ['Does learned value transfer from ratings into prosocial choice?', 'A transfer task tested whether the acquired representation could guide a new action.'],
  E07: ['Is the model learning a person’s state—or merely the positivity of a stimulus?', 'This construct challenge forced the project to separate person-specific mental states from general valence.'],
  E08: ['Can preferences provide a tractable representation of another person’s welfare?', 'Person-specific utility offered a more precise bridge between abstract mental states and observable choices.'],
  E09: ['How does the value of another person’s welfare become learned?', 'Several studies converged on a manuscript-level contribution about the acquisition of social value.'],
  E10: ['Where does generalization stop?', 'Boundary conditions became part of the theory, not merely caveats around it.'],
  E11: ['What is the strongest account the full program can support?', 'Peer review consolidated the evidence while making boundary conditions part of the final account.'],
  E12: ['What did the completed program establish?', 'Publication made the learning account and its evidence accessible as a single, durable contribution.'],
  N15: ['How can the experimental and naturalistic findings form one manuscript?', 'The submission cycle joined network generalization, relational value, and real-world evidence into a coherent argument.'],
  N16: ['What does the completed network program contribute?', 'Publication established network ties as a basis for generalizing rejection and acceptance to new people.']
};

const publicUrls = {
  E12: 'https://doi.org/10.1177/09567976251351304',
  N16: 'https://doi.org/10.1016/j.jesp.2025.104834'
};

const landmarks = new Set(['E11', 'E12', 'N15', 'N16', 'M09']);

const afterlifeSummaries = {
  E07: 'This shift led to a more precise account of how people learn another person’s preferences and welfare, and it clarified what the later studies needed to distinguish.',
  E10: 'The transfers that did not work helped define the limits of the claim. Those limits became part of the final published account rather than being discarded as failed studies.',
  N05: 'Limited support for the original density account redirected the project toward several other routes to belonging, including interpersonal ties, peer-recognized group prototypes, and group identity.',
  N12: 'The mismatch among measures of centrality led to a longer program separating friendship position, group prototypicality, identification, and wellbeing.',
  M05: 'The unsupported causal account led to a broader theory of how relationships shape moral thought, followed by new surveys, interventions, and conversation studies.',
  M06: 'This shift opened a longer research program on how people regulate disagreement, moving from conceptual questions to measurement, interventions, and live conversations.',
  M14: 'Focusing on observable behavior made the evidence easier to evaluate, but it also exposed unanswered questions about the goals and mechanisms behind those behaviors.',
  M15: 'Narrowing the claims did not end the project. It reopened the question of which goals arise during disagreement and how those goals shape behavior.',
  M16: 'This is the newest direction shown on the map, so its later influence is not yet known.',
  C01: 'This branch was not developed further in the period shown on the map.',
  H02: 'This proposed direction is currently paused, and the public map does not yet document a later continuation.'
};

const overviewEdges = new Set([
  'X00:X01', 'X01:E01', 'X01:N01', 'X01:M01',
  'E01:E02', 'E02:E04', 'E02:E05', 'E05:E06', 'E04:E07', 'E07:E08',
  'E06:E09', 'E08:E09', 'E07:E10', 'E10:E11', 'E09:E11', 'E11:E12',
  'N01:N03', 'N03:N04', 'N04:N11', 'N11:N15', 'N15:N16',
  'N02:N05', 'N05:N08', 'N08:N10', 'N07:N10', 'N07:N12', 'N12:N13', 'N10:N13', 'N13:N14',
  'M01:M02', 'M02:M03', 'M03:M04', 'M04:M05', 'M05:M06', 'M06:M07',
  'M07:M09', 'M08:M09', 'M09:M10', 'M09:M11', 'M10:M13', 'M13:M14', 'M14:M15', 'M15:M16',
  'N02:H01', 'M03:H01', 'H01:H03', 'N08:H02', 'E04:H02'
]);

const kindByStage = {
  seed: 'question', operationalization: 'attempt', refinement: 'reframing', pivot: 'pivot',
  reframing: 'reframing', synthesis: 'integration', data_friction: 'setback', revival: 'revival',
  merge: 'integration', side_branch: 'attempt'
};

const relationLabels = {
  spawned: 'opened a new branch', refined: 'refined', operationalized: 'became a research attempt',
  reframed: 'was reframed as', synthesized: 'was integrated into', merged: 'merged with',
  constrained: 'was bounded by', method_transfer: 'provided a method for', revived: 'reappeared as',
  pivoted_due_to_data: 'data prompted a change in direction', pivoted_due_to_construct: 'a problem with the construct changed the direction',
  pivoted_due_to_measurement: 'prompted a change in measurement', conceptual_continuity: 'continued in',
  extended: 'extended into', side_branch: 'opened a side branch', future_program_expression: 'continued in',
  identity_integration: 'integrated into', published: 'became a publication'
};

const [rawNodes, rawEdges, existingPublicText] = await Promise.all([
  readFile(resolve(root, 'deliverables/idea_nodes.csv'), 'utf8'),
  readFile(resolve(root, 'deliverables/idea_edges.csv'), 'utf8'),
  readFile(resolve(root, 'src/data/genealogy.json'), 'utf8')
]);
const existingPublic = JSON.parse(existingPublicText);
const existingNodes = new Map(existingPublic.nodes.map((node) => [node.id, node]));
const existingEdges = new Map(existingPublic.edges.map((edge) => [`${edge.source}:${edge.target}`, edge]));

const omitted = new Set(['R01']);
const nodes = parseCsv(rawNodes)
  .filter((node) => !omitted.has(node.id))
  .map((node) => {
    const curated = existingNodes.get(node.id);
    return {
      id: node.id,
      title: curated?.title || node.label,
      thread: node.track,
      date: node.date,
      endDate: node.end_date || undefined,
      kind: node.status === 'published' ? 'publication' : (kindByStage[node.stage] || 'event'),
      status: node.status,
      summary: curated?.summary || safeSummary[node.id] || node.summary,
      question: curated?.question || nodeDetail[node.id]?.[0],
      significance: curated?.significance || nodeDetail[node.id]?.[1],
      url: curated?.url || publicUrls[node.id],
      landmark: curated?.landmark ?? (landmarks.has(node.id) || undefined),
      afterlifeSummary: curated?.afterlifeSummary || afterlifeSummaries[node.id]
    };
  });

const nodeIds = new Set(nodes.map((node) => node.id));
const edges = parseCsv(rawEdges)
  .filter((edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to))
  .map((edge) => {
    const curated = existingEdges.get(`${edge.from}:${edge.to}`);
    return {
      source: edge.from,
      target: edge.to,
      relation: edge.relation,
      label: curated?.label || relationLabels[edge.relation] || edge.relation.replaceAll('_', ' '),
      date: edge.date,
      overview: curated?.overview ?? (overviewEdges.has(`${edge.from}:${edge.to}`) || undefined)
    };
  });

const publicData = {
  meta: {
    title: 'The Life of Research Ideas',
    subtitle: 'An interactive map, 2020–2026',
    description: 'Research rarely moves in a straight line. This map shows the questions I pursued, the studies they became, where they stalled, and how earlier ideas returned in later work. Choose a research area or select any event to see what led to it and what came next.',
    startYear: 2020,
    endYear: 2026,
    updated: '2026-09-21'
  },
  threads: [
    { id: 'empathy', label: 'Empathy & social value', shortLabel: 'Empathy', color: '#2f6f9f', order: 0 },
    { id: 'network', label: 'Networks & belonging', shortLabel: 'Networks', color: '#3f7d5a', order: 1 },
    { id: 'morality', label: 'Moral disagreement', shortLabel: 'Morality', color: '#b15f3e', order: 2 },
    { id: 'hybrid', label: 'Integrations', shortLabel: 'Hybrid', color: '#715aa6', order: 3 },
    { id: 'cross', label: 'Cross-cutting questions', shortLabel: 'Cross', color: '#68747c', order: 4 },
    { id: 'meta', label: 'Research formation', shortLabel: 'Meta', color: '#a0782a', order: 5 }
  ],
  nodes,
  edges
};

const output = resolve(root, 'src/data/genealogy.json');
await mkdir(dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(publicData, null, 2) + '\n');
console.log(`Curated ${nodes.length} public nodes and ${edges.length} public edges.`);
