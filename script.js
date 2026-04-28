const sections = Array.from(document.querySelectorAll('[data-section-name]'));
const sectionIndexEl = document.getElementById('section-index');
const statusLeftEl = document.getElementById('status-left');
const statusCenterEl = document.getElementById('status-center');
const helpOverlay = document.getElementById('help-overlay');
const projectCards = Array.from(document.querySelectorAll('[data-project-card]'));

const state = {
  sectionIndex: 0,
  projectIndex: 0,
  helpOpen: false,
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function isTypingTarget(target) {
  return Boolean(target && target.matches('input, textarea, select, [contenteditable="true"]'));
}

function activeSectionName() {
  return sections[state.sectionIndex]?.dataset.sectionName ?? 'whoami';
}

function updateProjectSelection() {
  projectCards.forEach((card, index) => {
    card.classList.toggle('is-active', activeSectionName() === 'projects' && index === state.projectIndex);
  });
}

function drawProjectFrames() {
  projectCards.forEach((card) => {
    const width = card.getBoundingClientRect().width;
    const charWidth = 9;
    const innerChars = Math.max(18, Math.floor(width / charWidth) - 2);
    const line = '─'.repeat(innerChars);

    card.querySelector('.project-frame-top').dataset.lineTop = `┌${line}┐`;
    card.querySelector('.project-frame-bottom').dataset.lineBottom = `└${line}┘`;
  });
}

function updateShell() {
  sectionIndexEl.textContent = `[${state.sectionIndex + 1}/${sections.length}]`;
  statusLeftEl.textContent = activeSectionName();

  if (window.matchMedia('(max-width: 760px)').matches) {
    statusCenterEl.textContent = 'tap sections to scroll';
  } else if (activeSectionName() === 'projects') {
    statusCenterEl.textContent = 'j/k or ↑/↓ cycle project cards | g/G jump sections';
  } else {
    statusCenterEl.textContent = 'j/k or ↑/↓ navigate sections | h for help';
  }

  sections.forEach((section, index) => {
    section.classList.toggle('is-active', index === state.sectionIndex);
  });

  updateProjectSelection();
  drawProjectFrames();
}

function animateScrollTo(element) {
  const targetY = window.scrollY + element.getBoundingClientRect().top;
  const startY = window.scrollY;
  const distance = targetY - startY;
  const duration = 260;
  const start = performance.now();

  function step(now) {
    const progress = clamp((now - start) / duration, 0, 1);
    const eased = progress < 0.5
      ? 2 * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 2) / 2;

    window.scrollTo(0, startY + distance * eased);

    if (progress < 1) {
      window.requestAnimationFrame(step);
    }
  }

  window.requestAnimationFrame(step);
}

function goToSection(index) {
  const nextIndex = clamp(index, 0, sections.length - 1);
  state.sectionIndex = nextIndex;

  if (activeSectionName() === 'projects') {
    state.projectIndex = clamp(state.projectIndex, 0, projectCards.length - 1);
  }

  updateShell();
  animateScrollTo(sections[state.sectionIndex]);
}

function goToProject(index) {
  state.projectIndex = clamp(index, 0, projectCards.length - 1);
  updateShell();
  animateScrollTo(projectCards[state.projectIndex]);
}

function openHelp() {
  state.helpOpen = true;
  helpOverlay.hidden = false;
}

function closeHelp() {
  state.helpOpen = false;
  helpOverlay.hidden = true;
}

function toggleHelp() {
  if (state.helpOpen) {
    closeHelp();
  } else {
    openHelp();
  }
}

function handleSectionKeys(key) {
  const currentName = activeSectionName();

  if (currentName === 'projects' && projectCards.length > 0) {
    if (key === 'j' || key === 'ArrowDown' || key === 'ArrowRight') {
      if (state.projectIndex >= projectCards.length - 1) {
        goToSection(state.sectionIndex + 1);
      } else {
        goToProject(state.projectIndex + 1);
      }

      return true;
    }

    if (key === 'k' || key === 'ArrowUp' || key === 'ArrowLeft') {
      if (state.projectIndex <= 0) {
        goToSection(state.sectionIndex - 1);
      } else {
        goToProject(state.projectIndex - 1);
      }

      return true;
    }
  }

  if (key === 'j' || key === 'ArrowDown') {
    goToSection(state.sectionIndex + 1);
    return true;
  }

  if (key === 'k' || key === 'ArrowUp') {
    goToSection(state.sectionIndex - 1);
    return true;
  }

  if (key === 'g') {
    goToSection(0);
    return true;
  }

  if (key === 'G') {
    goToSection(sections.length - 1);
    return true;
  }

  return false;
}

window.addEventListener('keydown', (event) => {
  if (isTypingTarget(event.target)) {
    return;
  }

  if (event.key === 'Escape' && state.helpOpen) {
    event.preventDefault();
    closeHelp();
    return;
  }

  if (event.key === 'h' || event.key === '?') {
    event.preventDefault();
    toggleHelp();
    return;
  }

  if (state.helpOpen) {
    return;
  }

  const handled = handleSectionKeys(event.key);

  if (handled) {
    event.preventDefault();
  }
});

document.querySelectorAll('[data-close-help]').forEach((element) => {
  element.addEventListener('click', closeHelp);
});

projectCards.forEach((card, index) => {
  card.addEventListener('click', () => {
    state.sectionIndex = sections.findIndex((section) => section.id === 'projects');
    state.projectIndex = index;
    updateShell();
    animateScrollTo(card);
  });
});

const sectionObserver = new IntersectionObserver(
  (entries) => {
    let bestEntry = null;

    for (const entry of entries) {
      if (entry.isIntersecting && (!bestEntry || entry.intersectionRatio > bestEntry.intersectionRatio)) {
        bestEntry = entry;
      }
    }

    if (!bestEntry) {
      return;
    }

    const nextIndex = sections.findIndex((section) => section.id === bestEntry.target.id);

    if (nextIndex !== -1) {
      state.sectionIndex = nextIndex;

      if (activeSectionName() !== 'projects') {
        state.projectIndex = 0;
      }

      updateShell();
    }
  },
  {
    threshold: [0.45, 0.6, 0.75],
    rootMargin: '-10% 0px -20% 0px',
  }
);

sections.forEach((section) => sectionObserver.observe(section));

window.addEventListener('resize', () => {
  drawProjectFrames();
  updateShell();
});

window.addEventListener('load', () => {
  updateShell();
  drawProjectFrames();
});