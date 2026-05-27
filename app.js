'use strict';

const VB = { w: 810, h: 1012 };

const S = {
  cat: null,
  view: 'back',
  patches: [],
  selected: null,
  counter: 1,
  drag: null,
  activeGroup: 'protagonistas',
  activeCat: null,
  activeColl: null,
  designName: '',
  cache: new Map(),
  meta: new Map(),
  pointers: new Map(),
  gesture: null,
  trashHot: false,
  controlsOpen: false,
  draggedSinceDown: false,
  scrollLockY: 0,
  pageLocked: false,
  dragStarted: false,
  dragStartClient: null,
  dragThreshold: 10
};

const D = {
  logo: $('#brandLogo'),
  svg: $('#svg'),
  stage: $('#stage'),
  trash: $('#trashZone'),
  jacket: $('#jacket'),
  items: $('#items'),
  front: $('#frontBtn'),
  back: $('#backBtn'),
  controls: $('#controls'),
  controlsToggle: $('#controlsToggle'),
  controlsBody: $('#controlsBody'),
  collection: $('#collection'),
  letterPreview: $('#letterPreview'),
  name: $('#name'),
  groupTabs: $('#groupTabs'),
  tabs: $('#tabs'),
  grid: $('#patchGrid'),
  summary: $('#summary'),
  clearTop: $('#clearTop'),
  toast: $('#toast')
};

function $(selector) { return document.querySelector(selector); }
function E(name) { return document.createElementNS('http://www.w3.org/2000/svg', name); }
function uid() { return `p-${Date.now()}-${S.counter++}`; }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function esc(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function toast(message) {
  D.toast.textContent = message;
  D.toast.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => D.toast.classList.remove('show'), 2600);
}

async function init() {
  try {
    S.cat = await (await fetch('catalogo.json', { cache: 'no-store' })).json();
    S.activeColl = (S.cat.letterCollections.find(collection => collection.principal) || S.cat.letterCollections[0]).id;
    S.activeGroup = 'protagonistas';
    S.activeCat = patchCategories(S.activeGroup)[0] || patchCategories('detalles')[0] || null;
    D.logo.src = S.cat.brand.logo;

    bind();
    renderSelectors();
    renderLetterPreview();
    renderGroups();
    renderCats();
    renderGrid();
    render();
    preloadEssential();
  } catch (error) {
    console.error(error);
    toast('No pude iniciar. Revisa catalogo.json y assets.');
  }
}

async function preloadEssential() {
  await ensureCached([S.cat.brand.logo, S.cat.jackets.front, S.cat.jackets.back]);
  D.logo.src = src(S.cat.brand.logo);
  render();
}

async function ensureCached(list) {
  const unique = [...new Set(list.filter(Boolean))].filter(path => !S.cache.has(path));
  await Promise.all(unique.map(async path => {
    try {
      const blob = await (await fetch(path, { cache: 'force-cache' })).blob();
      const dataUrl = await blobUrl(blob);
      const meta = await imgMeta(dataUrl);
      S.cache.set(path, dataUrl);
      S.meta.set(path, meta);
    } catch (error) {
      console.warn('No cargó', path, error);
    }
  }));
}

function blobUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function imgMeta(url) {
  return new Promise(resolve => {
    const image = new Image();
    image.onload = () => resolve({ w: image.naturalWidth || 1, h: image.naturalHeight || 1 });
    image.onerror = () => resolve({ w: 1, h: 1 });
    image.src = url;
  });
}

function src(path) { return S.cache.get(path) || path; }
function coll(id = S.activeColl) { return S.cat.letterCollections.find(collection => collection.id === id) || S.cat.letterCollections[0]; }
function item(id) { return S.cat.patches.find(patch => patch.id === id); }
function imgPath(patch) { return patch.kind === 'letter' ? coll(patch.collectionId)?.letters[patch.letter] : item(patch.catalogId)?.imagen; }
function nameOf(patch) { return patch.kind === 'letter' ? `Letra ${patch.letter}` : (item(patch.catalogId)?.nombre || 'Parche'); }
function patchGroup(patch) {
  return patch.grupo || (((patch.defaultSize || 0) <= 70) ? 'detalles' : 'protagonistas');
}

