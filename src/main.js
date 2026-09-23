const KIND_LABELS = {
  question: 'New research question', attempt: 'Research attempt', reframing: 'Conceptual reframing',
  pivot: 'Pivot', setback: 'Productive setback', revival: 'Revival',
  integration: 'Integration', publication: 'Publication', event: 'Research event'
};
const STATUS_LABELS = {
  active: 'Ongoing', persistent: 'Still shaping later work', dormant: 'Paused',
  completed: 'Completed', published: 'Published'
};
const AFTERLIFE_KINDS = new Set(['pivot', 'setback', 'revival']);

const state = {
  data: null,
  selected: null,
  traceMode: null,
  focusedThread: null,
  enabledThreads: new Set(),
  transform: { x: 0, y: 0, scale: 1 },
  dragging: false,
  dragMoved: false,
  pointer: null
};

const app = document.querySelector('#app');

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}

function wrapLabel(value, maxCharacters = 22, maxLines = 2) {
  const words = String(value).trim().split(/\s+/);
  const lines = [];
  let current = '';
  let overflowed = false;

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxCharacters) {
      current = candidate;
    } else if (lines.length < maxLines - 1) {
      lines.push(current || word.slice(0, maxCharacters));
      current = current ? word : word.slice(maxCharacters);
    } else {
      overflowed = true;
      break;
    }
  }

  if (current && lines.length < maxLines) lines.push(current);
  if (overflowed) {
    const last = lines.length ? lines.length - 1 : 0;
    lines[last] = `${(lines[last] || '').slice(0, maxCharacters - 1).trimEnd()}…`;
  }
  return lines;
}

function icon(name) {
  const icons = {
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    reset: '<path d="M4 12a8 8 0 1 0 2.34-5.66L4 8.68M4 4v4.68h4.68"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>'
  };
  return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
}

function renderShell(data) {
  app.innerHTML = `
    <div class="shell">
      <header class="masthead">
        <div>
          <div class="eyebrow">2020—2026</div>
          <h1>${escapeHtml(data.meta.title)}</h1>
        </div>
        <p class="intro"><strong>Explore how my research ideas changed over time.</strong> ${escapeHtml(data.meta.description)}</p>
      </header>
      <nav class="toolbar" aria-label="Map controls">
        <div class="tool-group labels" aria-label="Research area filters">
          <span class="tool-label mono">Research areas</span>
          ${data.threads.slice(0, 4).map((thread) => `<button class="chip thread-filter" data-thread="${thread.id}" aria-pressed="true"><span class="chip-dot" style="color:${thread.color};background:${thread.color}"></span>${escapeHtml(thread.shortLabel)}</button>`).join('')}
        </div>
        <div class="tool-group" aria-label="Zoom controls">
          <button class="icon-btn" data-action="zoom-out" aria-label="Zoom out">${icon('minus')}</button>
          <button class="icon-btn" data-action="reset" aria-label="Reset view">${icon('reset')}</button>
          <button class="icon-btn" data-action="zoom-in" aria-label="Zoom in">${icon('plus')}</button>
        </div>
        <div class="spacer"></div>
        <span class="mono"><span id="visible-count">${data.nodes.length}</span> public events</span>
      </nav>
      <section class="workspace">
        <div class="map-wrap">
          <svg id="genealogy" role="img" aria-labelledby="map-title map-description" viewBox="0 0 1800 920">
            <title id="map-title">Research ideas over time</title>
            <desc id="map-description">Research ideas flow from left to right across time. Main paths show how ideas developed, and selection reveals what led to an event or what came next.</desc>
            <g id="viewport"></g>
          </svg>
          <div class="map-legend" aria-hidden="true">
            <span class="legend-item"><i class="legend-line thread"></i>Main path within a research area</span>
            <span class="legend-item"><i class="legend-line cross"></i>Connection between research areas</span>
          </div>
          <div class="map-caption mono">Scroll to zoom · drag to pan · select an event to see what led here or came next</div>
        </div>
        <aside class="detail-panel" id="detail" aria-live="polite"></aside>
      </section>
      <footer class="footer">© 2026 Yi Zhang</footer>
    </div>
    <div class="tooltip" id="tooltip" role="tooltip"></div>`;
}

