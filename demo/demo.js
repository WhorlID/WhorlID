// The demo runs whorlid in offline mode: no key, no endpoint, no fetch.
import { load, HASHED_SIGNALS } from './whorl.v1.esm.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const HASHED = new Set(HASHED_SIGNALS);

/**
 * Draw a whorl from the id.
 *
 * Concentric ridges, each perturbed by three harmonics whose frequency,
 * amplitude and phase are read out of the hash. Deterministic on purpose: the
 * same id always draws the same print, which is the point of showing it.
 */
function drawWhorl(svg, hex) {
  const bytes = [];
  for (let i = 0; i < 32; i += 2) bytes.push(parseInt(hex.slice(i, i + 2), 16));
  const unit = (i) => (bytes[i % bytes.length] ?? 0) / 255;

  const RIDGES = 22;
  const STEPS = 200;
  const coreX = (unit(0) - 0.5) * 46;
  const coreY = (unit(1) - 0.5) * 46;
  const harmonics = [
    { k: 2 + Math.floor(unit(2) * 3), amp: 6 + unit(3) * 11, phase: unit(4) * Math.PI * 2 },
    { k: 3 + Math.floor(unit(5) * 4), amp: 4 + unit(6) * 8, phase: unit(7) * Math.PI * 2 },
    { k: 5 + Math.floor(unit(8) * 5), amp: 2 + unit(9) * 5, phase: unit(10) * Math.PI * 2 },
  ];
  const squash = 0.9 + unit(11) * 0.12;
  const tilt = (unit(12) - 0.5) * 0.5;

  svg.textContent = '';
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  for (let r = 0; r < RIDGES; r++) {
    const t = r / (RIDGES - 1);
    const radius = 13 + t * 134;
    // Ridges crowd toward the core, the way a real print does.
    const cx = 160 + coreX * (1 - t) * 0.65;
    const cy = 160 + coreY * (1 - t) * 0.65;

    let d = '';
    for (let s = 0; s <= STEPS; s++) {
      const theta = (s / STEPS) * Math.PI * 2;
      let rad = radius;
      // Outer ridges deform most, but the core keeps some character too:
      // scaling straight by t would draw a perfect circle in the middle.
      const bend = 0.25 + 0.75 * t;
      for (const h of harmonics) rad += h.amp * bend * Math.sin(h.k * theta + h.phase + t * 1.5);
      const x = Math.cos(theta) * rad;
      const y = Math.sin(theta) * rad * squash;
      const px = cx + x * Math.cos(tilt) - y * Math.sin(tilt);
      const py = cy + x * Math.sin(tilt) + y * Math.cos(tilt);
      d += `${s === 0 ? 'M' : 'L'}${px.toFixed(2)} ${py.toFixed(2)}`;
    }

    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', d + 'Z');
    path.setAttribute('opacity', String(0.35 + 0.65 * (1 - t * 0.55)));
    svg.appendChild(path);

    if (!reduced) {
      const len = path.getTotalLength();
      path.style.setProperty('--len', `${len}`);
      path.style.setProperty('--delay', `${r * 38}ms`);
      path.style.strokeDasharray = `${len}`;
    }
  }
}

function formatId(hex) {
  return [0, 8, 16, 24].map((i) => `<span class="group">${hex.slice(i, i + 8)}</span>`).join('');
}

function preview(value) {
  if (value === null || value === undefined) return { text: 'not available', missing: true };
  if (Array.isArray(value)) {
    return { text: value.length ? value.join(', ') : 'empty', missing: value.length === 0 };
  }
  if (typeof value === 'object') return { text: JSON.stringify(value), missing: false };
  return { text: String(value), missing: String(value).trim() === '' };
}

function renderRows(components) {
  const tbody = document.getElementById('signal-rows');
  tbody.textContent = '';

  const names = Object.keys(components).sort((a, b) => {
    const aHashed = HASHED.has(a) ? 0 : 1;
    const bHashed = HASHED.has(b) ? 0 : 1;
    return aHashed - bHashed || a.localeCompare(b);
  });

  for (const name of names) {
    const { value, duration } = components[name];
    const { text, missing } = preview(value);

    const tr = document.createElement('tr');
    tr.dataset.component = name;

    const nameCell = document.createElement('td');
    nameCell.className = 'sig-name';
    nameCell.textContent = name;
    if (HASHED.has(name)) {
      const chip = document.createElement('span');
      chip.className = 'chip chip-hash';
      chip.textContent = 'id';
      chip.title = 'This signal is part of the visitor id';
      nameCell.appendChild(chip);
    }

    const valueCell = document.createElement('td');
    valueCell.className = missing ? 'sig-value null' : 'sig-value';
    valueCell.textContent = text;
    valueCell.title = text;

    const timeCell = document.createElement('td');
    timeCell.className = 'num';
    timeCell.textContent = duration === undefined ? '' : `${duration.toFixed(1)} ms`;

    tr.append(nameCell, valueCell, timeCell);
    tbody.appendChild(tr);
  }
}

function wireCopy(result) {
  const button = document.getElementById('copy');
  button.addEventListener('click', async () => {
    const payload = JSON.stringify(
      {
        visitorId: result.visitorId,
        confidence: result.confidence,
        components: Object.fromEntries(
          Object.entries(result.components).map(([k, v]) => [k, v.value])
        ),
      },
      null,
      2
    );
    try {
      await navigator.clipboard.writeText(payload);
      button.textContent = 'Copied';
    } catch {
      button.textContent = 'Copy blocked';
    }
    setTimeout(() => { button.textContent = 'Copy as JSON'; }, 1800);
  });
}

async function main() {
  const started = performance.now();
  let result;
  try {
    const agent = await load();
    result = await agent.get();
  } catch (error) {
    document.getElementById('visitor-id').innerHTML =
      '<span class="failed">Collection failed. The console has the details.</span>';
    console.error(error);
    return;
  }
  const elapsed = performance.now() - started;

  document.getElementById('visitor-id').innerHTML = formatId(result.visitorId);
  document.getElementById('confidence').textContent = result.confidence.toFixed(2);
  document.getElementById('meter-track').setAttribute(
    'aria-label',
    `Confidence ${result.confidence.toFixed(2)} out of 1`
  );
  requestAnimationFrame(() => {
    document.getElementById('meter-fill').style.width = `${result.confidence * 100}%`;
  });

  drawWhorl(document.getElementById('whorl'), result.visitorId);
  renderRows(result.components);

  const count = Object.keys(result.components).length;
  document.getElementById('timing').textContent =
    `${count} signals in ${elapsed.toFixed(0)} ms`;

  wireCopy(result);
  document.body.dataset.ready = 'true';
}

main();