function patchCategories(group = S.activeGroup) {
  return [...new Set(S.cat.patches.filter(patch => patchGroup(patch) === group).map(patch => patch.categoria))];
}

function letterAnchor(view = S.view) {
  // Zona segura del nombre. En espalda debe nacer en la franja visual
  // entre el cuello y la costura horizontal superior: no sobre el cuello,
  // no en el panel central. Línea segura ligeramente arriba de la costura.
  return view === 'back'
    ? { x: 405, y: 322 }
    : { x: 405, y: 340 };
}

function detailAnchor(view = S.view) {
  return view === 'back'
    ? { x: 405, y: 555 }
    : { x: 405, y: 565 };
}

function sizeOf(path, size) {
  const meta = S.meta.get(path) || { w: 1, h: 1 };
  const ratio = meta.w / Math.max(1, meta.h);
  return ratio >= 1 ? { w: size, h: size / ratio } : { w: size * ratio, h: size };
}

function render() {
  renderJacket();
  renderItems();
  renderSummary();
  D.front.classList.toggle('active', S.view === 'front');
  D.back.classList.toggle('active', S.view === 'back');
}

function renderJacket() {
  D.jacket.innerHTML = '';
  const image = E('image');
  const path = S.cat.jackets[S.view];
  image.setAttribute('href', src(path));
  image.setAttribute('x', '20');
  image.setAttribute('y', '26');
  image.setAttribute('width', '770');
  image.setAttribute('height', '960');
  image.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  D.jacket.appendChild(image);
}

function renderItems() {
  D.items.innerHTML = '';
  S.patches.filter(patch => patch.view === S.view).forEach(patch => {
    const path = imgPath(patch);
    if (!path) return;

    const size = sizeOf(path, patch.size);
    const group = E('g');
    group.classList.add('node');
    group.dataset.id = patch.id;
    group.setAttribute('transform', `translate(${patch.x} ${patch.y}) rotate(${patch.rotation})`);

    if (patch.id === S.selected) {
      const outline = E('rect');
      outline.setAttribute('x', -size.w / 2 - 10);
      outline.setAttribute('y', -size.h / 2 - 10);
      outline.setAttribute('width', size.w + 20);
      outline.setAttribute('height', size.h + 20);
      outline.setAttribute('rx', '14');
      outline.setAttribute('fill', 'none');
      outline.setAttribute('stroke', '#ed7f76');
      outline.setAttribute('stroke-width', '4');
      outline.setAttribute('stroke-dasharray', '10 7');
      outline.classList.add('selection-outline');
      group.appendChild(outline);
    }

    const image = E('image');
    image.classList.add('patch-image');
    image.setAttribute('href', src(path));
    image.setAttribute('x', -size.w / 2);
    image.setAttribute('y', -size.h / 2);
    image.setAttribute('width', size.w);
    image.setAttribute('height', size.h);
    image.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    group.appendChild(image);

    const hit = E('rect');
    hit.classList.add('hit-rect');
    hit.setAttribute('x', -size.w / 2 - 18);
    hit.setAttribute('y', -size.h / 2 - 18);
    hit.setAttribute('width', size.w + 36);
    hit.setAttribute('height', size.h + 36);
    hit.setAttribute('rx', '18');
    hit.setAttribute('fill', 'transparent');
    hit.setAttribute('pointer-events', 'all');
    group.appendChild(hit);

    group.addEventListener('pointerdown', down);
    D.items.appendChild(group);
  });

  const hasSelected = Boolean(selected());
  D.controls.hidden = !hasSelected;
  D.controls.classList.toggle('open', hasSelected && (S.controlsOpen || isDesktopEditor()));
  if (D.controlsToggle) D.controlsToggle.setAttribute('aria-expanded', D.controls.classList.contains('open') ? 'true' : 'false');
}

function renderSelectors() {
  D.collection.innerHTML = '';
  S.cat.letterCollections.forEach(collection => {
    const option = document.createElement('option');
    option.value = collection.id;
    option.textContent = collection.principal ? `${collection.nombre} (principal)` : collection.nombre;
    option.selected = collection.id === S.activeColl;
    D.collection.appendChild(option);
  });
}