function yearFraction(dateString) {
  const date = new Date(`${dateString}T00:00:00Z`);
  const year = date.getUTCFullYear();
  const start = Date.UTC(year, 0, 1);
  const end = Date.UTC(year + 1, 0, 1);
  return year + (date.getTime() - start) / (end - start);
}

function layoutNodes(data) {
  const startX = 250;
  const width = 1410;
  const minYear = data.meta.startYear;
  const span = data.meta.endYear + 1 - minYear;
  const laneY = { empathy: 170, network: 350, morality: 535, hybrid: 690, cross: 790, meta: 855 };
  const occupied = {};
  const positionedById = {};
  const offsets = [0, -64, 64];
  const incomingById = Object.fromEntries(data.nodes.map((node) => [node.id, data.edges.filter((edge) => edge.target === node.id)]));
  const outgoingById = Object.fromEntries(data.nodes.map((node) => [node.id, data.edges.filter((edge) => edge.source === node.id)]));

  const chronological = [...data.nodes].sort((a, b) => a.date.localeCompare(b.date));
  const positioned = chronological.map((node) => {
    const baseX = startX + ((yearFraction(node.date) - minYear) / span) * width;
    occupied[node.thread] ||= offsets.map(() => null);
    const labelHalfWidth = Math.max(...wrapLabel(node.title).map((line) => line.length)) * 3.15;
    const parents = incomingById[node.id]
      .map((edge) => positionedById[edge.source])
      .filter((parent) => parent?.thread === node.thread);
    let preferred = parents.length ? parents.reduce((sum, parent) => sum + parent.slotOffset, 0) / parents.length : 0;
    if (parents.length === 1) {
      const siblings = outgoingById[parents[0].id]
        .map((edge) => data.nodes.find((candidate) => candidate.id === edge.target))
        .filter((candidate) => candidate?.thread === node.thread)
        .sort((a, b) => a.date.localeCompare(b.date));
      const branchIndex = siblings.findIndex((candidate) => candidate.id === node.id);
      if (siblings.length > 1) preferred += [-64, 64, 0][branchIndex] || 0;
    }
    const rankedSlots = offsets.map((offset, index) => ({ offset, index })).sort((a, b) => Math.abs(a.offset - preferred) - Math.abs(b.offset - preferred));
    const available = rankedSlots.find(({ index }) => {
      const previous = occupied[node.thread][index];
      return !previous || baseX - previous.x > previous.labelHalfWidth + labelHalfWidth + 16;
    }) || rankedSlots.reduce((best, slot) => {
      const bestPosition = occupied[node.thread][best.index]?.x ?? -Infinity;
      const slotPosition = occupied[node.thread][slot.index]?.x ?? -Infinity;
      return slotPosition < bestPosition ? slot : best;
    });
    occupied[node.thread][available.index] = { x: baseX, labelHalfWidth };
    const positioned = { ...node, x: baseX, y: laneY[node.thread] + available.offset, laneY: laneY[node.thread], slotOffset: available.offset };
    positionedById[node.id] = positioned;
    return positioned;
  });
  const byId = Object.fromEntries(positioned.map((node) => [node.id, node]));
  return data.nodes.map((node) => byId[node.id]);
}

function edgePath(source, target) {
  const dx = Math.max(30, (target.x - source.x) * 0.5);
  return `M ${source.x} ${source.y} C ${source.x + dx} ${source.y}, ${target.x - dx} ${target.y}, ${target.x} ${target.y}`;
}

