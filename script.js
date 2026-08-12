const letters = ['C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U'];
const letterToNum = char => letters.indexOf(char);

let planets = [];
let hyperlanes = [];
let lastRoutePath = null;
let currentHoveredSector = null;

let isClickPlotMode = false;
let currentBuildingSequence = [];

let routeSequence = [];

let scale = 1;
const minScale = 1;
const maxScale = 4;
let panX = 0;
let panY = 0;
let isDragging = false;
let startX = 0, startY = 0;

async function init() {
  const xSelect = document.getElementById('p-x');
  letters.forEach(l => xSelect.innerHTML += `<option value="${l}">Col ${l}</option>`);

  const ySelect = document.getElementById('p-y');
  for(let i=1; i<=21; i++) {
    ySelect.innerHTML += `<option value="${i}">Row ${i}</option>`;
  }

  buildGrid();
  setupZoomAndPan();
  setupCanvasInteraction();

  await loadPlanetsData();
  await loadHyperlanesData();

  refreshMapData();
  setupAutocomplete('route-waypoint-input', 'waypoint-suggestions', addWaypoint);

  window.addEventListener('resize', () => {
    drawCanvas();
  });
}

function toggleLogSystem() {
  const group = document.getElementById('log-system-group');
  group.classList.toggle('expanded');
}

function togglePlotHyperlane() {
  const group = document.getElementById('plot-hyperlane-group');
  group.classList.toggle('expanded');
}

function toggleMemoryCore() {
  const group = document.getElementById('memory-core-group');
  group.classList.toggle('expanded');
}

function toggleClickPlotMode(checkbox) {
  isClickPlotMode = checkbox.checked;
  const statusEl = document.getElementById('hp-status');
  if (isClickPlotMode) {
    statusEl.innerHTML = `Status: <span style="color: var(--building);">ACTIVE. Click planets on map to chain string.</span>`;
    log("> CLICK-TO-PLOT STRING MODE ENGAGED. Click systems on the grid to chain hyperlane sequence.");
  } else {
    statusEl.innerText = "Status: Click-to-Plot Inactive";
    log("> CLICK-TO-PLOT STRING MODE DISENGAGED.");
  }
}

function clearCurrentBuilding() {
  currentBuildingSequence = [];
  document.getElementById('hp-sequence').value = '';
  drawCanvas();
  log("> HYPERLANE STRING CLEARED.");
}

function addWaypoint(name) {
  if (routeSequence.length > 0 && routeSequence[routeSequence.length - 1] === name) return;
  routeSequence.push(name);
  document.getElementById('route-sequence').value = routeSequence.join(', ');
  log(`> WAYPOINT ADDED: <span style="color:#fff">${name}</span> (${routeSequence.length} stop${routeSequence.length > 1 ? 's' : ''} plotted)`);
  drawCanvas();
}

function clearRouteSequence() {
  routeSequence = [];
  document.getElementById('route-sequence').value = '';
  lastRoutePath = null;
  drawCanvas();
  log("> ROUTE WAYPOINTS CLEARED.");
}

function refreshMapData() {
  drawGridOverlay();
  drawCanvas();
}

async function loadHyperlanesData() {
  try {
    const response = await fetch('hyperlane-routes.json');
    if (!response.ok) throw new Error();
    const data = await response.json();

    hyperlanes = data.map(item => {
      if (item.u && item.v && !item.planets) {
        return { name: `${item.u}-${item.v} Route`, planets: [item.u, item.v], isCustom: true };
      }
      if (item.planets && item.isCustom === undefined) {
        item.isCustom = true;
      }
      return item;
    });

    log("> ROUTE DATA LOADED FROM hyperlane-routes.json");
  } catch (err) {
    log("> NO LOCAL HYPERLANE DATA FOUND. NETWORK EMPTY.");
    hyperlanes = [];
  }
}

function setupZoomAndPan() {
  const viewport = document.getElementById('map-viewport');

  viewport.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomIntensity = 0.15;
    if (e.deltaY < 0) {
      scale *= (1 + zoomIntensity);
    } else {
      scale /= (1 + zoomIntensity);
    }
    updateTransform();
  }, { passive: false });

  viewport.addEventListener('mousedown', (e) => {
    if (e.target.closest('.planet-marker')) return;
    isDragging = true;
    startX = e.clientX - panX;
    startY = e.clientY - panY;
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    panX = e.clientX - startX;
    panY = e.clientY - startY;
    updateTransform();
  });

  window.addEventListener('mouseup', () => {
    isDragging = false;
  });
}

