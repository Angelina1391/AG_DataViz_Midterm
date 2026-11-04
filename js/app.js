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

  const setNav = (el, l) => { const st = document.documentElement.style; st.setProperty('--nav', (el && el.dataset.nav) || '#93a07f'); st.setProperty('--ink', (l && l.ink) || '#203712'); };
  // nav icons inline so their circles can take each landmark's ink colour
  document.querySelectorAll('.nb img[src$=".svg"]').forEach(async im => {
    if (im.closest('.home')) return;
    const t = await fetch(im.getAttribute('src')).then(r => r.text());
    im.insertAdjacentHTML('afterend', t.replace(/fill="#203712"/g, 'class="nb-fill"').replace(/<svg /, '<svg aria-hidden="true" '));
    im.remove();
  });
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
      show('v-map'); initMap(); map.resize(); showTip();
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
        setNav(box.firstElementChild, l); renderSources(); scrollTo(0, 0);
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
    const z = innerWidth / 1728, pad = { top: 300 * z, bottom: 50 * z, left: 80 * z, right: 420 * z };   // keep the top pin clear of the nav bar
    const c = map.cameraForBounds(b, { padding: pad });
    // cameraForBounds centres on the bounds; shift by half the uneven padding so the pins sit in the open area
    camera({ center: c.center.toArray ? c.center.toArray() : [c.center.lng, c.center.lat], zoom: c.zoom, offset: [(pad.left - pad.right) / 2, (pad.top - pad.bottom) / 2] });
  }

  /* ---------- First-visit map instructions ---------- */
  function showTip() {
    const t = $('#tip'); if (t.dataset.done) return;
    let seen = false; try { seen = sessionStorage.getItem('ih-tip') === '1'; } catch (e) {}
    t.dataset.done = 1; if (seen) return;
    t.hidden = false;
    const close = () => { t.hidden = true; try { sessionStorage.setItem('ih-tip', '1'); } catch (e) {} };
    t.querySelector('button').onclick = close;
    document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); }, { once: true });
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
    const avail = innerHeight / (innerWidth / 1728) - 106, k = Math.min(1, (avail - 80) / c.h);
    const top = 106 + (avail - c.h * k) / 2;
    const hist = c.hist ? (c.hist.box ? layer(c.hist) : `<div class="ly" style="inset:0">${imgLayer(c.hist.src, c.hist.crop, c.hist.fit)}</div>`) : '';
    el.className = 'card z' + (c.border ? ' border' : '');
    el.style.cssText = `top:${top}px;width:${c.w}px;height:${c.h}px;--k:${k}`;
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
    setNav(box.firstElementChild, l);
    box.querySelectorAll('.carousel').forEach(c => initCarousel(c, l));
    box.querySelectorAll('.exp').forEach(b => initExp(b, l));
    initSticky(box.firstElementChild);
    initImgs(box, l);
  }
  function initCarousel(c, l) {
    const strip = c.querySelector('.strip'), frames = [...strip.children];
    const px = (el, k) => parseFloat(getComputedStyle(el)[k]) || 0, s = px(c, 'width') / 7185, step = px(frames[1], 'left') - px(frames[0], 'left');
    const fl = 48 * s, fw = px(frames[0], 'width') || 1067 * s, ab = 48 * s, gap = 30 * s;   // arrows sit 30px clear of the photo edges
    c.style.setProperty('--ab', ab + 'px'); c.style.setProperty('--at', 376 * s + 'px');
    c.style.setProperty('--ap', fl - gap - ab + 'px'); c.style.setProperty('--an', fl + fw + gap + 'px');
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
  // Figma "sticky" background sections: each image (and its opaque backing box) pins to the top while the
  // next section's image scrolls over it; text stays above all of them.
  function initSticky(page) {
    const H = parseFloat(page.style.height) || page.offsetHeight;
    // Figma emits these tops relative to the whole page: top-[calc(A%+Bpx)] or top-[Npx]
    const topOf = el => { const c = el.className || '', m = /top-\[calc\(([\d.]+)%([+-][\d.]+)px\)\]/.exec(c), n = /(?:^|\s)top-\[(-?[\d.]+)px\]/.exec(c);
      return m ? H * m[1] / 100 + +m[2] : n ? +n[1] : /(?:^|\s)top-0/.test(c) ? 0 : null; };
    // background sections whose Figma instance lost its width (absolute + left only => 0px): restore it
    page.querySelectorAll('[data-name$=" image"]').forEach(e => { if (!e.offsetWidth && getComputedStyle(e).display !== 'contents') e.style.width = '1730px'; });
    // background photos load up front so they are ready when they slide into view
    page.querySelectorAll('[data-name$=" image"] img, .sticky img').forEach(i => i.loading = 'eager');
    // a background section with no sticky layer (e.g. Aakawaxung "archaic image") stretches its photo over the whole
    // section; pin it like the others at one screen high so it is not blown up
    page.querySelectorAll('[data-name$=" image"]').forEach(e => {
      if (e.querySelector('.sticky') || e.closest('.sticky') || e.offsetHeight < 1500) return;
      const c = e.firstElementChild; if (!c || !c.querySelector('img')) return;
      Object.assign(c.style, { position: 'sticky', top: '0', bottom: 'auto', height: (parseFloat((/(?:^|\s)h-\[([\d.]+)px\]/.exec(e.getAttribute('data-h') || '') || [])[1]) || 1163) + 'px', width: '100%' });
    });
    page.querySelectorAll('.sticky').forEach(st => {
      if (st.dataset.ok) return; st.dataset.ok = 1;
      // Figma instances sometimes drop the frame width (absolute + left only => 0px wide): restore full width
      for (let e = st.parentElement; e && e !== page; e = e.parentElement)
        if (!e.offsetWidth && getComputedStyle(e).display !== 'contents') e.style.width = '1730px';
      if (getComputedStyle(st).display !== 'contents') {
        if (!st.offsetHeight) {                                        // sized-less sticky layer: give it a viewport-high box
          const par = st.parentElement, ph = parseFloat((/(?:^|\s)h-\[([\d.]+)px\]/.exec(par.className) || [])[1]) || 1117;
          st.style.height = ph + 'px';
          if (/(?:^|\s)inset-0/.test(par.className)) par.style.height = 'auto';   // let it travel the whole section
          if (par.parentElement && /pointer-events-none/.test(par.parentElement.className)) par.parentElement.style.height = 'auto';
        }
        return;
      }
      const wrapY = topOf(st.parentElement) ?? 0;
      const kids = [...st.children];
      const hs = kids.map(k => parseFloat((/(?:^|\s)h-\[([\d.]+)px\]/.exec(k.className) || [])[1]) || 1117);
      st.style.cssText += `;display:block;position:sticky;top:0;width:100%;height:${Math.max(...hs)}px`;
      // Figma's left values are page-relative too: re-base them on the wrapper. Backing boxes cover the full
      // width so nothing behind peeks through; wide photos are centred on the page.
      const leftOf = el => +((/(?:^|\s)left-\[(-?[\d.]+)px\]/.exec(el.className) || [0, 0])[1]);
      const wrapX = leftOf(st.parentElement);
      kids.forEach((k, i) => {
        const y = topOf(k); k.style.top = Math.max(0, (y ?? wrapY) - wrapY) + 'px'; k.style.bottom = 'auto'; k.style.height = hs[i] + 'px';
        const w = parseFloat((/(?:^|\s)w-\[([\d.]+)px\]/.exec(k.className) || [])[1]) || 1728;
        if (!k.querySelector('img')) { k.style.left = -wrapX + 'px'; k.style.width = '1730px'; }
        else k.style.left = (w >= 1600 ? (1728 - w) / 2 : leftOf(k)) - wrapX + 'px';
      });
    });
  }
  // captions + credits for in-page photographs, placed in free space so they never overlap text or other images
  function initImgs(box, l) {
    const P = l.pageImages || {}, page = box.firstElementChild, z = innerWidth / 1728;
    const R = el => { const r = el.getBoundingClientRect(), o = page.getBoundingClientRect(); return { x: (r.left - o.left) / z, y: (r.top - o.top) / z, w: r.width / z, h: r.height / z }; };
    const U = (a, b) => { const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y); return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y }; };
    const hit = (a, b, m = 6) => a.x < b.x + b.w + m && b.x < a.x + a.w + m && a.y < b.y + b.h + m && b.y < a.y + a.h + m;
    const vis = el => el.getBoundingClientRect().width > 4 && getComputedStyle(el).opacity !== '0';
    // 1. find every body photo and the area it really covers (container + image, which can spill out)
    const photos = [];
    page.querySelectorAll('[data-name]').forEach(el => {
      if (el.closest('.carousel') || el.closest('.sticky') || el.matches('.carousel') || el.closest('.exp')) return;
      const im = el.querySelector(':scope > img, :scope > div > img');
      if (!P[el.dataset.name] && !(im && /\.(webp|png|jpe?g)$/.test(im.getAttribute('src') || '') && R(el).w < 1300 && R(el).w > 60 && getComputedStyle(el).opacity !== '0' && !el.closest('[class*="opacity-"]'))) return;
      const p = P[el.dataset.name] || autoCap(el.dataset.name, l);
      el.querySelectorAll('img').forEach(i => i.alt = p.caption);
      if (p.bg) return;
      let r = R(el); el.querySelectorAll('img').forEach(i => { const q = R(i), c = R(el); if (q.w < 1400) r = U(r, { x: Math.max(q.x, c.x - 40), y: Math.max(q.y, c.y - 40), w: Math.min(q.w, c.w + 80), h: Math.min(q.h, c.h + 80) }); });
      photos.push({ el, p, r });
    });
    // 2. obstacles: text, every photo, the carousel and info panel, and the decorative connector lines
    const hard = [...page.querySelectorAll('p, .exp, .carousel')].filter(el => vis(el) && !el.closest('.carousel .strip') && !el.closest('.exp-body')).map(R).filter(r => r.w < 1700)
      .concat(photos.map(o => o.r));
    const lines = [...page.querySelectorAll('img[src$=".svg"]')].map(R).filter(r => r.w < 1700 && r.h < 1200 && r.w > 2);
    const measure = (html, w) => { const t = document.createElement('p'); t.className = 'img-cap placed'; t.style.cssText = `left:0;top:0;width:${w}px;visibility:hidden`; t.innerHTML = html; page.appendChild(t); const h = t.getBoundingClientRect().height / z; t.remove(); return h; };
    // 3. put each caption in the nearest empty spot around its photo (shown on hover/focus only)
    photos.forEach(({ el, p, r }) => {
      const html = `${p.caption}<br><em>${p.credit}</em>`, G = 14, cands = [];
      const wide = Math.max(260, Math.min(r.w, 560)), narrow = 300, hW = measure(html, wide), hN = measure(html, narrow);
      for (let d = 0; d <= 240; d += 24) {
        for (const x of [r.x, r.x + (r.w - wide) / 2, r.x + r.w - wide]) {
          cands.push({ x, y: r.y + r.h + G + d, w: wide, h: hW });            // below
          cands.push({ x, y: r.y - hW - G - d, w: wide, h: hW });             // above
        }
        for (const y of [r.y + r.h - hN, r.y + (r.h - hN) / 2, r.y]) {
          cands.push({ x: r.x + r.w + G + d, y, w: narrow, h: hN });          // right
          cands.push({ x: r.x - narrow - G - d, y, w: narrow, h: hN });       // left
        }
      }
      const inPage = t => t.x >= 20 && t.x + t.w <= 1708 && t.y >= 0;
      const dist = t => Math.hypot(Math.max(0, r.x - (t.x + t.w), t.x - (r.x + r.w)), Math.max(0, r.y - (t.y + t.h), t.y - (r.y + r.h)));
      const pick = obs => cands.filter(t => inPage(t) && !obs.some(o => hit(t, o))).sort((a, b) => dist(a) - dist(b))[0];
      const spot = pick(hard.concat(lines)) || pick(hard) || cands[0];
      const cap = document.createElement('p');
      cap.className = 'img-cap placed'; cap.innerHTML = html;
      Object.assign(cap.style, { left: spot.x + 'px', top: spot.y + 'px', width: spot.w + 'px' });
      page.appendChild(cap); hard.push(spot);
      el.classList.add('cap-img'); el.tabIndex = 0; el.setAttribute('aria-describedby', cap.id = 'cap-' + Math.random().toString(36).slice(2, 8));
      const on = v => () => cap.classList.toggle('show', v);
      el.addEventListener('mouseenter', on(true)); el.addEventListener('mouseleave', on(false));
      el.addEventListener('focus', on(true)); el.addEventListener('blur', on(false));
    });
  }

  function autoCap(name, l) {
    const m = /^LP(\d{4})_([\d-]+)_/.exec(name || '');
    if (m) return { caption: `${l.name}, LPC designation photograph (${m[2]})`, credit: 'NYC Landmarks Preservation Commission' };
    return { caption: l.name, credit: 'Source needed' };
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
    const d = l.designationInfo || {};
    const mdy = v => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || ''); return m ? `${+m[2]}/${+m[3]}/${m[1]}` : v; };
    const rows = [['Borough', l.borough], ['Address', l.address], ['Built', l.date], ['Type', l.category], ['LP number', d.lp], ['Designated', mdy(d.designated)]].filter(r => r[1]);
    const body = b.querySelector('.exp-body');
    body.innerHTML = `<h3>Designation</h3><dl>${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>`;
    body.hidden = false;
    // keep everything inside the panel: step the type down until it fits
    for (let fs = 28; fs > 18 && body.scrollHeight > body.clientHeight + 1; fs -= 1) body.style.fontSize = fs + 'px';
    b.onclick = () => { const o = b.classList.toggle('open'); b.setAttribute('aria-expanded', o); };
  }

  render();
})();