function renderNodeShape(node, thread) {
  const landmark = node.kind === 'publication' || node.landmark;
  const radius = landmark ? 14 : 10.25;
  const core = landmark
    ? `<rect class="node-core node-landmark" x="${node.x - radius * .72}" y="${node.y - radius * .72}" width="${radius * 1.44}" height="${radius * 1.44}" rx="1.5" fill="${thread.color}" transform="rotate(45 ${node.x} ${node.y})"/>`
    : `<circle class="node-core" cx="${node.x}" cy="${node.y}" r="${radius}" fill="${thread.color}"/>`;
  const marker = node.kind === 'pivot'
    ? `<path class="node-mark" d="M ${node.x - 4.5} ${node.y + 3.5} L ${node.x} ${node.y - 1} L ${node.x + 4.5} ${node.y + 3.5}"/>`
    : node.kind === 'setback'
      ? `<circle class="node-semantic-ring setback-mark" cx="${node.x}" cy="${node.y}" r="${radius + 3.5}" stroke="${thread.color}"/>`
      : node.kind === 'revival'
        ? `<circle class="node-semantic-ring revival-mark" cx="${node.x}" cy="${node.y}" r="${radius + 4}" stroke="${thread.color}"/>`
        : '';
  return { radius, markup: `${core}${marker}` };
}

function renderMap() {
  const { data } = state;
  const viewport = document.querySelector('#viewport');
  const positions = layoutNodes(data);
  state.positions = positions;
  const byId = Object.fromEntries(positions.map((node) => [node.id, node]));
  state.byId = byId;

  const years = Array.from({ length: data.meta.endYear - data.meta.startYear + 2 }, (_, index) => data.meta.startYear + index);
  const background = years.map((year) => {
    const x = 250 + ((year - data.meta.startYear) / (data.meta.endYear + 1 - data.meta.startYear)) * 1410;
    return `<line class="year-line" x1="${x}" y1="70" x2="${x}" y2="885"/><text class="year-text" x="${x + 7}" y="55">${year}</text>`;
  }).join('');

  const backbones = data.edges.filter((edge) => edge.overview).map((edge) => {
    const source = byId[edge.source];
    const target = byId[edge.target];
    if (!source || !target) return '';
    const thread = data.threads.find((item) => item.id === source.thread);
    const cross = source.thread !== target.thread;
    return `<path class="stream-line${cross ? ' cross' : ''}" data-backbone="${edge.source}:${edge.target}" data-source="${edge.source}" data-target="${edge.target}" d="${edgePath(source, target)}" stroke="${thread.color}"/>`;
  }).join('');

  const relations = data.edges.map((edge) => {
    const source = byId[edge.source];
    const target = byId[edge.target];
    if (!source || !target) return '';
    const thread = data.threads.find((item) => item.id === source.thread);
    const cross = source.thread !== target.thread;
    return `<path class="relation${cross ? ' cross' : ''}" data-edge="${edge.source}:${edge.target}" data-source="${edge.source}" data-target="${edge.target}" d="${edgePath(source, target)}" stroke="${thread.color}"/>`;
  }).join('');

  const nodes = positions.map((node) => {
    const thread = data.threads.find((item) => item.id === node.thread);
    const shape = renderNodeShape(node, thread);
    const radius = shape.radius;
    const labelLines = wrapLabel(node.title);
    const labelBottom = node.y - radius - 11;
    const labelTop = labelBottom - (labelLines.length - 1) * 12;
    const label = labelLines.map((line, index) => `<tspan x="${node.x}" dy="${index ? 12 : 0}">${escapeHtml(line)}</tspan>`).join('');
    return `<g class="node" tabindex="0" role="button" aria-label="${escapeHtml(node.title)}, ${escapeHtml(KIND_LABELS[node.kind] || node.kind)}, ${node.date}" data-node="${node.id}" style="color:${thread.color}">
      <circle class="node-halo" cx="${node.x}" cy="${node.y}" r="${radius + 8}" fill="${thread.color}"/>
      ${shape.markup}
      <circle class="node-ring" cx="${node.x}" cy="${node.y}" r="${radius + 6}" stroke="${thread.color}"/>
      <text class="node-label" x="${node.x}" y="${labelTop}" text-anchor="middle">${label}</text>
    </g>`;
  }).join('');

  const laneLabels = data.threads.map((thread) => {
    const node = positions.find((item) => item.thread === thread.id);
    if (!node) return '';
    const width = Math.max(132, Math.min(260, 50 + thread.label.length * 7.8));
    return `<g class="lane-key" data-lane-thread="${thread.id}"><rect class="lane-key-bg" x="15" y="${node.laneY - 15}" width="${width}" height="30" rx="3"/><circle class="lane-key-dot" cx="29" cy="${node.laneY}" r="5" fill="${thread.color}"/><text class="lane-label" x="41" y="${node.laneY + 4}">${escapeHtml(thread.label)}</text></g>`;
  }).join('');

  viewport.innerHTML = `${background}${laneLabels}<g id="backbones">${backbones}</g><g id="relations">${relations}</g><g id="nodes">${nodes}</g>`;
  bindNodeEvents();
  applyTransform();
  applyFilters();
}