function updateTransform() {
  scale = Math.max(minScale, Math.min(maxScale, scale));

  if (scale === 1) {
    panX = 0;
    panY = 0;
  } else {
    const viewport = document.getElementById('map-viewport');
    const maxPanX = (viewport.clientWidth * (scale - 1)) / 2;
    const maxPanY = (viewport.clientHeight * (scale - 1)) / 2;

    panX = Math.max(-maxPanX, Math.min(maxPanX, panX));
    panY = Math.max(-maxPanY, Math.min(maxPanY, panY));
  }

  const grid = document.getElementById('map-grid');
  grid.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
}

async function loadPlanetsData() {
  try {
    const response = await fetch('planets.json');
    if (!response.ok) throw new Error();
    planets = await response.json();
    log("> NAV DATA LOADED FROM planets.json");
  } catch (err) {
    log("> LOADING CORE WORLDS DATABASE.");
    planets = [
      { name: 'Coruscant', x: 'K', y: 9, important: true },
      { name: 'Corellia', x: 'I', y: 11, important: true },
      { name: 'Alderaan', x: 'M', y: 7, important: true },
      { name: 'Tatooine', x: 'R', y: 16, important: true },
      { name: 'Balmorra', x: 'M', y: 10, important: true },
      { name: 'Manaan', x: 'O', y: 11, important: true },
      { name: 'Naboo', x: 'N', y: 14, important: true },
      { name: 'Kashyyyk', x: 'L', y: 5, important: true },
      { name: 'Eriadu', x: 'P', y: 13, important: true },
      { name: 'Mandalore', x: 'G', y: 8, important: true },
      { name: 'Fondor', x: 'J', y: 8, important: true },
      { name: 'Kuat', x: 'L', y: 9, important: true }
    ];
  }
}

function saveCustomHyperlane() {
  const name = document.getElementById('hp-name').value.trim();
  const rawSequence = document.getElementById('hp-sequence').value.trim();

  if (!name) {
    log("> ERROR: Hyperlane name required.");
    return;
  }
  if (!rawSequence) {
    log("> ERROR: Planet sequence required.");
    return;
  }

  const planetList = rawSequence.split(',').map(s => s.trim()).filter(s => s.length > 0);
  if (planetList.length < 2) {
    log("> ERROR: A hyperlane must connect at least 2 planets.");
    return;
  }

  for (const pName of planetList) {
    const found = planets.find(p => p.name.toLowerCase() === pName.toLowerCase());
    if (!found) {
      log(`> ERROR: Planet '${pName}' not found in database.`);
      return;
    }
  }

  const existingLane = hyperlanes.find(l => l.name && l.name.toLowerCase() === name.toLowerCase());
  if (existingLane) {
    existingLane.planets = planetList;
    existingLane.isCustom = true;
    log(`> HYPERLANE UPDATED: ${name} (${planetList.length} systems)`);
  } else {
    hyperlanes.push({ name: name, planets: planetList, isCustom: true });
    log(`> NEW HYPERLANE PLOTTED: ${name} (${planetList.length} systems)`);
  }

  document.getElementById('hp-name').value = '';
  document.getElementById('hp-sequence').value = '';
  currentBuildingSequence = [];
  document.getElementById('hp-click-mode').checked = false;
  isClickPlotMode = false;
  document.getElementById('hp-status').innerText = 'Status: Click-to-Plot Inactive';
  drawCanvas();
}

