'use strict';

const VB = { w: 810, h: 1012 };

const S = {
  cat: null,
  view: 'front',
  patches: [],
  selected: null,
  counter: 1,
  drag: null,
  activeCat: null,
  activeColl: null,
  designName: '',
  cache: new Map(),
  meta: new Map()
};

const D = {
  logo: $('#brandLogo'),
  svg: $('#svg'),
  jacket: $('#jacket'),
  items: $('#items'),
  front: $('#frontBtn'),
  back: $('#backBtn'),
  controls: $('#controls'),
  collection: $('#collection'),
  letterPreview: $('#letterPreview'),
  name: $('#name'),
  tabs: $('#tabs'),
  grid: $('#patchGrid'),
  summary: $('#summary'),
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
    S.activeCat = patchCategories()[0] || null;
    D.logo.src = S.cat.brand.logo;

    bind();
    renderSelectors();
    renderLetterPreview();
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
function patchCategories() { return [...new Set(S.cat.patches.map(patch => patch.categoria))]; }

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
      group.appendChild(outline);
    }

    const image = E('image');
    image.setAttribute('href', src(path));
    image.setAttribute('x', -size.w / 2);
    image.setAttribute('y', -size.h / 2);
    image.setAttribute('width', size.w);
    image.setAttribute('height', size.h);
    image.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    group.appendChild(image);

    const hit = E('rect');
    hit.setAttribute('x', -size.w / 2 - 18);
    hit.setAttribute('y', -size.h / 2 - 18);
    hit.setAttribute('width', size.w + 36);
    hit.setAttribute('height', size.h + 36);
    hit.setAttribute('rx', '18');
    hit.setAttribute('fill', 'transparent');
    group.appendChild(hit);

    group.addEventListener('pointerdown', down);
    D.items.appendChild(group);
  });

  D.controls.hidden = !selected();
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
      addLetter(letter, S.view, 405, S.view === 'front' ? 590 : 560, collection.defaultSize || 62, collection.id);
      render();
      toast(`Letra ${letter} agregada en ${viewLabel(S.view)}.`);
    }, 'letter-card'));
  });
}

function renderCats() {
  D.tabs.innerHTML = '';
  patchCategories().forEach(category => {
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
    .filter(patch => patch.categoria === S.activeCat)
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

function addCatalog(id) {
  const catalogItem = item(id);
  if (!catalogItem) return;
  const numberInView = S.patches.filter(patch => patch.view === S.view).length;
  const patch = {
    id: uid(),
    kind: 'patch',
    catalogId: id,
    view: S.view,
    x: clamp(405 + (numberInView % 5) * 18 - 36, 70, 740),
    y: clamp(590 + (numberInView % 7) * 16 - 48, 90, 930),
    size: catalogItem.defaultSize || 190,
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
  const chars = [...clean];
  const maxWidth = 650;
  const gap = 10;
  const base = Math.min(68, Math.max(44, (maxWidth - gap * (chars.length - 1)) / Math.max(chars.length, 1)));
  const step = base * .82 + gap;
  let total = chars.reduce((sum, char) => sum + (char === ' ' ? step * .65 : step), 0) - gap;
  let x = 405 - total / 2;
  let created = 0;

  chars.forEach(char => {
    if (char === ' ') {
      x += step * .65;
      return;
    }
    if (collection.letters[char]) {
      addLetter(char, view, x + step / 2, view === 'front' ? 590 : 560, base, collection.id);
      created++;
    }
    x += step;
  });

  if (!created) {
    toast('No encontré letras compatibles en esta colección.');
    return;
  }

  S.designName = clean;
  render();
  toast(`${created} letras agregadas en ${viewLabel(view)}.`);
}

function viewLabel(view) { return view === 'front' ? 'el frente' : 'la espalda'; }

function point(event) {
  const rect = D.svg.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) / rect.width * VB.w,
    y: (event.clientY - rect.top) / rect.height * VB.h
  };
}

function down(event) {
  event.preventDefault();
  event.stopPropagation();

  const id = event.currentTarget.dataset.id;
  const patch = S.patches.find(item => item.id === id);
  if (!patch) return;

  const position = point(event);
  S.selected = id;
  S.drag = {
    id,
    pointerId: event.pointerId,
    dx: position.x - patch.x,
    dy: position.y - patch.y
  };

  lockPageWhileDragging(true);

  try { D.svg.setPointerCapture(event.pointerId); } catch {}
  render();
}

function move(event) {
  if (!S.drag) return;
  event.preventDefault();
  event.stopPropagation();

  const patch = S.patches.find(item => item.id === S.drag.id);
  if (!patch) return;

  const position = point(event);
  patch.x = clamp(position.x - S.drag.dx, 20, VB.w - 20);
  patch.y = clamp(position.y - S.drag.dy, 20, VB.h - 20);
  renderItems();
  renderSummary();
}

function up(event) {
  if (!S.drag) return;
  try { D.svg.releasePointerCapture(S.drag.pointerId); } catch {}
  S.drag = null;
  lockPageWhileDragging(false);
  renderSummary();
}

function preventTouchScrollWhileDragging(event) {
  if (S.drag) event.preventDefault();
}

function lockPageWhileDragging(lock) {
  document.documentElement.classList.toggle('dragging-patch', lock);
  document.body.classList.toggle('dragging-patch', lock);
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
    D.summary.textContent = 'Aún no has agregado parches.';
    return;
  }

  const frontCount = S.patches.filter(patch => patch.view === 'front').length;
  const backCount = S.patches.filter(patch => patch.view === 'back').length;
  const current = selected();
  const editing = current ? nameOf(current) : `la vista ${S.view === 'front' ? 'frontal' : 'trasera'}`;

  D.summary.innerHTML = `Tu chaqueta tiene <strong>${S.patches.length}</strong> detalles: <strong>${frontCount}</strong> al frente y <strong>${backCount}</strong> en la espalda. Ahora estás editando: <strong>${esc(editing)}</strong>.`;
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
  S.selected = null;
  const used = [S.cat.jackets[S.view], ...S.patches.filter(patch => patch.view === S.view).map(imgPath)];
  toast('Preparando imagen para guardar...');
  await ensureCached(used);
  render();
  await new Promise(resolve => requestAnimationFrame(resolve));

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

    const png = await new Promise(resolve => canvas.toBlob(resolve, 'image/png', .95));
    const downloadUrl = URL.createObjectURL(png);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `pazkids-chaqueta-${S.view}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
    toast('Imagen guardada. Adjunta ese archivo en WhatsApp.');
  } catch (error) {
    console.error(error);
    toast('No pude guardar la imagen.');
  } finally {
    URL.revokeObjectURL(url);
  }
}

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

  D.svg.addEventListener('pointermove', move);
  D.svg.addEventListener('pointerup', up);
  D.svg.addEventListener('pointercancel', up);
  D.svg.addEventListener('click', bgClick);
  document.addEventListener('touchmove', preventTouchScrollWhileDragging, { passive: false });

  $('#smaller').onclick = () => resize(selected()?.kind === 'letter' ? -8 : -16);
  $('#bigger').onclick = () => resize(selected()?.kind === 'letter' ? 8 : 16);
  $('#rotL').onclick = () => rotate(-15);
  $('#rotR').onclick = () => rotate(15);
  $('#dup').onclick = duplicate;
  $('#frontLayer').onclick = () => layer('front');
  $('#backLayer').onclick = () => layer('back');
  $('#otherView').onclick = otherView;
  $('#del').onclick = del;
  $('#clear').onclick = clearAll;
  $('#whatsapp').onclick = whatsapp;
  $('#download').onclick = download;
}

init();