function visualKeyMarkup() {
  return `<div class="eyebrow">Visual key</div><div class="key-list event-key"><div class="key-row"><span class="key-symbol"><i class="legend-node ordinary"></i></span><span>Ordinary research event</span></div><div class="key-row"><span class="key-symbol"><i class="legend-node pivot"></i></span><span>Pivot or redirection</span></div><div class="key-row"><span class="key-symbol"><i class="legend-node setback"></i></span><span>Productive setback</span></div><div class="key-row"><span class="key-symbol"><i class="legend-node revival"></i></span><span>Revival</span></div><div class="key-row"><span class="key-symbol"><i class="legend-node landmark"></i></span><span>Major research output (e.g. publication)</span></div></div>`;
}

function bindOnboardingActions() {
  document.querySelectorAll('[data-start-thread]').forEach((button) => button.addEventListener('click', () => focusResearchArea(button.dataset.startThread)));
  document.querySelector('[data-show-all]')?.addEventListener('click', showAllResearchAreas);
}

function defaultDetail() {
  const detail = document.querySelector('#detail');
  const primaryThreads = state.data.threads.filter((thread) => ['empathy', 'network', 'morality'].includes(thread.id));
  detail.innerHTML = `<div class="hint-card"><div><div class="eyebrow">Start here</div><h2>Where would you like to start?</h2><p>Choose one research area for a closer view, or explore the full map. Nothing is locked—you can move between areas at any time.</p><div class="area-choices">${primaryThreads.map((thread) => `<button class="area-choice" data-start-thread="${thread.id}"><span class="area-choice-dot" style="background:${thread.color}"></span><span>${escapeHtml(thread.label)}</span><span aria-hidden="true">→</span></button>`).join('')}<button class="area-choice show-all-choice" data-show-all><span class="area-choice-dot all-areas-dot"></span><span>Explore the full map</span><span aria-hidden="true">→</span></button></div></div><div>${visualKeyMarkup()}</div></div>`;
  bindOnboardingActions();
}

function focusedAreaDetail(thread) {
  const detail = document.querySelector('#detail');
  detail.innerHTML = `<div class="hint-card"><div><div class="eyebrow">Research area</div><h2>${escapeHtml(thread.label)}</h2><p>Follow this line from left to right. Select any event to see what led to it and what came next.</p><div class="focus-guide"><strong>Other research areas remain visible in the background.</strong><span>They become fully visible again when you select an event or return to the complete map.</span></div><button class="show-all-button" data-show-all>Show all research areas</button></div><div>${visualKeyMarkup()}</div></div>`;
  bindOnboardingActions();
}

function graphTrace(startId, direction) {
  const nodes = new Set();
  const edges = new Set();
  const queue = [startId];
  while (queue.length) {
    const current = queue.shift();
    state.data.edges.forEach((edge) => {
      const next = direction === 'out' && edge.source === current ? edge.target : direction === 'in' && edge.target === current ? edge.source : null;
      if (!next || next === startId) return;
      edges.add(`${edge.source}:${edge.target}`);
      if (!nodes.has(next)) { nodes.add(next); queue.push(next); }
    });
  }
  return { nodes, edges };
}