async function generateHyperlaneGrid() {
  if (planets.length < 2) {
    log("> ERROR: Need at least 2 systems logged to generate a network.");
    return;
  }

  log("> GENERATING CLEAN GALACTIC GRID...");
  await new Promise(resolve => setTimeout(resolve, 10));

  hyperlanes = hyperlanes.filter(lane => lane.isCustom);

  const getCoord = p => {
    const off = getPlanetOffset(p.name);
    return {
      x: letterToNum(p.x) + (off.dx / 30),
      y: p.y + (off.dy / 30)
    };
  };

  const coords = new Map();
  planets.forEach(p => coords.set(p.name, getCoord(p)));

  const dist = (a, b) => {
    const ca = coords.get(a.name);
    const cb = coords.get(b.name);
    return Math.hypot(ca.x - cb.x, ca.y - cb.y);
  };

  const MAX_HYPERLANE_DIST = 4.2;
  const candidates = [];

  for (let i = 0; i < planets.length; i++) {
    for (let j = i + 1; j < planets.length; j++) {
      const p1 = planets[i];
      const p2 = planets[j];
      const d12 = dist(p1, p2);

      if (d12 > MAX_HYPERLANE_DIST) continue;

      let isValid = true;

      for (let k = 0; k < planets.length; k++) {
        if (k === i || k === j) continue;
        const p3 = planets[k];

        if (Math.max(dist(p1, p3), dist(p2, p3)) < d12 - 0.001) {
          isValid = false;
          break;
        }
      }

      if (isValid) {
        candidates.push({ p1, p2, d: d12 });
      }
    }
  }

  candidates.sort((a, b) => a.d - b.d);

  function orient(p, q, r) {
    const val = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
    if (Math.abs(val) < 1e-6) return 0;
    return val > 0 ? 1 : 2;
  }

  function segmentsCross(a1, a2, b1, b2) {
    const ca1 = coords.get(a1.name), ca2 = coords.get(a2.name);
    const cb1 = coords.get(b1.name), cb2 = coords.get(b2.name);

    const o1 = orient(ca1, ca2, cb1), o2 = orient(ca1, ca2, cb2);
    const o3 = orient(cb1, cb2, ca1), o4 = orient(cb1, cb2, ca2);

    return (o1 !== o2 && o3 !== o4);
  }

  const activeEdges = [];
  let addedCount = 0;

  for (const cand of candidates) {
    let crosses = false;
    for (const edge of activeEdges) {
      if (cand.p1.name === edge.p1.name || cand.p1.name === edge.p2.name ||
        cand.p2.name === edge.p1.name || cand.p2.name === edge.p2.name) {
        continue;
        }
        if (segmentsCross(cand.p1, cand.p2, edge.p1, edge.p2)) {
          crosses = true;
          break;
        }
    }

    if (!crosses) {
      activeEdges.push(cand);
      hyperlanes.push({
        name: `${cand.p1.name} - ${cand.p2.name} Route`,
        planets: [cand.p1.name, cand.p2.name],
        isCustom: false
      });
      addedCount++;
    }
  }

  drawCanvas();
  log(`> HYPERLANE GRID GENERATED: ${addedCount} clean links across ${planets.length} systems.<br>> Relative Neighborhood Topology: Crisp grid mesh, localized routes, zero line crossings.`);
}

function findShortestPath(startName, destName) {
  const adjacency = {};
  planets.forEach(p => adjacency[p.name] = []);

  hyperlanes.forEach(lane => {
    const routePlanets = lane.planets || [];

    const speedMultiplier = lane.isCustom ? 2.5 : 1.0;

    for (let i = 0; i < routePlanets.length - 1; i++) {
      const u = routePlanets[i];
      const v = routePlanets[i+1];
      const p1 = planets.find(p => p.name === u);
      const p2 = planets.find(p => p.name === v);

      if (p1 && p2) {
        const x1 = letterToNum(p1.x), y1 = p1.y;
        const x2 = letterToNum(p2.x), y2 = p2.y;

        const rawDist = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
        const effectiveDist = rawDist / speedMultiplier;

        if (!adjacency[u]) adjacency[u] = [];
        if (!adjacency[v]) adjacency[v] = [];

        adjacency[u].push({ node: v, weight: effectiveDist });
        adjacency[v].push({ node: u, weight: effectiveDist });
      }
    }
  });

  const distances = {};
  const previous = {};
  const unvisited = new Set();

  planets.forEach(p => {
    distances[p.name] = Infinity;
    previous[p.name] = null;
    unvisited.add(p.name);
  });

  distances[startName] = 0;

  while (unvisited.size > 0) {
    let current = null;
    let shortestDist = Infinity;

    unvisited.forEach(node => {
      if (distances[node] < shortestDist) {
        shortestDist = distances[node];
        current = node;
      }
    });

    if (current === null || shortestDist === Infinity) break;
    if (current === destName) break;

    unvisited.delete(current);

    if (adjacency[current]) {
      adjacency[current].forEach(neighbor => {
        if (unvisited.has(neighbor.node)) {
          let alt = distances[current] + neighbor.weight;
          if (alt < distances[neighbor.node]) {
            distances[neighbor.node] = alt;
            previous[neighbor.node] = current;
          }
        }
      });
    }
  }

  const path = [];
  let curr = destName;
  while (curr !== null) {
    path.unshift(curr);
    curr = previous[curr];
  }

  if (path.length === 1 && path[0] !== startName) return { path: [], cost: Infinity };
  return { path, cost: distances[destName] };
}

