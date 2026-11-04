(() => {
  const $ = s => document.querySelector(s);
  const setZ = () => document.documentElement.style.setProperty('--z', innerWidth / 1728);
  setZ(); addEventListener('resize', setZ);

  const PIN = id => `<svg viewBox="0 0 42 63" aria-hidden="true"><path d="M21 61.54c9.02 0 16.33-3.61 16.33-8.07S30.02 45.41 21 45.41 4.67 49.02 4.67 53.47 11.98 61.54 21 61.54Z" fill="url(#pg-${id})"/><path class="body" d="M42 20.74C42 29.3 31.5 41.49 22.94 53.01c-1.13 1.54-2.75 1.54-3.89 0C10.5 41.49 0 29.53 0 20.74 0 9.28 9.4 0 21 0s21 9.28 21 20.74Z" fill="currentColor"/><path d="M21 29.2c4.73 0 8.56-3.79 8.56-8.46S25.73 12.29 21 12.29s-8.56 3.79-8.56 8.45S16.27 29.2 21 29.2Z" fill="#fff"/><defs><radialGradient id="pg-${id}" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(21 53.47) scale(16.33 8.07)"><stop offset=".1" stop-opacity=".4"/><stop offset="1" stop-opacity=".05"/></radialGradient></defs></svg>`;
  let DATA, byId = {}, map, markers = {}, selected = null;
  const ready = fetch('data/landmarks.json').then(r => r.json()).then(d => {
    DATA = d; d.landmarks.forEach(l => byId[l.id] = l);
    $('#listItems').innerHTML = d.landmarks.map(l => `<li><button data-id="${l.id}"><span class="dot" style="background:${l.color}"></span>${l.name}</button></li>`).join('');
  });

  /* ---------- Routing ---------- */
  const route = () => decodeURIComponent(location.hash.slice(1));
  const parent = r => r === '' ? '' : r === 'map' || r === 'info' || r === 'intro' ? (r === 'map' ? '' : '') :
    r.startsWith('map/') ? 'map' : byId[r] ? 'map/' + r : '';
  const go = r => { const h = r ? '#' + r : ''; if (location.hash === h || (!r && !location.hash)) return render(); location.hash = h || '#'; };

  const setNav = el => document.documentElement.style.setProperty('--nav', (el && el.dataset.nav) || '#93a07f');
  function show(id) {
    if (id !== 'v-detail' && id !== 'v-info') setNav(null);
    document.querySelectorAll('.view').forEach(v => v.classList.toggle('on', v.id === id));
  }
  /* ---------- Frame transitions: "traveling" to a site and back in time ---------- */
  const sleep = t => new Promise(r => setTimeout(r, t));
  const warp = $('#warp');
  const veil = async (on, ms) => { warp.style.transitionDuration = ms + 'ms'; warp.classList.toggle('on', on); await sleep(ms); };
  let prev = null, busy = Promise.resolve();
  function render() { return (busy = busy.then(renderNow, renderNow)); }
  async function renderNow() {
    await ready;
    const r = route(), from = prev; prev = r;
    const isMap = x => x === 'map' || (x || '').startsWith('map/');
    if (isMap(r)) {
      const id = r.slice(4), back = from && byId[from];
      if (!isMap(from) && !back) await veil(true, 500);
      if (back) await veil(true, 700);
      show('v-map'); initMap(); map.resize();
      if (back) {                                   // returning from the past: rise out of the site
        const l = byId[from]; map.jumpTo({ center: [l.longitude, l.latitude], zoom: l.zoom + 2.4, pitch: 60, bearing: -25 });
      }
      byId[id] ? select(id, !!back) : reset();
      if (!isMap(from) || back) await veil(false, back ? 1400 : 700);
    } else if (byId[r]) {
      const l = byId[r];
      if (isMap(from) && map) {                     // travel: dive into the site, fade to sepia, arrive in the past
        $('#card').classList.add('dive');
        map.flyTo({ center: [l.longitude, l.latitude], zoom: l.zoom + 2.4, pitch: 60, bearing: -25, duration: 2200, easing: t => t * t * t, essential: true });
        await sleep(1100); await veil(true, 1100);
      } else await veil(true, 500);
      show('v-detail'); setSelected(r);
      await loadDetail(l); scrollTo(0, 0);
      const d = $('#detail'); d.classList.remove('arrive'); void d.offsetWidth; d.classList.add('arrive');
      await veil(false, 1300); $('#card').classList.remove('dive');
    } else {
      await veil(true, 500);
      if (r === 'info') {
        show('v-info'); const box = $('#infoBox');
        if (!box.dataset.ok) { box.innerHTML = await fetch('pages/info.html').then(r => r.text()); box.dataset.ok = 1; }
        setNav(box.firstElementChild); renderSources(); scrollTo(0, 0);
      } else { show('v-start'); if (r !== 'intro') scrollTo(0, 0); }
      await veil(false, 700);
    }
  }
  addEventListener('hashchange', render);
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-go]'); if (b) { e.preventDefault(); go(b.dataset.go); }
    const li = e.target.closest('#listItems [data-id]'); if (li) go('map/' + li.dataset.id);
  });
  $('#backBtn').onclick = () => go(parent(route()));
  $('.down').onclick = e => { e.preventDefault(); $('#intro').scrollIntoView({ behavior: 'smooth' }); };

  /* ---------- Map ---------- */
  function initMap() {
    if (map) return;
    mapboxgl.accessToken = IH_CONFIG.token;
    map = new mapboxgl.Map({ container: 'map', style: IH_CONFIG.style, center: DATA.home.center, zoom: DATA.home.zoom, attributionControl: true });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
    DATA.landmarks.forEach(l => {
      const el = document.createElement('button');
      el.className = 'mk'; el.setAttribute('aria-label', `${l.name} — select landmark`);
      el.style.color = l.color;
      el.innerHTML = `<span class="pin">${PIN(l.id)}</span><span class="lbl">${l.name}</span>`;
      el.onclick = e => { e.stopPropagation(); go('map/' + l.id); };
      markers[l.id] = new mapboxgl.Marker({ element: el, anchor: 'bottom' }).setLngLat([l.longitude, l.latitude]).addTo(map);
    });
  }
  function setSelected(id) {
    selected = id;
    Object.entries(markers).forEach(([k, m]) => {
      const el = m.getElement(); el.classList.toggle('sel', k === id);
      k === id ? el.setAttribute('aria-current', 'true') : el.removeAttribute('aria-current');
    });
    document.querySelectorAll('#listItems [data-id]').forEach(b => b.dataset.id === id ? b.setAttribute('aria-current', 'true') : b.removeAttribute('aria-current'));
  }
  function camera(opts) {
    const from = map.getCenter(), d = Math.hypot(from.lng - opts.center[0], from.lat - opts.center[1]);
    // slow, arcing flight (zooms out, then in) so the move reads as a journey across the city
    const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const duration = opts.duration || Math.min(5200, 2800 + d * 9000);
    map.flyTo({ pitch: 0, bearing: 0, ...opts, duration, curve: 1.7, easing: ease, essential: true });
    return duration;
  }
  let cardTimer;
  function select(id, back) {
    const l = byId[id]; setSelected(id); hideCard(); clearTimeout(cardTimer);
    const z = innerWidth / 1728;
    const dur = camera({ center: [l.longitude, l.latitude], zoom: l.zoom, offset: [(l.card.w * 0.36 + 0) * z, 0], duration: back ? 2600 : 0 });
    cardTimer = setTimeout(() => renderCard(l), dur * 0.72);   // preview appears as the camera lands
  }
  function reset() {
    setSelected(null); hideCard(); clearTimeout(cardTimer);
    const b = new mapboxgl.LngLatBounds(); DATA.landmarks.forEach(l => b.extend([l.longitude, l.latitude]));
    const z = innerWidth / 1728, c = map.cameraForBounds(b, { padding: { top: 220 * z, bottom: 60 * z, left: 80 * z, right: 420 * z } });
    camera({ center: c.center.toArray ? c.center.toArray() : [c.center.lng, c.center.lat], zoom: c.zoom, offset: [0, 0] });
  }

  /* ---------- Travel card ---------- */
  const imgLayer = (src, crop, fit, alt = '') => crop
    ? `<img src="${src}" alt="${alt}" style="left:${crop[0]}%;top:${crop[1]}%;width:${crop[2]}%;height:${crop[3]}%">`
    : `<img src="${src}" alt="${alt}" style="inset:0;width:100%;height:100%;object-fit:${fit || 'cover'}">`;
  function layer(L) {
    const [x, y, w, h] = L.box;
    const inner = L.inner
      ? `<div style="position:absolute;left:50%;top:50%;width:${L.inner[0]}px;height:${L.inner[1]}px;transform:translate(-50%,-50%) rotate(${L.rot}deg);${L.color ? 'background:' + L.color : ''}">${L.src ? `<img src="${L.src}" alt="" style="width:100%;height:100%;object-fit:cover;display:block">` : ''}</div>`
      : L.src ? imgLayer(L.src, L.crop) : '';
    return `<div class="ly" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px;${!L.inner && L.color ? 'background:' + L.color : ''};${L.inner ? 'overflow:visible' : ''}">${inner}</div>`;
  }
  function renderCard(l) {
    const c = l.card, el = $('#card');
    const top = 133 + (1117 - 133 - c.h) / 2;
    const hist = c.hist ? (c.hist.box ? layer(c.hist) : `<div class="ly" style="inset:0">${imgLayer(c.hist.src, c.hist.crop, c.hist.fit)}</div>`) : '';
    el.className = 'card z' + (c.border ? ' border' : '');
    el.style.cssText = `top:${top}px;width:${c.w}px;height:${c.h}px`;
    el.setAttribute('role', 'link'); el.tabIndex = 0;
    el.setAttribute('aria-label', `Travel to ${l.name}`);
    el.innerHTML =
      (c.photo ? `<div class="ly" style="inset:0">${imgLayer(c.photo.src, c.photo.crop, null, c.alt)}</div>` : '') +
      (c.layers || []).map(layer).join('') +
      `<div class="tex"></div>` +
      `<div class="hov">${hist ? `<div style="position:absolute;inset:0;opacity:${c.hist.op}">${hist}</div>` : ''}${c.tint ? `<div style="position:absolute;inset:0;background:${c.tint}"></div>` : ''}<span class="go">Travel Here</span></div>`;
    el.hidden = false; requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('show')));
    el.onclick = () => go(l.id);
    el.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(l.id); } };
  }
  function hideCard() { const el = $('#card'); el.classList.remove('show'); el.hidden = true; }

  /* ---------- Detail pages (hardcoded Figma renders in pages/<id>.html) ---------- */
  const cache = {};
  async function loadDetail(l) {
    const box = $('#detail');
    if (box.dataset.id === l.id) return;
    box.innerHTML = cache[l.id] || (cache[l.id] = await fetch(`pages/${l.id}.html`).then(r => r.ok ? r.text() : `<div class="pad"><h1>${l.name}</h1></div>`));
    box.dataset.id = l.id;
    setNav(box.firstElementChild);
    box.querySelectorAll('.carousel').forEach(c => initCarousel(c, l));
    box.querySelectorAll('.exp').forEach(b => initExp(b, l));
    initImgs(box, l);
  }
  function initCarousel(c, l) {
    const strip = c.querySelector('.strip'), frames = [...strip.children];
    const px = (el, k) => parseFloat(getComputedStyle(el)[k]) || 0, s = px(c, 'width') / 7185, step = px(frames[1], 'left') - px(frames[0], 'left');
    c.style.setProperty('--ab', 48 * s + 'px'); c.style.setProperty('--at', 376 * s + 'px'); c.style.setProperty('--an', 1115 * s + 'px');
    c.style.setProperty('--cl', 0); c.style.setProperty('--ct', 843 * s + 'px'); c.style.setProperty('--cw', 1163 * s + 'px');
    const caps = (l.photos || []), cap = c.querySelector('.car-cap'), prev = c.querySelector('.prev'), next = c.querySelector('.next');
    frames.forEach((f, k) => { const im = f.querySelector('img'); if (im) im.alt = (caps[k] && caps[k].caption) || `${l.name}, photo ${k + 1} of ${frames.length}`; });
    let i = 0;
    const set = n => {
      i = Math.max(0, Math.min(frames.length - 1, n));
      strip.style.transform = `translateX(${-i * step}px)`;
      prev.disabled = i === 0; next.disabled = i === frames.length - 1;
      const p = caps[i]; cap.textContent = `${i + 1} / ${frames.length}` + (p ? ` — ${p.caption}${p.credit ? ' · ' + p.credit : ''}` : '');
    };
    prev.onclick = () => set(i - 1); next.onclick = () => set(i + 1);
    c.tabIndex = 0; c.onkeydown = e => { if (e.key === 'ArrowLeft') set(i - 1); if (e.key === 'ArrowRight') set(i + 1); };
    set(0);
  }
  // captions + credits for in-page photographs, placed in free space so they never overlap text or other images
  function initImgs(box, l) {
    const P = l.pageImages || {}, page = box.firstElementChild, z = innerWidth / 1728;
    const R = el => { const r = el.getBoundingClientRect(), o = page.getBoundingClientRect(); return { x: (r.left - o.left) / z, y: (r.top - o.top) / z, w: r.width / z, h: r.height / z }; };
    const hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    const vis = el => el.getBoundingClientRect().width > 4 && getComputedStyle(el).opacity !== '0';
    // obstacles: text blocks, foreground photos, carousel, expandable panel
    const obst = [...page.querySelectorAll('p, .exp, .carousel, [data-name]')].filter(el => vis(el) && !el.closest('.carousel .strip') && (el.tagName === 'P' || el.matches('.exp,.carousel') || (P[el.dataset.name] && !P[el.dataset.name].bg) || /^(image|LP|download|oysters|stone)/i.test(el.dataset.name || '') && !el.querySelector('p'))).map(R).filter(r => r.w < 1700);
    // decorative connector lines (svg vectors) count as obstacles too
    page.querySelectorAll('img[src$=".svg"]').forEach(i => { const r = R(i); if (r.w < 1700 && r.h < 1200 && r.w > 2) obst.push(r); });
    page.querySelectorAll('[data-name]').forEach(el => {
      const p = P[el.dataset.name]; if (!p || el.closest('.carousel')) return;
      el.querySelectorAll('img').forEach(i => i.alt = p.caption);
      if (p.bg) return;
      const r = R(el), H = 78, G = 12;
      const tries = [{ x: r.x, y: r.y + r.h + G, w: r.w, h: H }, { x: r.x, y: r.y - H - G, w: r.w, h: H }, { x: r.x + r.w + 16, y: r.y + r.h - H * 1.6, w: 300, h: H * 1.6 }, { x: r.x - 316, y: r.y + r.h - H * 1.6, w: 300, h: H * 1.6 }];
      const spot = tries.find(t => t.x >= 20 && t.x + t.w <= 1708 && !obst.some(o => o !== r && hit(t, o) && !(o.x === r.x && o.y === r.y)));
      const cap = document.createElement('p');
      cap.className = 'img-cap'; cap.innerHTML = `${p.caption}<br><em>${p.credit}</em>`;
      el.classList.add('cap-img'); el.tabIndex = 0; el.setAttribute('aria-describedby', cap.id = 'cap-' + Math.random().toString(36).slice(2, 8));
      if (spot) { cap.classList.add('placed'); Object.assign(cap.style, { left: spot.x + 'px', top: spot.y + 'px', width: spot.w + 'px' }); page.appendChild(cap); obst.push(spot); }
      else { el.classList.add('cap-host'); el.appendChild(cap); }   // no free space beside it: reveal over the photo
      const on = v => () => cap.classList.toggle('show', v);
      el.addEventListener('mouseenter', on(true)); el.addEventListener('mouseleave', on(false));
      el.addEventListener('focus', on(true)); el.addEventListener('blur', on(false));
    });
  }
  function renderSources() {
    const el = document.getElementById('imgSources'); if (!el || el.dataset.ok) return;
    el.innerHTML = DATA.landmarks.map(l => {
      const items = [...Object.values(l.pageImages || {}), ...(l.photos || []).filter(p => p.verified && !(l.pageImages || {})[p.file])];
      const seen = new Set(), li = items.filter(p => !seen.has(p.caption) && seen.add(p.caption)).map(p => `<li>${p.caption} — ${p.url ? `<a href="${p.url}" target="_blank" rel="noopener">${p.credit}</a>` : p.credit}</li>`).join('');
      return `<h3>${l.name}</h3><ul>${li}</ul>`;
    }).join('');
    el.dataset.ok = 1;
  }
  function initExp(b, l) {
    const d = l.designationInfo || {}, rows = [['Borough', l.borough], ['Address', l.address], ['Type', l.category], ['LP number', d.lp], ['Designated', d.designated], ['Note', d.note]].filter(r => r[1]);
    const body = b.querySelector('.exp-body');
    body.innerHTML = `<h3>Designation</h3><dl>${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>`;
    body.hidden = false;
    b.onclick = () => { const o = b.classList.toggle('open'); b.setAttribute('aria-expanded', o); };
  }

  render();
})();