function selectNode(id, requestedMode = null) {
  const hadAreaFocus = Boolean(state.focusedThread);
  clearAreaFocus();
  if (hadAreaFocus) resetView();
  state.selected = id;
  const node = state.byId[id];
  const origins = graphTrace(id, 'in');
  const afterlife = graphTrace(id, 'out');
  const prefersAfterlife = AFTERLIFE_KINDS.has(node.kind) || node.status === 'dormant';
  state.traceMode = requestedMode
    || (prefersAfterlife && afterlife.nodes.size ? 'afterlife'
      : origins.nodes.size ? 'origins'
        : afterlife.nodes.size ? 'afterlife' : 'origins');
  const trace = state.traceMode === 'afterlife' ? afterlife : origins;
  const visibleNodes = new Set([id, ...trace.nodes]);

  document.querySelectorAll('[data-node]').forEach((element) => {
    const nodeId = element.dataset.node;
    element.classList.toggle('selected', nodeId === id);
    element.classList.toggle('ancestor', state.traceMode === 'origins' && origins.nodes.has(nodeId));
    element.classList.toggle('descendant', state.traceMode === 'afterlife' && afterlife.nodes.has(nodeId));
    element.classList.toggle('afterlife', state.traceMode === 'afterlife' && afterlife.nodes.has(nodeId));
    element.classList.toggle('dimmed', !visibleNodes.has(nodeId));
  });
  document.querySelectorAll('[data-edge]').forEach((element) => {
    const active = trace.edges.has(element.dataset.edge);
    element.classList.toggle('dimmed', !active);
    if (active) { element.style.opacity = '.95'; element.style.strokeWidth = '2'; }
    else { element.style.opacity = ''; element.style.strokeWidth = ''; }
  });
  document.querySelectorAll('[data-backbone]').forEach((element) => element.classList.add('trace-muted'));
  renderDetail(node, origins, afterlife);
}

function renderDetail(node, origins, afterlife) {
  const thread = state.data.threads.find((item) => item.id === node.thread);
  const incoming = state.data.edges.filter((edge) => edge.target === node.id);
  const outgoing = state.data.edges.filter((edge) => edge.source === node.id);
  const date = new Date(`${node.date}T00:00:00Z`).toLocaleDateString('en-US', { year: 'numeric', month: 'long', timeZone: 'UTC' });
  const publication = node.kind === 'publication' && node.url ? `<a class="publication-link" href="${escapeHtml(node.url)}" target="_blank" rel="noreferrer"><span>View publication</span><span aria-hidden="true">↗</span></a>` : '';
  const afterlifeText = node.afterlifeSummary || (afterlife.nodes.size
    ? 'Follow the highlighted path to see which later questions, methods, shifts, and outputs grew from this event.'
    : 'The current public map does not document a later continuation.');
  const connectionGroup = (title, edges, direction) => {
    if (!edges.length) return '';
    return `<div class="connection-group"><div class="connection-heading"><span class="eyebrow">${title}</span></div><div class="connection-list">${edges.map((edge) => {
      const otherId = direction === 'incoming' ? edge.source : edge.target;
      const other = state.byId[otherId];
      return `<button class="connection-item" data-goto="${otherId}"><span class="connection-title">${escapeHtml(other?.title || otherId)}</span><span class="connection-arrow">${direction === 'incoming' ? '←' : '→'}</span></button>`;
    }).join('')}</div></div>`;
  };
  document.querySelector('#detail').innerHTML = `
    <button class="icon-btn" data-action="clear" aria-label="Clear selection" style="float:right">${icon('close')}</button>
    <div class="eyebrow">Selected event</div>
    <h2>${escapeHtml(node.title)}</h2>
    <div class="event-identity" style="color:${thread.color}">${escapeHtml(thread.label)} · ${escapeHtml(KIND_LABELS[node.kind] || node.kind)}</div>
    <p>${escapeHtml(node.summary)}</p>
    ${node.question ? `<hr class="detail-rule"><div class="eyebrow">Guiding question</div><p>${escapeHtml(node.question)}</p>` : ''}
    ${node.significance ? `<div class="eyebrow">Why it mattered</div><p>${escapeHtml(node.significance)}</p>` : ''}
    ${publication}
    <hr class="detail-rule">
    <dl class="detail-meta"><dt>Began</dt><dd>${date}</dd><dt>Status</dt><dd>${escapeHtml(STATUS_LABELS[node.status] || node.status)}</dd></dl>
    <div class="trace-switch" role="group" aria-label="Trace direction"><button data-trace-mode="origins" aria-pressed="${state.traceMode === 'origins'}"><span>What led here</span><strong>${origins.nodes.size}</strong></button><button data-trace-mode="afterlife" aria-pressed="${state.traceMode === 'afterlife'}"><span>What came next</span><strong>${afterlife.nodes.size}</strong></button></div>
    ${state.traceMode === 'afterlife' ? `<div class="afterlife-note"><div class="eyebrow">What came next</div><p>${escapeHtml(afterlifeText)}</p></div>` : ''}
    ${(state.traceMode === 'origins' ? incoming.length : outgoing.length) ? `<hr class="detail-rule">${state.traceMode === 'origins' ? connectionGroup('What directly led here', incoming, 'incoming') : connectionGroup('What this directly led to', outgoing, 'outgoing')}` : ''}`;
  document.querySelector('[data-action="clear"]').addEventListener('click', clearSelection);
  document.querySelectorAll('[data-trace-mode]').forEach((button) => button.addEventListener('click', () => selectNode(node.id, button.dataset.traceMode)));
  document.querySelectorAll('[data-goto]').forEach((button) => button.addEventListener('click', () => selectNode(button.dataset.goto)));
}