function buildGrid() {
  const grid = document.getElementById('map-grid');
  const canvas = document.getElementById('route-canvas');
  grid.innerHTML = '';
  grid.appendChild(canvas);

  grid.innerHTML += `<div class="grid-header"></div>`;
  letters.forEach(l => {
    grid.innerHTML += `<div class="grid-header">${l}</div>`;
  });

  for(let y=1; y<=21; y++) {
    grid.innerHTML += `<div class="grid-header">${y}</div>`;
    letters.forEach(x => {
      grid.innerHTML += `<div class="cell" id="cell-${x}-${y}"></div>`;
    });
  }
}

function setupAutocomplete(inputId, listId, onSelect) {
  const input = document.getElementById(inputId);
  const list = document.getElementById(listId);

  const choosePlanet = (name) => {
    if (onSelect) {
      onSelect(name);
      input.value = '';
    } else {
      input.value = name;
    }
    list.style.display = 'none';
  };

  input.addEventListener('input', () => {
    const val = input.value.toLowerCase().trim();
    list.innerHTML = '';
    if (!val) {
      list.style.display = 'none';
      return;
    }

    const matches = planets.filter(p => p.name.toLowerCase().includes(val));
    if (matches.length === 0) {
      list.style.display = 'none';
      return;
    }

    matches.forEach(p => {
      const item = document.createElement('div');
      item.className = 'suggestion-item';
      item.innerHTML = `${p.name} <span style="color:#8b949e">(${p.x}-${p.y})</span>`;
      item.onclick = () => choosePlanet(p.name);
      list.appendChild(item);
    });
    list.style.display = 'block';
  });

  if (onSelect) {
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const val = input.value.trim();
      if (!val) return;
      const match = planets.find(p => p.name.toLowerCase() === val.toLowerCase());
      if (match) {
        choosePlanet(match.name);
      } else {
        log(`> ERROR: System '${val}' not found in database.`);
      }
    });
  }

  document.addEventListener('click', (e) => {
    if (!input.contains(e.target) && !list.contains(e.target)) {
      list.style.display = 'none';
    }
  });
}

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

function getPlanetOffset(planetName) {
  const p = planets.find(p => p.name === planetName);
  if(!p) return { dx: 0, dy: 0 };

  const peers = planets.filter(other => other.x === p.x && other.y === p.y).sort((a,b) => a.name.localeCompare(b.name));
  if (peers.length <= 1) {
    let angle = (hashCode(p.name + "_edge_angle") % 1000) / 1000 * Math.PI * 2;
    let radius = 12 + ((hashCode(p.name + "_edge_rad") % 1000) / 1000) * 11;
    return { dx: Math.cos(angle) * radius, dy: Math.sin(angle) * radius };
  }

  const maxOffset = 22;
  const minDistance = 7;
  const placedOffsets = [];

  for (let i = 0; i < peers.length; i++) {
    const peer = peers[i];
    let angle = (hashCode(peer.name + "_angle") % 1000) / 1000 * Math.PI * 2;
    let radius = 6 + (hashCode(peer.name + "_rad") % 1000) / 1000 * (maxOffset - 6);
    let dx = Math.cos(angle) * radius;
    let dy = Math.sin(angle) * radius;

    let attempts = 0;
    let collision = true;

    while (collision && attempts < 30) {
      collision = false;
      for (const placed of placedOffsets) {
        const dist = Math.sqrt(Math.pow(dx - placed.dx, 2) + Math.pow(dy - placed.dy, 2));
        if (dist < minDistance) {
          collision = true;
          dx += (dx - placed.dx) * 0.4 || 0.6;
          dy += (dy - placed.dy) * 0.4 || 0.6;
        }
      }
      const currentRad = Math.sqrt(dx * dx + dy * dy);
      if (currentRad > maxOffset) {
        dx = (dx / currentRad) * maxOffset;
        dy = (dy / currentRad) * maxOffset;
      }
      attempts++;
    }

    if (peer.name === planetName) return { dx, dy };
    placedOffsets.push({ dx, dy });
  }
  return { dx: 0, dy: 0 };
}