function renderLetterPreview() {
  D.letterPreview.innerHTML = '';
  const collection = coll();
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').forEach(letter => {
    const path = collection.letters[letter];
    if (!path) return;
    D.letterPreview.appendChild(card(path, `Letra ${letter}`, () => {
      const anchor = letterAnchor(S.view);
      addLetter(letter, S.view, anchor.x, anchor.y, collection.defaultSize || 62, collection.id);
      render();
      toast(`Letra ${letter} agregada en ${viewLabel(S.view)}.`);
    }, 'letter-card'));
  });
}

function renderGroups() {
  D.groupTabs.innerHTML = '';
  const groups = [
    { id: 'protagonistas', label: 'Parches protagonistas' },
    { id: 'detalles', label: 'Detalles pequeños' }
  ];

  groups.forEach(group => {
    const button = document.createElement('button');
    button.textContent = group.label;
    button.type = 'button';
    button.className = group.id === S.activeGroup ? 'active' : '';
    button.onclick = () => {
      S.activeGroup = group.id;
      const categories = patchCategories(group.id);
      S.activeCat = categories.includes(S.activeCat) ? S.activeCat : (categories[0] || null);
      renderGroups();
      renderCats();
      renderGrid();
    };
    D.groupTabs.appendChild(button);
  });
}

function renderCats() {
  D.tabs.innerHTML = '';
  const categories = patchCategories(S.activeGroup);
  categories.forEach(category => {
    const button = document.createElement('button');
    button.textContent = category;
    button.type = 'button';
    button.className = category === S.activeCat ? 'active' : '';
    button.onclick = () => {
      S.activeCat = category;
      renderCats();
      renderGrid();
    };
    D.tabs.appendChild(button);
  });
}

function renderGrid() {
  D.grid.innerHTML = '';
  if (!S.activeCat) return;
  S.cat.patches
    .filter(patch => patchGroup(patch) === S.activeGroup && patch.categoria === S.activeCat)
    .forEach(patch => D.grid.appendChild(card(patch.imagen, patch.nombre, () => addCatalog(patch.id), 'detail-card')));
}

function card(path, alt, onClick, extraClass = '') {
  const button = document.createElement('button');
  button.className = `patch-item ${extraClass}`.trim();
  button.type = 'button';
  button.title = alt;

  const image = document.createElement('img');
  image.loading = 'lazy';
  image.decoding = 'async';
  image.src = src(path);
  image.alt = alt;
  image.onload = () => {
    if (!S.meta.has(path)) S.meta.set(path, { w: image.naturalWidth || 1, h: image.naturalHeight || 1 });
  };

  button.appendChild(image);
  button.onclick = onClick;
  return button;
}

function categoryDefaultSize(catalogItem) {
  const cat = (catalogItem.categoria || '').toLowerCase();
  if (cat.includes('estrella')) return 58;
  if (cat.includes('flores')) return 160;
  return 205;
}

function addCatalog(id) {
  const catalogItem = item(id);
  if (!catalogItem) return;
  const numberInView = S.patches.filter(patch => patch.view === S.view && patch.kind === 'patch').length;
  const anchor = detailAnchor(S.view);
  const patch = {
    id: uid(),
    kind: 'patch',
    catalogId: id,
    view: S.view,
    x: clamp(anchor.x + (numberInView % 3) * 20 - 20, 90, 720),
    y: clamp(anchor.y + (numberInView % 4) * 18 - 18, 120, 900),
    size: catalogItem.defaultSize || categoryDefaultSize(catalogItem),
    rotation: 0
  };
  S.patches.push(patch);
  S.selected = patch.id;
  render();
  toast(`${catalogItem.nombre} agregado en ${viewLabel(S.view)}.`);
}

function addLetter(letter, view = S.view, x = 405, y = 570, size = 62, collectionId = S.activeColl) {
  const collection = coll(collectionId);
  if (!collection?.letters[letter]) return null;
  const patch = {
    id: uid(),
    kind: 'letter',
    letter,
    collectionId: collection.id,
    view,
    x,
    y,
    size,
    rotation: 0
  };
  S.patches.push(patch);
  S.selected = patch.id;
  return patch;
}