function clearSelection() {
  state.selected = null;
  state.traceMode = null;
  document.querySelectorAll('.dimmed, .selected, .ancestor, .descendant, .afterlife').forEach((element) => element.classList.remove('dimmed', 'selected', 'ancestor', 'descendant', 'afterlife'));
  document.querySelectorAll('[data-edge]').forEach((element) => { element.style.opacity = ''; element.style.strokeWidth = ''; });
  document.querySelectorAll('[data-backbone]').forEach((element) => element.classList.remove('trace-muted'));
  defaultDetail();
  applyFilters();
}

function clearAreaFocus() {
  state.focusedThread = null;
  document.querySelectorAll('.area-muted').forEach((element) => element.classList.remove('area-muted'));
  document.querySelectorAll('.thread-filter.is-focused').forEach((button) => button.classList.remove('is-focused'));
}

function enableAllThreads() {
  state.enabledThreads = new Set(state.data.threads.map((thread) => thread.id));
  document.querySelectorAll('.thread-filter').forEach((button) => button.setAttribute('aria-pressed', 'true'));
}

function applyAreaFocus() {
  const focused = state.focusedThread;
  if (!focused) return;
  document.querySelectorAll('[data-node]').forEach((element) => {
    element.classList.toggle('area-muted', state.byId[element.dataset.node].thread !== focused);
  });
  document.querySelectorAll('[data-edge], [data-backbone]').forEach((element) => {
    const source = state.byId[element.dataset.source];
    const target = state.byId[element.dataset.target];
    element.classList.toggle('area-muted', source.thread !== focused && target.thread !== focused);
  });
  document.querySelectorAll('[data-lane-thread]').forEach((element) => element.classList.toggle('area-muted', element.dataset.laneThread !== focused));
  document.querySelectorAll('.thread-filter').forEach((button) => button.classList.toggle('is-focused', button.dataset.thread === focused));
}