function drawGridOverlay() {
  document.querySelectorAll('.planet-marker, .persistent-label').forEach(e => e.remove());

  planets.forEach(p => {
    const cell = document.getElementById(`cell-${p.x}-${p.y}`);
    if(!cell) return;

    const marker = document.createElement('div');
    marker.className = 'planet-marker';

    const offset = getPlanetOffset(p.name);
    marker.style.marginLeft = `${offset.dx}px`;
    marker.style.marginTop = `${offset.dy}px`;

    if (p.important) {
      const label = document.createElement('div');
      label.className = `persistent-label sector-label-${p.x}-${p.y}`;
      label.dataset.planetName = p.name;
      label.innerText = p.name;
      label.style.marginLeft = `${offset.dx}px`;
      label.style.marginTop = `${offset.dy - 6}px`;
      cell.appendChild(label);
    }

    cell.appendChild(marker);
  });
}

function handlePlanetClick(name) {
  if (isClickPlotMode) {
    currentBuildingSequence.push(name);
    document.getElementById('hp-sequence').value = currentBuildingSequence.join(', ');
    log(`> ADDED TO HYPERLANE STRING: <span style="color:#fff">${name}</span> (${currentBuildingSequence.length} systems)`);
    drawCanvas();
  } else {
    addWaypoint(name);
  }
}

function getVisualCenter(planetStr, baseWidth, baseHeight) {
  const p = planets.find(x => x.name === planetStr);
  if (!p) return null;
  const offset = getPlanetOffset(planetStr);
  const cellWidth = baseWidth / 19;
  const cellHeight = baseHeight / 21;
  return {
    x: letterToNum(p.x) * cellWidth + (cellWidth / 2) + offset.dx,
    y: (p.y - 1) * cellHeight + (cellHeight / 2) + offset.dy
  };
}