function createName() {
  const raw = D.name.value.trim().toUpperCase();
  if (!raw) {
    toast('Escribe un nombre o agrega letras una por una.');
    return;
  }

  const clean = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!clean) {
    toast('Usa letras de la A a la Z para crear el nombre.');
    return;
  }

  const collection = coll();
  const view = S.view;
  const anchor = letterAnchor(view);
  const chars = [...clean];
  // Nombre compacto y ordenado para que quede en la franja superior,
  // no desbordado hacia los hombros.
  const maxWidth = view === 'back' ? 560 : 520;
  const gap = 7;
  const base = Math.min(62, Math.max(42, (maxWidth - gap * (chars.length - 1)) / Math.max(chars.length, 1)));
  const step = base * .76 + gap;
  let total = chars.reduce((sum, char) => sum + (char === ' ' ? step * .65 : step), 0) - gap;
  let x = anchor.x - total / 2;
  let created = 0;

  chars.forEach(char => {
    if (char === ' ') {
      x += step * .65;
      return;
    }
    if (collection.letters[char]) {
      addLetter(char, view, x + step / 2, anchor.y, base, collection.id);
      created++;
    }
    x += step;
  });

  if (!created) {
    toast('No encontré letras compatibles en esta colección.');
    return;
  }

  S.designName = clean;
  D.name.blur();
  render();
  setTimeout(() => {
    D.stage.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 80);
  toast(`${created} letras agregadas en ${viewLabel(view)}.`);
}

function viewLabel(view) { return view === 'front' ? 'el frente' : 'la espalda'; }

function point(event) {
  const rect = D.svg.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) / rect.width * VB.w,
    y: (event.clientY - rect.top) / rect.height * VB.h,
    clientX: event.clientX,
    clientY: event.clientY
  };
}

function isDesktopEditor() {
  return window.matchMedia('(min-width: 721px)').matches;
}

function distance(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function angle(a, b) {
  return Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
}

function center(a, b) {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    clientX: (a.clientX + b.clientX) / 2,
    clientY: (a.clientY + b.clientY) / 2
  };
}

function getPatch(id) {
  return S.patches.find(item => item.id === id);
}

function down(event) {
  const id = event.currentTarget.dataset.id;
  const patch = getPatch(id);
  if (!patch) return;

  // Primer toque: selecciona. No bloquea la página ni muestra la caneca todavía.
  // El arrastre empieza solo si el dedo se mueve lo suficiente.
  event.stopPropagation();

  const position = point(event);
  S.selected = id;
  S.draggedSinceDown = false;
  S.dragStarted = false;
  S.dragStartClient = { clientX: event.clientX, clientY: event.clientY };
  S.trashHot = false;

  if (!S.gesture || S.gesture.id !== id) {
    S.pointers.clear();
  }
  S.pointers.set(event.pointerId, position);

  startGestureForSelected(id, event.pointerId);
  showTrash(false, false);

  try { D.svg.setPointerCapture(event.pointerId); } catch {}

  // Mostramos selección/controles sin mover todavía.
  renderItems();
  renderSummary();
}

function startGestureForSelected(id, primaryPointerId) {
  const patch = getPatch(id);
  if (!patch) return;

  const entries = [...S.pointers.entries()];

  if (entries.length >= 2) {
    const first = entries[0][1];
    const second = entries[1][1];
    const c = center(first, second);
    S.gesture = {
      mode: 'transform',
      id,
      startX: patch.x,
      startY: patch.y,
      startSize: patch.size,
      startRotation: patch.rotation,
      startDistance: Math.max(distance(first, second), 1),
      startAngle: angle(first, second),
      startCenter: c
    };
    return;
  }

  const current = S.pointers.get(primaryPointerId);
  S.gesture = {
    mode: 'move',
    id,
    pointerId: primaryPointerId,
    dx: current.x - patch.x,
    dy: current.y - patch.y
  };
}