function focusViewToThread(threadId) {
  const nodes = state.positions.filter((node) => node.thread === threadId);
  if (!nodes.length) return;
  const minX = Math.min(...nodes.map((node) => node.x));
  const maxX = Math.max(...nodes.map((node) => node.x));
  const minY = Math.min(...nodes.map((node) => node.y));
  const maxY = Math.max(...nodes.map((node) => node.y));
  const scale = Math.max(0.9, Math.min(1.2, 1500 / (maxX - minX + 220), 560 / (maxY - minY + 180)));
  state.transform = {
    x: 900 - ((minX + maxX) / 2) * scale,
    y: 460 - ((minY + maxY) / 2) * scale,
    scale
  };
  applyTransform();
}

function focusResearchArea(threadId) {
  const thread = state.data.threads.find((item) => item.id === threadId);
  if (!thread) return;
  state.selected = null;
  state.traceMode = null;
  document.querySelectorAll('.dimmed, .selected, .ancestor, .descendant, .afterlife').forEach((element) => element.classList.remove('dimmed', 'selected', 'ancestor', 'descendant', 'afterlife'));
  document.querySelectorAll('[data-edge]').forEach((element) => { element.style.opacity = ''; element.style.strokeWidth = ''; });
  document.querySelectorAll('[data-backbone]').forEach((element) => element.classList.remove('trace-muted'));
  enableAllThreads();
  state.focusedThread = threadId;
  applyFilters();
  applyAreaFocus();
  focusViewToThread(threadId);
  focusedAreaDetail(thread);
}

function showAllResearchAreas() {
  state.selected = null;
  state.traceMode = null;
  clearAreaFocus();
  enableAllThreads();
  applyFilters();
  resetView();
  defaultDetail();
}

function bindNodeEvents() {
  const tooltip = document.querySelector('#tooltip');
  document.querySelectorAll('[data-node]').forEach((element) => {
    const node = state.byId[element.dataset.node];
    const show = (event) => {
      tooltip.innerHTML = `<strong>${escapeHtml(node.title)}</strong><span class="mono">${node.date.slice(0, 4)} · ${escapeHtml(KIND_LABELS[node.kind] || node.kind)}</span>`;
      tooltip.classList.add('visible');
      if (!state.selected) document.querySelectorAll('[data-edge]').forEach((edge) => edge.classList.toggle('hover-active', edge.dataset.source === node.id || edge.dataset.target === node.id));
      moveTooltip(event);
    };
    element.addEventListener('pointerenter', show);
    element.addEventListener('pointermove', moveTooltip);
    element.addEventListener('pointerleave', () => {
      tooltip.classList.remove('visible');
      document.querySelectorAll('[data-edge].hover-active').forEach((edge) => edge.classList.remove('hover-active'));
    });
    element.addEventListener('click', (event) => { event.stopPropagation(); selectNode(node.id); });
    element.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectNode(node.id); } });
  });
}

function moveTooltip(event) {
  const tooltip = document.querySelector('#tooltip');
  tooltip.style.left = `${Math.min(window.innerWidth - 310, event.clientX + 14)}px`;
  tooltip.style.top = `${Math.min(window.innerHeight - 100, event.clientY + 14)}px`;
}

function applyFilters() {
  if (!state.data) return;
  let visible = 0;
  document.querySelectorAll('[data-node]').forEach((element) => {
    const node = state.byId[element.dataset.node];
    const enabled = state.enabledThreads.has(node.thread);
    element.style.display = enabled ? '' : 'none';
    if (enabled) visible += 1;
  });
  document.querySelectorAll('[data-edge]').forEach((element) => {
    const source = state.byId[element.dataset.source];
    const target = state.byId[element.dataset.target];
    element.style.display = state.enabledThreads.has(source.thread) && state.enabledThreads.has(target.thread) ? '' : 'none';
  });
  document.querySelectorAll('[data-backbone]').forEach((element) => {
    const source = state.byId[element.dataset.source];
    const target = state.byId[element.dataset.target];
    element.style.display = state.enabledThreads.has(source.thread) && state.enabledThreads.has(target.thread) ? '' : 'none';
  });
  document.querySelector('#visible-count').textContent = visible;
  applyAreaFocus();
}

function applyTransform() {
  const viewport = document.querySelector('#viewport');
  viewport.setAttribute('transform', `translate(${state.transform.x} ${state.transform.y}) scale(${state.transform.scale})`);
}