function drawCanvas() {
  const canvas = document.getElementById('route-canvas');
  const ctx = canvas.getContext('2d');
  const grid = document.getElementById('map-grid');

  const baseWidth = grid.clientWidth - 40;
  const baseHeight = grid.clientHeight - 40;
  const dpr = window.devicePixelRatio || 1;

  if (canvas.width !== baseWidth * dpr || canvas.height !== baseHeight * dpr) {
    canvas.width = baseWidth * dpr;
    canvas.height = baseHeight * dpr;
  }

  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.scale(dpr, dpr);

  const segmentCounts = {};

  hyperlanes.forEach(lane => {
    const routePlanets = lane.planets || [];
    for (let i = 0; i < routePlanets.length - 1; i++) {
      const u = routePlanets[i];
      const v = routePlanets[i+1];
      const start = getVisualCenter(u, baseWidth, baseHeight);
      const end = getVisualCenter(v, baseWidth, baseHeight);
      if (start && end) {
        const key = (u < v) ? `${u}|${v}` : `${v}|${u}`;
        segmentCounts[key] = (segmentCounts[key] || 0) + 1;
      }
    }
  });

  hyperlanes.forEach(lane => {
    const routePlanets = lane.planets || [];
    const isCustom = lane.isCustom;
    for (let i = 0; i < routePlanets.length - 1; i++) {
      const u = routePlanets[i];
      const v = routePlanets[i+1];
      const start = getVisualCenter(u, baseWidth, baseHeight);
      const end = getVisualCenter(v, baseWidth, baseHeight);
      if (start && end) {
        const key = (u < v) ? `${u}|${v}` : `${v}|${u}`;
        const density = segmentCounts[key] || 1;

        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);

        if (isCustom) {
          ctx.lineWidth = 2.5;
          ctx.strokeStyle = 'rgba(188, 19, 254, 0.85)';
        } else {
          if (density > 1) {
            ctx.lineWidth = 3.0 + density;
            ctx.strokeStyle = 'rgba(88, 166, 255, 0.55)';
          } else {
            ctx.lineWidth = 1.8;
            ctx.strokeStyle = 'rgba(88, 166, 255, 0.3)';
          }
        }
        ctx.stroke();
      }
    }
  });

  if (currentBuildingSequence && currentBuildingSequence.length > 1) {
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = 'rgba(46, 160, 67, 0.9)';
    ctx.setLineDash([6, 4]);

    for (let i = 0; i < currentBuildingSequence.length - 1; i++) {
      const start = getVisualCenter(currentBuildingSequence[i], baseWidth, baseHeight);
      const end = getVisualCenter(currentBuildingSequence[i+1], baseWidth, baseHeight);
      if (start && end) {
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
      }
    }
    ctx.setLineDash([]);
  }

  if (routeSequence && routeSequence.length > 1) {
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = 'rgba(243, 156, 18, 0.7)';
    ctx.setLineDash([4, 4]);

    for (let i = 0; i < routeSequence.length - 1; i++) {
      const start = getVisualCenter(routeSequence[i], baseWidth, baseHeight);
      const end = getVisualCenter(routeSequence[i+1], baseWidth, baseHeight);
      if (start && end) {
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
      }
    }
    ctx.setLineDash([]);
  }

  if (lastRoutePath && lastRoutePath.length > 1) {
    ctx.lineWidth = 4.0;
    ctx.strokeStyle = 'rgba(243, 156, 18, 0.95)';
    ctx.setLineDash([8, 6]);

    for (let i = 0; i < lastRoutePath.length - 1; i++) {
      const start = getVisualCenter(lastRoutePath[i], baseWidth, baseHeight);
      const end = getVisualCenter(lastRoutePath[i+1], baseWidth, baseHeight);
      if (start && end) {
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
      }
    }
    ctx.setLineDash([]);
  }

  ctx.restore();
}

function getUnscaledMousePos(e, canvas) {
  const rect = canvas.getBoundingClientRect();
  const grid = document.getElementById('map-grid');
  const baseWidth = grid.clientWidth - 40;
  const baseHeight = grid.clientHeight - 40;
  const screenCenterX = rect.left + rect.width / 2;
  const screenCenterY = rect.top + rect.height / 2;

  return {
    x: (baseWidth / 2) + (e.clientX - screenCenterX) / scale,
    y: (baseHeight / 2) + (e.clientY - screenCenterY) / scale
  };
}

function setupCanvasInteraction() {
  const canvas = document.getElementById('route-canvas');
  const grid = document.getElementById('map-grid');

  canvas.addEventListener('mousemove', (e) => {
    const mouse = getUnscaledMousePos(e, canvas);
    const mouseX = mouse.x;
    const mouseY = mouse.y;
    const baseWidth = grid.clientWidth - 40;
    const baseHeight = grid.clientHeight - 40;

    let hoveredPlanet = null;
    for (const p of planets) {
      const center = getVisualCenter(p.name, baseWidth, baseHeight);
      if (center) {
        const dist = Math.hypot(mouseX - center.x, mouseY - center.y);
        if (dist <= 2) {
          hoveredPlanet = p;
          break;
        }
      }
    }

    if (hoveredPlanet) {
      showPlanetTooltip(e, hoveredPlanet);
      return;
    }

    let hoveredLane = null;
    let minDistance = 8;

    for (const lane of hyperlanes) {
      const routePlanets = lane.planets || [];
      for (let i = 0; i < routePlanets.length - 1; i++) {
        const start = getVisualCenter(routePlanets[i], baseWidth, baseHeight);
        const end = getVisualCenter(routePlanets[i+1], baseWidth, baseHeight);
        if (!start || !end) continue;

        const dist = distToSegment({x: mouseX, y: mouseY}, start, end);
        if (dist < minDistance) {
          hoveredLane = lane;
          break;
        }
      }
      if (hoveredLane) break;
    }

    if (hoveredLane) {
      showLaneTooltip(e, hoveredLane);
    } else {
      hideTooltip();
    }
  });

  canvas.addEventListener('click', (e) => {
    const mouse = getUnscaledMousePos(e, canvas);
    const mouseX = mouse.x;
    const mouseY = mouse.y;
    const baseWidth = grid.clientWidth - 40;
    const baseHeight = grid.clientHeight - 40;

    for (const p of planets) {
      const center = getVisualCenter(p.name, baseWidth, baseHeight);
      if (center) {
        const dist = Math.hypot(mouseX - center.x, mouseY - center.y);
        if (dist <= 3) {
          handlePlanetClick(p.name);
          return;
        }
      }
    }
  });

  canvas.addEventListener('mouseleave', () => {
    hideTooltip();
  });
}