function move(event) {
  if (!S.gesture || !S.pointers.has(event.pointerId)) return;

  const patch = getPatch(S.gesture.id);
  if (!patch) return;

  const nextPoint = point(event);

  // Si aún no hay arrastre real, no bloqueamos la página. Un toque corto solo selecciona.
  if (!S.dragStarted && S.pointers.size < 2) {
    const origin = S.dragStartClient || { clientX: event.clientX, clientY: event.clientY };
    const moved = Math.hypot(event.clientX - origin.clientX, event.clientY - origin.clientY);
    if (moved < S.dragThreshold) {
      S.pointers.set(event.pointerId, nextPoint);
      return;
    }
    S.dragStarted = true;
    S.draggedSinceDown = true;
    showTrash(true, false);
    if (!S.pageLocked) lockPageWhileDragging(true);
  }

  // Con dos dedos se entra inmediatamente en transformación.
  if (S.pointers.size >= 2 && !S.dragStarted) {
    S.dragStarted = true;
    S.draggedSinceDown = true;
    showTrash(false, false);
    if (!S.pageLocked) lockPageWhileDragging(true);
  }

  event.preventDefault();
  event.stopPropagation();

  S.pointers.set(event.pointerId, nextPoint);

  if (S.pointers.size >= 2) {
    if (S.gesture.mode !== 'transform') startGestureForSelected(patch.id, event.pointerId);
    applyTransformGesture(patch);
    showTrash(false, false);
  } else {
    if (S.gesture.mode !== 'move') startGestureForSelected(patch.id, event.pointerId);
    applyMoveGesture(patch, event.pointerId);
    updateTrashHot(currentClientPoint());
  }

  S.draggedSinceDown = true;
  updateRenderedPatch(patch);
  renderSummary();
}


function updateRenderedPatch(patch) {
  const group = D.items.querySelector(`[data-id="${patch.id}"]`);
  if (!group) {
    renderItems();
    return;
  }

  const path = imgPath(patch);
  if (!path) return;
  const size = sizeOf(path, patch.size);

  group.setAttribute('transform', `translate(${patch.x} ${patch.y}) rotate(${patch.rotation})`);

  const outline = group.querySelector('.selection-outline');
  if (outline) {
    outline.setAttribute('x', -size.w / 2 - 10);
    outline.setAttribute('y', -size.h / 2 - 10);
    outline.setAttribute('width', size.w + 20);
    outline.setAttribute('height', size.h + 20);
  }

  const image = group.querySelector('.patch-image');
  if (image) {
    image.setAttribute('x', -size.w / 2);
    image.setAttribute('y', -size.h / 2);
    image.setAttribute('width', size.w);
    image.setAttribute('height', size.h);
  }

  const hit = group.querySelector('.hit-rect');
  if (hit) {
    hit.setAttribute('x', -size.w / 2 - 22);
    hit.setAttribute('y', -size.h / 2 - 22);
    hit.setAttribute('width', size.w + 44);
    hit.setAttribute('height', size.h + 44);
  }
}

function applyMoveGesture(patch, pointerId) {
  const current = S.pointers.get(pointerId);
  if (!current || !S.gesture) return;
  patch.x = clamp(current.x - S.gesture.dx, 20, VB.w - 20);
  patch.y = clamp(current.y - S.gesture.dy, 20, VB.h - 20);
}

function applyTransformGesture(patch) {
  const points = [...S.pointers.values()];
  if (points.length < 2 || !S.gesture) return;

  const first = points[0];
  const second = points[1];
  const c = center(first, second);
  const scale = distance(first, second) / Math.max(S.gesture.startDistance, 1);
  const rotationDelta = angle(first, second) - S.gesture.startAngle;
  const min = patch.kind === 'letter' ? 28 : 70;
  const max = patch.kind === 'letter' ? 120 : 360;

  patch.size = clamp(S.gesture.startSize * scale, min, max);
  patch.rotation = (S.gesture.startRotation + rotationDelta + 360) % 360;
  patch.x = clamp(S.gesture.startX + (c.x - S.gesture.startCenter.x), 20, VB.w - 20);
  patch.y = clamp(S.gesture.startY + (c.y - S.gesture.startCenter.y), 20, VB.h - 20);
}

function currentClientPoint() {
  const points = [...S.pointers.values()];
  if (!points.length) return null;
  if (points.length === 1) return points[0];
  return center(points[0], points[1]);
}

