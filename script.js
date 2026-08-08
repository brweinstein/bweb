/* ---------- element refs ---------- */
const landingEl = document.getElementById('landing');
const explorerEl = document.getElementById('explorer');
const treeRootEl = document.getElementById('tree-root');
const previewPaneEl = document.getElementById('preview-pane');
const breadcrumbEl = document.getElementById('path-breadcrumb');
const statusLeftEl = document.getElementById('status-left');
const mobileBackBtn = document.getElementById('mobile-back');

/* ---------- state ---------- */
let manifest = null;
let flatVisible = [];
let selectedIndex = 0;
let view = 'landing'; // 'landing' | 'tree'

/* ---------- helpers ---------- */
function isTypingTarget(target) {
  return Boolean(target && target.matches('input, textarea, select, [contenteditable="true"]'));
}

function isMobile() {
  return window.matchMedia('(max-width: 760px)').matches;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function nodePath(node) {
  const parts = [];
  let n = node;
  while (n) {
    parts.unshift(n.name);
    n = n._parent;
  }
  return `~/${parts.join('/')}`;
}

/* ---------- landing -> explorer transition ---------- */
function enterExplorer() {
  if (view !== 'landing') return;
  view = 'tree';
  landingEl.classList.add('landing-exit');
  window.setTimeout(() => {
    landingEl.hidden = true;
    explorerEl.hidden = false;
    if (!manifest) {
      loadManifest();
    } else {
      renderTree();
    }
  }, 220);
}

function backToLanding() {
  view = 'landing';
  explorerEl.hidden = true;
  explorerEl.classList.remove('mobile-preview-active');
  landingEl.hidden = false;
  landingEl.classList.remove('landing-exit');
}

/* ---------- tree loading / flattening ---------- */
async function loadManifest() {
  try {
    const res = await fetch('manifest.json');
    manifest = await res.json();
    renderTree();
  } catch (err) {
    treeRootEl.innerHTML = `<li class="tree-error">could not load manifest.json</li>`;
  }
}

function flatten(nodes, ancestorContinues, parent) {
  let result = [];
  nodes.forEach((node, i) => {
    const isLast = i === nodes.length - 1;
    node._parent = parent;
    node._isLast = isLast;
    node._prefix = ancestorContinues.map((c) => (c ? '│   ' : '    ')).join('');
    node._connector = isLast ? '└── ' : '├── ';
    result.push(node);
    if (node.type === 'folder' && node.expanded && node.children) {
      result = result.concat(flatten(node.children, [...ancestorContinues, !isLast], node));
    }
  });
  return result;
}

function renderTree() {
  flatVisible = flatten(manifest.tree, [], null);
  selectedIndex = Math.min(selectedIndex, Math.max(flatVisible.length - 1, 0));

  treeRootEl.innerHTML = flatVisible.map((node, idx) => {
    const glyph = node.type === 'folder' ? (node.expanded ? '▾ ' : '▸ ') : '';
    const label = node.type === 'folder' ? `${node.name}/` : node.name;
    const selectedClass = idx === selectedIndex ? ' is-selected' : '';
    const typeClass = node.type === 'folder' ? 'is-folder' : 'is-file';
    return `<li class="tree-row ${typeClass}${selectedClass}" data-index="${idx}" tabindex="-1">` +
      `<span class="tree-prefix">${node._prefix}${node._connector}</span>` +
      `<span class="tree-glyph">${glyph}</span>` +
      `<span class="tree-label">${escapeHtml(label)}</span>` +
      `</li>`;
  }).join('');

  const selLi = treeRootEl.querySelector('.is-selected');
  if (selLi) selLi.scrollIntoView({ block: 'nearest' });

  const currentNode = flatVisible[selectedIndex];
  statusLeftEl.textContent = currentNode ? nodePath(currentNode) : '~';
}

/* ---------- selection / navigation ---------- */
function moveSelection(delta) {
  if (flatVisible.length === 0) return;
  selectedIndex = Math.min(Math.max(selectedIndex + delta, 0), flatVisible.length - 1);
  renderTree();
}

function openSelected() {
  const node = flatVisible[selectedIndex];
  if (!node) return;

  if (node.type === 'folder') {
    node.expanded = !node.expanded;
    renderTree();
  } else {
    openFile(node);
  }
}

function collapseOrParent() {
  const node = flatVisible[selectedIndex];
  if (!node) return;

  if (node.type === 'folder' && node.expanded) {
    node.expanded = false;
    renderTree();
    return;
  }

  if (node._parent) {
    selectedIndex = flatVisible.indexOf(node._parent);
    renderTree();
  }
}

/* ---------- markdown frontmatter + rendering ---------- */
function parseFrontmatter(raw) {
  const lines = raw.split('\n');
  const dividerIndex = lines.findIndex((l) => l.trim() === '---');

  if (dividerIndex === -1 || dividerIndex > 8) {
    return { meta: null, body: raw };
  }

  const meta = {};
  lines.slice(0, dividerIndex).forEach((line) => {
    const match = line.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
    if (match) meta[match[1]] = match[2].trim();
  });

  const body = lines.slice(dividerIndex + 1).join('\n');
  return { meta, body };
}

async function openFile(node) {
  breadcrumbEl.textContent = nodePath(node);
  statusLeftEl.textContent = nodePath(node);
  previewPaneEl.innerHTML = `<div class="preview-loading">loading ${escapeHtml(node.name)}...</div>`;

  if (isMobile()) {
    explorerEl.classList.add('mobile-preview-active');
  }

  try {
    const res = await fetch(node.path);
    if (!res.ok) throw new Error(`${res.status}`);
    const raw = await res.text();
    const { meta, body } = parseFrontmatter(raw);
    renderPreview(meta, body);
  } catch (err) {
    previewPaneEl.innerHTML = `<div class="preview-error">could not load ${escapeHtml(node.path)}</div>`;
  }
}

function renderPreview(meta, body) {
  let html = '';

  if (meta && meta.title) {
    html += `<div class="preview-frontmatter">`;
    html += `<h1>${escapeHtml(meta.title)}</h1>`;
    if (meta.repo) {
      html += `<a class="preview-repo" href="${escapeHtml(meta.repo)}" target="_blank" rel="noreferrer">repo ↗</a>`;
    }
    if (meta.tags) {
      html += `<div class="tag-row">` +
        meta.tags.split(',').map((t) => `<span class="tag">[${escapeHtml(t.trim())}]</span>`).join('') +
        `</div>`;
    }
    html += `</div>`;
  }

  html += `<div class="preview-markdown">${marked.parse(body)}</div>`;
  previewPaneEl.innerHTML = html;
}

/* ---------- mobile back ---------- */
mobileBackBtn.addEventListener('click', () => {
  explorerEl.classList.remove('mobile-preview-active');
});

/* ---------- click / tap on landing ---------- */
landingEl.addEventListener('click', enterExplorer);

/* ---------- click / tap in tree ---------- */
treeRootEl.addEventListener('click', (event) => {
  const row = event.target.closest('.tree-row');
  if (!row) return;
  selectedIndex = Number(row.dataset.index);
  openSelected();
});

/* ---------- keyboard ---------- */
window.addEventListener('keydown', (event) => {
  if (isTypingTarget(event.target)) return;

  if (view === 'landing') {
    if (event.key === 'Enter') {
      event.preventDefault();
      enterExplorer();
    }
    return;
  }

  switch (event.key) {
    case 'Escape':
      event.preventDefault();
      backToLanding();
      break;
    case 'j':
    case 'ArrowDown':
      event.preventDefault();
      moveSelection(1);
      break;
    case 'k':
    case 'ArrowUp':
      event.preventDefault();
      moveSelection(-1);
      break;
    case 'l':
    case 'ArrowRight':
    case 'Enter':
    case 'o':
      event.preventDefault();
      openSelected();
      break;
    case 'h':
    case 'ArrowLeft':
      event.preventDefault();
      collapseOrParent();
      break;
    case 'g':
      event.preventDefault();
      selectedIndex = 0;
      renderTree();
      break;
    case 'G':
      event.preventDefault();
      selectedIndex = flatVisible.length - 1;
      renderTree();
      break;
    case 'q':
      event.preventDefault();
      backToLanding();
      break;
    default:
      break;
  }
});

/* ---------- init ---------- */
if (typeof marked !== 'undefined') {
  marked.setOptions({ breaks: true });
}
