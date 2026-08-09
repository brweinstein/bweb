/* ---------- element refs ---------- */
const landingEl = document.getElementById('landing');
const explorerEl = document.getElementById('explorer');
const treePaneEl = document.getElementById('tree-pane');
const treeRootEl = document.getElementById('tree-root');
const previewPaneEl = document.getElementById('preview-pane');
const breadcrumbEl = document.getElementById('path-breadcrumb');
const statusLeftEl = document.getElementById('status-left');
const statusCenterEl = document.getElementById('status-center');
const mobileBackBtn = document.getElementById('mobile-back');

/* ---------- state ---------- */
let manifest = null;
let flatVisible = [];
let selectedIndex = 0;
let view = 'landing'; // 'landing' | 'tree'
let focusPane = 'tree'; // 'tree' | 'buffer' — which pane the "cursor" is in
let bufferLines = []; // navigable elements inside the currently open file
let cursorLine = 0;

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

/* ---------- status bar text ---------- */
function updateStatusCenter() {
  if (isMobile()) {
    statusCenterEl.textContent = 'tap to navigate';
    return;
  }
  if (view === 'landing') {
    statusCenterEl.textContent = '';
    return;
  }
  if (focusPane === 'tree') {
    statusCenterEl.textContent = 'j/k move · l/enter open · h back · g/G top/bottom · esc landing';
  } else {
    statusCenterEl.textContent = 'j/k scroll · g/G top/bottom · h back to tree · q close · esc landing';
  }
}

function updatePaneFocusClasses() {
  treePaneEl.classList.toggle('is-focused', focusPane === 'tree');
  previewPaneEl.classList.toggle('is-focused', focusPane === 'buffer');
  updateStatusCenter();
}

/* ---------- landing -> explorer transition ---------- */
function enterExplorer() {
  if (view !== 'landing') return;
  view = 'tree';
  landingEl.classList.add('landing-exit');
  window.setTimeout(() => {
    landingEl.hidden = true;
    explorerEl.hidden = false;
    updatePaneFocusClasses();
    if (!manifest) {
      loadManifest();
    } else {
      renderTree();
    }
  }, 220);
}

function backToLanding() {
  view = 'landing';
  focusPane = 'tree';
  explorerEl.hidden = true;
  explorerEl.classList.remove('mobile-preview-active');
  landingEl.hidden = false;
  landingEl.classList.remove('landing-exit');
  updateStatusCenter();
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

/* ---------- tree selection / navigation ---------- */
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

/* ---------- markdown frontmatter ---------- */
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

/* ---------- image path resolution ---------- */
// All content images live in content/images/. Markdown files can reference
// them with just a filename (![alt](photo.png)) or the full path
// (content/images/photo.png) — both resolve to the same place. Absolute
// URLs (http/https/data/leading-slash) are left untouched.
function resolveImageSrc(href) {
  if (!href) return href;
  if (/^([a-z][a-z0-9+.-]*:)?\/\//i.test(href) || href.startsWith('data:') || href.startsWith('/')) {
    return href;
  }
  if (href.startsWith('content/images/')) {
    return href;
  }
  return `content/images/${href}`;
}

function buildRenderer() {
  const renderer = new marked.Renderer();
  renderer.image = (href, title, text) => {
    const src = escapeHtml(resolveImageSrc(href));
    const alt = escapeHtml(text || '');
    const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
    return `<img src="${src}" alt="${alt}"${titleAttr} loading="lazy">`;
  };
  return renderer;
}

/* ---------- opening a file ---------- */
async function openFile(node) {
  breadcrumbEl.textContent = nodePath(node);
  statusLeftEl.textContent = nodePath(node);
  previewPaneEl.innerHTML = `<div class="preview-loading">loading ${escapeHtml(node.name)}...</div>`;

  focusPane = 'buffer';
  updatePaneFocusClasses();

  if (isMobile()) {
    explorerEl.classList.add('mobile-preview-active');
  }

  try {
    const res = await fetch(node.path);
    if (!res.ok) throw new Error(`${res.status}`);
    const raw = await res.text();
    const { meta, body } = parseFrontmatter(raw);
    renderPreview(meta, body);
    initBufferCursor();
  } catch (err) {
    previewPaneEl.innerHTML = `<div class="preview-error">could not load ${escapeHtml(node.path)}</div>`;
    bufferLines = [];
  }
}

function renderPreview(meta, body) {
  let html = '';

  if (meta && meta.title) {
    html += `<div class="preview-frontmatter">`;
    html += `<h1>${escapeHtml(meta.title)}</h1>`;
    if (meta.date) {
      html += `<div class="preview-date">${escapeHtml(meta.date)}</div>`;
    }
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

  html += `<div class="preview-markdown">${marked.parse(body, { renderer: buildRenderer() })}</div>`;
  previewPaneEl.innerHTML = html;
}

/* ---------- buffer (content) cursor ---------- */
function collectBufferLines() {
  const container = previewPaneEl.querySelector('.preview-markdown');
  if (!container) return [];

  const lines = [];
  Array.from(container.children).forEach((child) => {
    if (child.tagName === 'UL' || child.tagName === 'OL') {
      Array.from(child.children).forEach((li) => lines.push(li));
    } else {
      lines.push(child);
    }
  });
  return lines;
}

function initBufferCursor() {
  bufferLines = collectBufferLines();
  cursorLine = 0;
  updateCursorHighlight();
}

function updateCursorHighlight() {
  bufferLines.forEach((el, i) => {
    el.classList.toggle('is-cursor-line', i === cursorLine);
  });
  const current = bufferLines[cursorLine];
  if (current) {
    current.scrollIntoView({ block: 'nearest' });
  }
}

function moveCursor(delta) {
  if (bufferLines.length === 0) return;
  cursorLine = Math.min(Math.max(cursorLine + delta, 0), bufferLines.length - 1);
  updateCursorHighlight();
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

/* ---------- click in preview pane moves cursor focus there ---------- */
previewPaneEl.addEventListener('click', (event) => {
  if (bufferLines.length === 0) return;
  focusPane = 'buffer';
  updatePaneFocusClasses();

  const clickedLine = bufferLines.findIndex((el) => el.contains(event.target));
  if (clickedLine !== -1) {
    cursorLine = clickedLine;
    updateCursorHighlight();
  }
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

  if (event.key === 'Escape') {
    event.preventDefault();
    backToLanding();
    return;
  }

  if (focusPane === 'buffer') {
    switch (event.key) {
      case 'j':
      case 'ArrowDown':
        event.preventDefault();
        moveCursor(event.ctrlKey ? 5 : 1);
        break;
      case 'k':
      case 'ArrowUp':
        event.preventDefault();
        moveCursor(event.ctrlKey ? -5 : -1);
        break;
      case 'd':
        if (event.ctrlKey) { event.preventDefault(); moveCursor(5); }
        break;
      case 'u':
        if (event.ctrlKey) { event.preventDefault(); moveCursor(-5); }
        break;
      case 'g':
        event.preventDefault();
        cursorLine = 0;
        updateCursorHighlight();
        break;
      case 'G':
        event.preventDefault();
        cursorLine = bufferLines.length - 1;
        updateCursorHighlight();
        break;
      case 'h':
      case 'ArrowLeft':
      case 'q':
        event.preventDefault();
        focusPane = 'tree';
        updatePaneFocusClasses();
        break;
      default:
        break;
    }
    return;
  }

  // focusPane === 'tree'
  switch (event.key) {
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

window.addEventListener('resize', updateStatusCenter);

/* ---------- init ---------- */
if (typeof marked !== 'undefined') {
  marked.setOptions({ breaks: true });
}