function distToSegment(p, p1, p2) {
  const l2 = Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2);
  if (l2 === 0) return Math.hypot(p.x - p1.x, p.y - p1.y);
  let t = ((p.x - p1.x) * (p2.x - p1.x) + (p.y - p1.y) * (p2.y - p1.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (p1.x + t * (p2.x - p1.x)), p.y - (p1.y + t * (p2.y - p1.y)));
}

function showLaneTooltip(e, lane) {
  const tt = document.getElementById('tooltip');
  const numSystems = lane.planets ? lane.planets.length : 0;
  tt.innerHTML = `
  <div class="tt-header" style="color: var(--custom-lane);">${lane.name || 'Hyperlane Segment'}</div>
  <div style="color: #8b949e; font-size: 0.75em; margin-top: 4px;">Systems: ${numSystems}</div>
  `;
  tt.style.display = 'block';
  moveTooltip(e);
}

function showPlanetTooltip(e, planet) {
  currentHoveredSector = `${planet.x}-${planet.y}`;
  document.querySelectorAll(`.sector-label-${currentHoveredSector}`).forEach(el => {
    if (el.dataset.planetName !== planet.name) {
      el.classList.add('hidden-label');
    }
  });

  const tt = document.getElementById('tooltip');
  let actionText = '[Click to add waypoint]';
  let actionColor = 'var(--route)';

  if (isClickPlotMode) {
    actionText = '[Click to add to hyperlane string]';
    actionColor = 'var(--building)';
  }

  tt.innerHTML = `
  <div class="tt-header">${planet.name} ${planet.important ? '&#9733;' : ''}</div>
  <div class="tt-item">Grid Sector: ${planet.x}-${planet.y}</div>
  <div style="color: ${actionColor}; font-size: 0.75em; margin-top: 4px;">${actionText}</div>

  `;
  tt.style.display = 'block';
  moveTooltip(e);
}

function moveTooltip(e) {
  const tt = document.getElementById('tooltip');
  const padding = 15;
  let left = e.clientX + padding;
  let top = e.clientY + padding;
  const rect = tt.getBoundingClientRect();

  if (left + rect.width > window.innerWidth - 10) left = e.clientX - rect.width - padding;
  if (top + rect.height > window.innerHeight - 10) top = e.clientY - rect.height - padding;

  tt.style.left = left + 'px';
  tt.style.top = top + 'px';
}

function hideTooltip() {
  document.getElementById('tooltip').style.display = 'none';
  if (currentHoveredSector) {
    document.querySelectorAll(`.sector-label-${currentHoveredSector}`).forEach(el => {
      el.classList.remove('hidden-label');
    });
    currentHoveredSector = null;
  }
}

function addPlanet() {
  const name = document.getElementById('p-name').value.trim();
  const x = document.getElementById('p-x').value;
  const y = parseInt(document.getElementById('p-y').value);
  const isImportant = document.getElementById('p-important').checked;

  if(!name) {
    log("> ERROR: Invalid planet designation.");
    return;
  }

  const existing = planets.find(p => p.name.toLowerCase() === name.toLowerCase());
  if(existing) {
    existing.x = x;
    existing.y = y;
    existing.important = isImportant;
    log(`> DB UPDATE: ${name.toUpperCase()} moved to ${x}-${y}`);
  } else {
    planets.push({ name, x, y, important: isImportant });
    log(`> NEW SYSTEM LOGGED: ${name.toUpperCase()} at ${x}-${y}`);
  }

  document.getElementById('p-name').value = '';
  document.getElementById('p-important').checked = false;
  refreshMapData();
}