function up(event) {
  if (!S.gesture) return;

  const endedPoint = S.pointers.get(event.pointerId) || point(event);
  const activeId = S.gesture.id;
  const wasDragging = S.dragStarted || S.pointers.size >= 2;

  if (wasDragging) {
    event.preventDefault();
    event.stopPropagation();
  }

  try { D.svg.releasePointerCapture(event.pointerId); } catch {}
  S.pointers.delete(event.pointerId);

  if (S.pointers.size >= 1) {
    startGestureForSelected(activeId, [...S.pointers.keys()][0]);
    renderSummary();
    return;
  }

  const shouldDelete = wasDragging && (isPointInTrash(endedPoint) || S.trashHot);
  S.gesture = null;
  S.pointers.clear();
  S.dragStarted = false;
  S.dragStartClient = null;
  lockPageWhileDragging(false);
  showTrash(false, false);

  if (shouldDelete) {
    S.patches = S.patches.filter(item => item.id !== activeId);
    S.selected = null;
    render();
    toast('Detalle eliminado.');
    return;
  }

  // Si fue toque corto, solo queda seleccionado.
  renderItems();
  renderSummary();
}


function preventTouchScrollWhileDragging(event) {
  if (S.gesture && S.dragStarted) event.preventDefault();
}

function lockPageWhileDragging(lock) {
  document.documentElement.classList.toggle('dragging-patch', lock);
  document.body.classList.toggle('dragging-patch', lock);

  if (lock) {
    if (S.pageLocked) return;
    S.pageLocked = true;
    S.scrollLockY = window.scrollY || window.pageYOffset || 0;

    // Bloqueo real solo durante el arrastre: impide que el navegador suba
    // o baje mientras el usuario está acomodando una letra/parche. Al soltar,
    // se restaura la posición exacta de scroll. La caneca es fija, así que
    // sigue siendo alcanzable.
    document.body.style.position = 'fixed';
    document.body.style.top = `-${S.scrollLockY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
    return;
  }

  if (!S.pageLocked) return;
  const y = S.scrollLockY || 0;
  S.pageLocked = false;
  document.body.style.position = '';
  document.body.style.top = '';
  document.body.style.left = '';
  document.body.style.right = '';
  document.body.style.width = '';
  window.scrollTo(0, y);
}

function showTrash(show, hot) {
  if (!D.trash) return;
  D.trash.classList.toggle('visible', show);
  D.trash.classList.toggle('hot', hot);
  D.trash.querySelector('.trash-copy').textContent = hot ? 'Suelta para eliminar' : 'Arrastra aquí para eliminar';
  S.trashHot = hot;
}

function updateTrashHot(clientPoint) {
  const hot = isPointInTrash(clientPoint);
  showTrash(true, hot);
}

function isPointInTrash(clientPoint) {
  if (!D.trash || !clientPoint) return false;
  const rect = D.trash.getBoundingClientRect();
  const margin = window.matchMedia('(max-width: 720px)').matches ? 70 : 28;
  return clientPoint.clientX >= rect.left - margin &&
    clientPoint.clientX <= rect.right + margin &&
    clientPoint.clientY >= rect.top - margin &&
    clientPoint.clientY <= rect.bottom + margin;
}


function cancelActiveGesture() {
  if (!S.gesture) return;
  S.gesture = null;
  S.pointers.clear();
  S.dragStarted = false;
  S.dragStartClient = null;
  lockPageWhileDragging(false);
  showTrash(false, false);
  renderItems();
  renderSummary();
}

function bgClick(event) {
  if (event.target.closest && event.target.closest('.node')) return;
  S.selected = null;
  render();
}

function selected() { return S.patches.find(patch => patch.id === S.selected); }

function resize(delta) {
  const patch = selected();
  if (!patch) return;
  const max = patch.kind === 'letter' ? 120 : 320;
  const min = patch.kind === 'letter' ? 28 : 70;
  patch.size = clamp(patch.size + delta, min, max);
  render();
}

function rotate(delta) {
  const patch = selected();
  if (!patch) return;
  patch.rotation = (patch.rotation + delta + 360) % 360;
  render();
}

function duplicate() {
  const patch = selected();
  if (!patch) return;
  const copy = { ...patch, id: uid(), x: patch.x + 28, y: patch.y + 28 };
  S.patches.push(copy);
  S.selected = copy.id;
  render();
}

function del() {
  const patch = selected();
  if (!patch) return;
  S.patches = S.patches.filter(item => item.id !== patch.id);
  S.selected = null;
  render();
}

function layer(direction) {
  const index = S.patches.findIndex(patch => patch.id === S.selected);
  if (index < 0) return;
  const [patch] = S.patches.splice(index, 1);
  direction === 'front' ? S.patches.push(patch) : S.patches.unshift(patch);
  render();
}

function otherView() {
  const patch = selected();
  if (!patch) return;
  patch.view = patch.view === 'front' ? 'back' : 'front';
  S.view = patch.view;
  render();
}

function renderSummary() {
  if (!S.patches.length) {
    if (D.summary) {
      D.summary.hidden = true;
      D.summary.textContent = '';
    }
    return;
  }

  const frontCount = S.patches.filter(patch => patch.view === 'front').length;
  const backCount = S.patches.filter(patch => patch.view === 'back').length;
  const current = selected();
  const editing = current ? nameOf(current) : `la vista ${S.view === 'front' ? 'frontal' : 'trasera'}`;

  if (D.summary) {
    D.summary.hidden = true;
    D.summary.innerHTML = `Tu chaqueta tiene <strong>${S.patches.length}</strong> detalles: <strong>${frontCount}</strong> al frente y <strong>${backCount}</strong> en la espalda. Ahora estás editando: <strong>${esc(editing)}</strong>.`;
  }
}

function clearAll() {
  if (!S.patches.length) {
    toast('El diseño ya está limpio.');
    return;
  }

  if (confirm('¿Empezar de nuevo y borrar toda la personalización?')) {
    S.patches = [];
    S.selected = null;
    S.designName = '';
    render();
    toast('Listo. Puedes empezar un nuevo diseño.');
  }
}

function orderText() {
  const frontCount = S.patches.filter(patch => patch.view === 'front').length;
  const backCount = S.patches.filter(patch => patch.view === 'back').length;
  const name = S.designName || D.name.value.trim().toUpperCase() || '[NOMBRE]';

  return [
    'Hola, Paz Kids. Acabo de crear un diseño único para una chaqueta personalizada y me gustaría conocer el precio de este diseño tan especial.',
    '',
    `Voy a adjuntar la imagen descargada para que puedan revisarlo. Tiene ${frontCount} detalles en el frente y ${backCount} en la espalda. Es para ${name}.`,
    '',
    '¿Me ayudan por favor a confirmar talla, precio, disponibilidad y tiempo de elaboración?'
  ].join('\n');
}

function whatsapp() {
  if (!S.patches.length) {
    toast('Primero agrega letras o parches.');
    return;
  }
  window.open(`https://wa.me/${S.cat.brand.whatsappNumber}?text=${encodeURIComponent(orderText())}`, '_blank', 'noopener,noreferrer');
}

async function download() {
  if (!S.patches.length) {
    toast('Primero crea un diseño para guardar las imágenes.');
    return;
  }

  const originalView = S.view;
  S.selected = null;
  toast('Preparando imágenes de espalda y frente...');

  try {
    // Generamos primero ambas imágenes y después disparamos las descargas.
    // En celulares algunos navegadores bloquean la segunda descarga automática;
    // por eso dejamos también botones manuales de respaldo.
    const backBlob = await exportViewBlob('back');
    const frontBlob = await exportViewBlob('front');

    S.view = originalView;
    render();

    const downloads = [
      { blob: backBlob, filename: 'pazkids-chaqueta-espalda.png', label: 'Descargar espalda' },
      { blob: frontBlob, filename: 'pazkids-chaqueta-frente.png', label: 'Descargar frente' }
    ];

    triggerDownload(downloads[0].blob, downloads[0].filename);
    setTimeout(() => triggerDownload(downloads[1].blob, downloads[1].filename), 180);
    showDownloadFallback(downloads);

    toast('Se generaron frente y espalda. Si el celular bloqueó una, usa los botones de respaldo.');
  } catch (error) {
    console.error(error);
    S.view = originalView;
    render();
    toast('No pude guardar las imágenes. Intenta de nuevo.');
  }
}

async function exportViewBlob(view) {
  S.view = view;
  const used = [S.cat.jackets[view], ...S.patches.filter(patch => patch.view === view).map(imgPath)];
  await ensureCached(used);
  render();
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  const clone = D.svg.cloneNode(true);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', '1080');
  clone.setAttribute('height', '1350');
  clone.setAttribute('viewBox', '0 0 810 1012');

  const blob = new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  try {
    const image = await loadImg(url);
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1350;

    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 1080, 1350);
    gradient.addColorStop(0, '#d8f4f3');
    gradient.addColorStop(.58, '#f9e9da');
    gradient.addColorStop(1, '#f7cbd5');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    return await new Promise((resolve, reject) => {
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('No se pudo generar PNG')), 'image/png', .95);
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function exportView(view) {
  const blob = await exportViewBlob(view);
  triggerDownload(blob, `pazkids-chaqueta-${view === 'front' ? 'frente' : 'espalda'}.png`);
}

function triggerDownload(blob, filename) {
  const downloadUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(downloadUrl), 2000);
}

function showDownloadFallback(downloads) {
  window.pazKidsDownloadUrls = window.pazKidsDownloadUrls || [];
  window.pazKidsDownloadUrls.forEach(url => URL.revokeObjectURL(url));
  window.pazKidsDownloadUrls = [];

  let panel = document.querySelector('#downloadFallback');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'downloadFallback';
    panel.className = 'download-fallback';
    const actions = document.querySelector('.actions');
    actions?.insertAdjacentElement('afterend', panel);
  }

  panel.innerHTML = '';
  const title = document.createElement('p');
  title.textContent = 'Si tu celular bloqueó una descarga, guarda cada imagen aquí:';
  panel.appendChild(title);

  const row = document.createElement('div');
  row.className = 'download-fallback-row';

  downloads.forEach(({ blob, filename, label }) => {
    const url = URL.createObjectURL(blob);
    window.pazKidsDownloadUrls.push(url);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.textContent = label;
    row.appendChild(link);
  });

  panel.appendChild(row);
  panel.hidden = false;
}