function zoom(factor, center = { x: 900, y: 460 }) {
  const previous = state.transform.scale;
  const next = Math.max(0.72, Math.min(3.4, previous * factor));
  state.transform.x = center.x - (center.x - state.transform.x) * (next / previous);
  state.transform.y = center.y - (center.y - state.transform.y) * (next / previous);
  state.transform.scale = next;
  applyTransform();
}

function resetView() {
  state.transform = { x: 0, y: 0, scale: 1 };
  applyTransform();
}

function bindControls() {
  document.querySelectorAll('.thread-filter').forEach((button) => {
    button.addEventListener('click', () => {
      const hadAreaFocus = Boolean(state.focusedThread);
      clearAreaFocus();
      if (hadAreaFocus) {
        resetView();
        if (!state.selected) defaultDetail();
      }
      const id = button.dataset.thread;
      if (state.enabledThreads.has(id)) state.enabledThreads.delete(id); else state.enabledThreads.add(id);
      button.setAttribute('aria-pressed', String(state.enabledThreads.has(id)));
      if (state.selected && !state.enabledThreads.has(state.byId[state.selected].thread)) clearSelection();
      applyFilters();
    });
  });
  document.querySelector('[data-action="zoom-in"]').addEventListener('click', () => zoom(1.22));
  document.querySelector('[data-action="zoom-out"]').addEventListener('click', () => zoom(0.82));
  document.querySelector('[data-action="reset"]').addEventListener('click', resetView);

  const svg = document.querySelector('#genealogy');
  svg.addEventListener('wheel', (event) => {
    event.preventDefault();
    const bounds = svg.getBoundingClientRect();
    zoom(event.deltaY < 0 ? 1.11 : 0.9, { x: (event.clientX - bounds.left) * 1800 / bounds.width, y: (event.clientY - bounds.top) * 920 / bounds.height });
  }, { passive: false });
  svg.addEventListener('pointerdown', (event) => {
    if (event.target.closest?.('[data-node]')) return;
    event.preventDefault();
    state.dragging = true;
    state.dragMoved = false;
    state.pointer = { x: event.clientX, y: event.clientY, originX: state.transform.x, originY: state.transform.y };
    svg.classList.add('is-dragging');
    svg.setPointerCapture(event.pointerId);
  });
  svg.addEventListener('pointermove', (event) => {
    if (!state.dragging) return;
    const deltaX = event.clientX - state.pointer.x;
    const deltaY = event.clientY - state.pointer.y;
    if (Math.hypot(deltaX, deltaY) > 3) state.dragMoved = true;
    const bounds = svg.getBoundingClientRect();
    state.transform.x = state.pointer.originX + deltaX * 1800 / bounds.width;
    state.transform.y = state.pointer.originY + deltaY * 920 / bounds.height;
    applyTransform();
  });
  const endDrag = () => { state.dragging = false; svg.classList.remove('is-dragging'); };
  svg.addEventListener('pointerup', endDrag);
  svg.addEventListener('pointercancel', () => { endDrag(); state.dragMoved = false; });
  svg.addEventListener('click', (event) => {
    if (state.dragMoved) {
      state.dragMoved = false;
      return;
    }
    if (event.target === svg || event.target.closest('#viewport')) {
      if (state.focusedThread) showAllResearchAreas(); else clearSelection();
    }
  });
}

async function initialize() {
  try {
    const response = await fetch(new URL('./data/genealogy.json', import.meta.url));
    if (!response.ok) throw new Error(`Data request failed with ${response.status}`);
    state.data = await response.json();
    state.enabledThreads = new Set(state.data.threads.map((thread) => thread.id));
    renderShell(state.data);
    renderMap();
    defaultDetail();
    bindControls();
  } catch (error) {
    app.innerHTML = `<div style="padding:2rem;color:#ecf5ee"><h1>Unable to load the map</h1><p>${escapeHtml(error.message)}</p></div>`;
  }
}

initialize();