function calculateRoute() {
  if (routeSequence.length < 2) {
    log("> ERROR: Need at least 2 waypoints to calculate a route.");
    return;
  }

  const hyperClass = parseFloat(document.getElementById('h-class').value) || 1.0;

  if (hyperlanes.length === 0) {
    log("> ERROR: No hyperlane network found.");
    return;
  }

  let fullPath = [];
  let totalCost = 0;

  for (let i = 0; i < routeSequence.length - 1; i++) {
    const p1 = planets.find(p => p.name.toLowerCase() === routeSequence[i].toLowerCase());
    const p2 = planets.find(p => p.name.toLowerCase() === routeSequence[i + 1].toLowerCase());

    if (!p1 || !p2) {
      log("> ERROR: Unknown system in waypoint list.");
      return;
    }
    if (p1.name === p2.name) continue;

    const { path: legPath, cost: legCost } = findShortestPath(p1.name, p2.name);

    if (legCost === Infinity || legPath.length === 0) {
      log(`> FATAL: No hyperlane path exists between <span style="color:#fff">${p1.name}</span> and <span style="color:#fff">${p2.name}</span>. Navigation aborted.`);
      lastRoutePath = null;
      drawCanvas();
      return;
    }

    fullPath = fullPath.length === 0 ? fullPath.concat(legPath) : fullPath.concat(legPath.slice(1));
    totalCost += legCost;
  }

  if (fullPath.length < 2) {
    log("> ERROR: Waypoints resolved to a single system - nowhere to jump to.");
    return;
  }

  const baseTimeHrs = 12;
  const travelTimeHrs = totalCost * baseTimeHrs * hyperClass;
  const d = Math.floor(travelTimeHrs / 24);
  const h = Math.round(travelTimeHrs % 24);

  const pathDisplay = routeSequence.length > 2
  ? `<span style="color:#fff">${routeSequence[0]}</span> &rarr; ... &rarr; <span style="color:#fff">${routeSequence[routeSequence.length - 1]}</span> <span style="color:#8b949e">(${routeSequence.length} waypoints)</span>`
  : `<span style="color:#fff">${routeSequence[0]}</span> &rarr; <span style="color:#fff">${routeSequence[1]}</span>`;

  log(`> ROUTE PLOTTED:<br>`+
  `> PATH: ${pathDisplay}<br>`+
  `> TOTAL JUMP DISTANCE: ${totalCost.toFixed(2)} Sectors (${fullPath.length - 1} Jumps)<br>`+
  `> HYPERDRIVE: Class ${hyperClass}<br>`+
  `> EST. TRAVEL TIME: <span style="color:#fff">${d} Days, ${h} Hrs</span>`);

  lastRoutePath = fullPath;

  routeSequence = [];
  document.getElementById('route-sequence').value = '';

  drawCanvas();
}

function log(msg) {
  document.getElementById('output-log').innerHTML = msg;
}

function exportData() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(planets, null, 2));
  const a = document.createElement('a');
  a.href = dataStr;
  a.download = 'planets.json';
  a.click();
  log("> PLANETS EXPORTED TO planets.json");
}

function importData(event) {
  const file = event.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);
      if(Array.isArray(data)) {
        planets = data;
        refreshMapData();
        log("> planets.json LOADED SUCCESSFULLY");
      }
    } catch (err) {
      log("> ERROR: CORRUPTED DATA FILE");
    }
  };
  reader.readAsText(file);
}

function exportHyperlanes() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(hyperlanes, null, 2));
  const a = document.createElement('a');
  a.href = dataStr;
  a.download = 'hyperlane-routes.json';
  a.click();
  log("> ROUTES EXPORTED TO hyperlane-routes.json");
}

function importHyperlanes(event) {
  const file = event.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);
      if(Array.isArray(data)) {
        hyperlanes = data.map(item => {
          if (item.u && item.v && !item.planets) {
            return { name: `${item.u}-${item.v} Route`, planets: [item.u, item.v], isCustom: true };
          }
          if (item.planets && item.isCustom === undefined) {
            item.isCustom = !item.name.includes("Feeder Branch");
          }
          return item;
        });
        drawCanvas();
        log("> hyperlane-routes.json LOADED SUCCESSFULLY");
      }
    } catch (err) {
      log("> ERROR: CORRUPTED ROUTE DATA FILE");
    }
  };
  reader.readAsText(file);
}

window.onload = init;