function wait(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function loadImg(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
}

function bind() {
  D.front.onclick = () => {
    S.view = 'front';
    S.selected = null;
    render();
  };

  D.back.onclick = () => {
    S.view = 'back';
    S.selected = null;
    render();
  };

  D.collection.onchange = () => {
    S.activeColl = D.collection.value;
    renderLetterPreview();
  };

  D.name.oninput = () => {
    D.name.value = D.name.value.toUpperCase();
  };

  $('#createName').onclick = createName;
  D.name.onkeydown = event => {
    if (event.key === 'Enter') createName();
  };

  if (D.controlsToggle) {
    D.controlsToggle.onclick = () => {
      S.controlsOpen = !D.controls.classList.contains('open');
      D.controls.classList.toggle('open', S.controlsOpen);
      D.controlsToggle.setAttribute('aria-expanded', S.controlsOpen ? 'true' : 'false');
    };
  }

  document.addEventListener('pointermove', move, { passive: false });
  document.addEventListener('pointerup', up, { passive: false });
  document.addEventListener('pointercancel', up, { passive: false });
  D.svg.addEventListener('click', bgClick);
  document.addEventListener('touchmove', preventTouchScrollWhileDragging, { passive: false });
  window.addEventListener('blur', cancelActiveGesture);
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancelActiveGesture(); });

  $('#smaller').onclick = () => resize(selected()?.kind === 'letter' ? -8 : -16);
  $('#bigger').onclick = () => resize(selected()?.kind === 'letter' ? 8 : 16);
  $('#rotL').onclick = () => rotate(-15);
  $('#rotR').onclick = () => rotate(15);
  $('#dup').onclick = duplicate;
  $('#frontLayer').onclick = () => layer('front');
  $('#backLayer').onclick = () => layer('back');
  $('#otherView').onclick = otherView;
  $('#del').onclick = del;
  if (D.clearTop) D.clearTop.onclick = clearAll;
  $('#whatsapp').onclick = whatsapp;
  $('#download').onclick = download;
}

init();
