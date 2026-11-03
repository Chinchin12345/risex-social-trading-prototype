/* RISEx Social Trading — mobile prototype.
   Four flows from Figma section "7. Social Trading — Main flows (Mobile)", all starting on 01 · Trade (Perp):
   Entry & Copy Trading hub · Auto Copy (Fixed Amount) · Follow & Manual copy · Follow & Unfollow.
   Only controls that are wired in Figma act; everything else keeps its look and does nothing. */
(function () {
  'use strict';
  var S = window.Store, F = S.fmt, D = S.DEMO, E = D.eth;
  var st = S.read();
  var save = function () { S.write(st); };

  // ---------- helpers ----------
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var I = function (n, c) { return '<i data-icon="' + n + '" class="' + (c || 'i16') + '" aria-hidden="true">' + (window.ICONS[n] || '') + '</i>'; };
  var money = F.money, usdc = F.usdc;
  var signed = function (n) { return (n >= 0 ? '+' : '−') + money(Math.abs(n)).replace('−', ''); };
  var kv = function (k, v, vc) { return '<div class="kv"><span class="k">' + k + '</span><span class="v num' + (vc ? ' ' + vc : '') + '">' + v + '</span></div>'; };
  var btn = function (label, o) {
    o = o || {};
    return '<button type="button" class="btn ' + (o.v || 'primary') + (o.s ? ' ' + o.s : '') + '"' + (o.act ? ' data-act="' + o.act + '"' : '') +
      (o.id ? ' id="' + o.id + '"' : '') + (o.disabled ? ' disabled' : '') + '><span class="lbl">' + label + '</span></button>';
  };
  var scope = null; // the screen being shown; ids are looked up inside it so an outgoing screen never answers
  var $ = function (sel, root) { return (root || scope || document).querySelector(sel); };
  var ago = function (t) { var m = Math.floor((Date.now() - t) / 60000); return m < 1 ? 'just now' : m < 60 ? m + 'm ago' : Math.floor(m / 60) + 'h ago'; };
  var copyActive = function () { return st.copy && st.copy.status === 'active'; };
  var copyLive = function () { return st.copy && (st.copy.status === 'active' || st.copy.status === 'paused'); };

  // ---------- number inputs ----------
  // dec: max decimals; returns cleaned value or null when the keystroke is rejected
  function cleanNum(v, dec) {
    v = v.replace(/,/g, '.').replace(/[^\d.]/g, '');
    var parts = v.split('.');
    if (parts.length > 2) return null;
    if (dec === 0 && parts.length > 1) return null;
    if (parts[1] && parts[1].length > dec) return null;
    if (parts[0].length > 7) return null;
    if (v === '.') v = '0.';
    return v;
  }
  var num = function (v) { return v === '' || v == null || v === '.' ? NaN : parseFloat(v); };
  var measureCtx = document.createElement('canvas').getContext('2d');
  var coarse = window.matchMedia && matchMedia('(pointer: coarse)').matches;
  function sizeInput(inp) {
    var empty = inp.value === '';
    measureCtx.font = empty ? '600 16px Geist, system-ui, sans-serif' : '600 20px Geist, system-ui, sans-serif';
    var w = Math.ceil(measureCtx.measureText(empty ? inp.placeholder : inp.value).width) + 3;
    inp.style.width = Math.max(w, 8) + 'px';
  }
  function field(o) {
    return '<div class="field" data-field="' + o.id + '">' +
      '<div class="f-lr"><label class="f-l" for="in-' + o.id + '">' + o.label + '</label>' + (o.hint ? '<span class="f-h num">' + o.hint + '</span>' : '') + '</div>' +
      '<div class="f-box" data-box="' + o.id + '"><input id="in-' + o.id + '" class="f-in" type="text" inputmode="' + (o.dec === 0 ? 'numeric' : 'decimal') + '" autocomplete="off" autocorrect="off" spellcheck="false" enterkeyhint="done" data-dec="' + o.dec + '"' + (o.fmt ? ' data-fmt="2"' : '') + ' placeholder="' + o.ph + '" value="' + esc(o.val || '') + '"' + (o.describe !== false ? ' aria-describedby="h-' + o.id + '"' : '') + '>' +
      '<span class="f-u">' + o.unit + '</span>' + (o.max ? '<button type="button" class="f-act" data-act="' + o.max + '">Max</button>' : '') + '</div>' +
      (o.help !== undefined ? '<p class="f-help" id="h-' + o.id + '">' + o.help + '</p>' : '') + '</div>';
  }
  function bindInputs(root, onChange) {
    root.querySelectorAll('.f-in').forEach(function (inp) {
      var prev = inp.value; sizeInput(inp);
      inp.addEventListener('input', function () {
        var c = cleanNum(inp.value, +inp.dataset.dec);
        if (c === null) { inp.value = prev; } else { inp.value = c; prev = c; }
        sizeInput(inp); onChange(inp.id.slice(3), inp.value, 'input');
      });
      inp.addEventListener('focus', function () {
        inp.closest('.f-box').classList.add('focus'); if (coarse) device.classList.add('kb-open');
        setTimeout(function () { if (document.activeElement === inp) inp.closest('.field').scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, 320);
      });
      inp.addEventListener('blur', function () {
        inp.closest('.f-box').classList.remove('focus'); device.classList.remove('kb-open');
        if (inp.dataset.fmt && inp.value !== '' && isFinite(num(inp.value))) { inp.value = num(inp.value).toFixed(2); prev = inp.value; sizeInput(inp); }
        onChange(inp.id.slice(3), inp.value, 'blur');
      });
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); inp.blur(); } });
      inp.closest('.f-box').addEventListener('mousedown', function (e) { if (e.target === inp || e.target.closest('.f-act')) return; e.preventDefault(); inp.focus(); });
    });
  }
  function setInput(id, v) { var inp = $('#in-' + id); if (inp) { inp.value = v; sizeInput(inp); } }
  function setHelp(id, text, isErr) {
    var h = $('#h-' + id), box = $('[data-box="' + id + '"]');
    if (h) { h.textContent = text; h.classList.toggle('err', !!isErr); }
    if (box) box.classList.toggle('err', !!isErr);
    var inp = $('#in-' + id); if (inp) inp.setAttribute('aria-invalid', isErr ? 'true' : 'false');
  }
  function setBtn(id, enabled) { var b = $('#' + id); if (b) b.disabled = !enabled; }

  // ---------- router (history-backed stack) ----------
  var device = document.getElementById('device'), stage = document.getElementById('stage'), overlayEl = document.getElementById('overlay'), toastsEl = document.getElementById('toasts');
  var NAVKEY = S.KEY + ':nav';
  var nav = { stack: [{ r: 'trade' }], idx: 0, pending: null };
  function navSave() { try { sessionStorage.setItem(NAVKEY, JSON.stringify({ stack: nav.stack })); } catch (e) {} }
  function cur() { return nav.stack[nav.idx]; }
  function push(entry) {
    nav.stack = nav.stack.slice(0, nav.idx + 1).concat([entry]); nav.idx++;
    history.pushState({ i: nav.idx }, '', '#' + entry.r); navSave(); render('fwd');
  }
  function replace(entry, dir) { nav.stack[nav.idx] = entry; history.replaceState({ i: nav.idx }, '', '#' + entry.r); navSave(); render(dir || 'none'); }
  function back() { if (nav.idx > 0) history.back(); else replace({ r: 'trade' }, 'back'); }
  // go back to the latest entry with route r (and optionally run then without rendering it)
  function backTo(r, then) {
    for (var j = nav.idx; j >= 0; j--) if (nav.stack[j].r === r && !nav.stack[j].sheet) break;
    if (j < 0) { if (then) { replace({ r: r }, 'none'); then(); } else { replace({ r: r }, 'back'); } return; }
    if (j === nav.idx) { if (then) then(); return; }
    nav.pending = then || null; history.go(j - nav.idx);
  }
  window.addEventListener('popstate', function (e) {
    var i = e.state && typeof e.state.i === 'number' ? e.state.i : 0;
    var dir = i < nav.idx ? 'back' : 'fwd';
    nav.idx = Math.min(i, nav.stack.length - 1);
    if (nav.pending) { var p = nav.pending; nav.pending = null; p(); return; }
    render(dir);
  });
  function openSheet(name, data) { var c = cur(); push({ r: c.r, p: c.p, sheet: name, d: data }); }
  function closeSheet() { if (cur().sheet) back(); }

  // ---------- render ----------
  var mounted = null; // { key, el, scr }
  function screenKey(e) { return e.r + '|' + JSON.stringify(e.p || {}); }
  function render(dir) {
    var e = cur(), scr = SCREENS[e.r] || SCREENS.trade;
    if (scr.guard) { var g = scr.guard(e); if (g) { g(); return; } }
    var key = screenKey(e);
    if (!mounted || mounted.key !== key) {
      var el = document.createElement('section');
      el.className = 'screen' + (dir === 'fwd' ? ' in' : dir === 'back' ? ' in-back' : '');
      el.setAttribute('aria-label', scr.title ? scr.title(e) : e.r);
      el.innerHTML = scr.html(e);
      if (mounted) {
        if (mounted.scr.unmount) mounted.scr.unmount();
        var old = mounted.el; old.classList.add('out'); old.setAttribute('aria-hidden', 'true'); old.inert = true;
        old.querySelectorAll('[id]').forEach(function (n) { n.removeAttribute('id'); });
        setTimeout(function () { old.remove(); }, 200);
        if (document.activeElement && old.contains(document.activeElement)) document.activeElement.blur();
      }
      stage.appendChild(el);
      mounted = { key: key, el: el, scr: scr, e: e }; scope = el;
      if (scr.mount) scr.mount(el, e);
      hydrate(el);
    } else {
      mounted.e = e;
      if (sheetShown && !e.sheet) { renderSheet(e); refreshKeepFocus(); }
    }
    renderSheet(e);
    toastsEl.style.top = (e.r === 'trade' || e.r === 'leaderboard' ? 56 : 60) + 'px';
    document.title = 'RISEx — ' + (scr.title ? scr.title(e) : 'Social Trading');
  }
  // re-render the current screen after a state change, keeping scroll position
  function refresh() {
    if (!mounted) return;
    var body = mounted.el.querySelector('.body'), top = body ? body.scrollTop : 0;
    var e = cur(), scr = mounted.scr;
    if (scr.unmount) scr.unmount();
    mounted.el.innerHTML = scr.html(e);
    if (scr.mount) scr.mount(mounted.el, e);
    hydrate(mounted.el);
    var nb = mounted.el.querySelector('.body'); if (nb) nb.scrollTop = top;
    renderSheet(e, true);
  }
  function refreshKeepFocus() {
    var a = document.activeElement, id = a && a.id, pos = a && a.selectionStart;
    refresh();
    if (id) { var n = document.getElementById(id); if (n && n !== a) { n.focus({ preventScroll: true }); try { n.setSelectionRange(pos, pos); } catch (e) {} } }
  }
  function hydrate() { /* icons are inlined at render time */ }
  // background changes (market event, other tab) only repaint screens without a form in progress
  function refreshLive() { if (mounted && mounted.scr.live) refreshKeepFocus(); }

  // ---------- sheets ----------
  var sheetShown = null;
  function renderSheet(e, force) {
    var name = e.sheet || null;
    if (name === sheetShown && !force) return;
    if (!name) {
      var ov = overlayEl.firstElementChild;
      if (ov) { ov.classList.add('closing'); setTimeout(function () { ov.remove(); }, 200); }
      sheetShown = null; if (mounted) mounted.el.inert = false; return;
    }
    var def = SHEETS[name]; if (!def) return;
    var fresh = sheetShown !== name;
    overlayEl.innerHTML = '<div class="ov" role="dialog" aria-modal="true" aria-labelledby="sh-title"><div class="scrim" data-act="sheet-close"></div><div class="sheet" tabindex="-1">' +
      '<div class="sh-h"><h2 id="sh-title">' + def.title(e) + '</h2><button type="button" class="sh-x" data-act="sheet-close" aria-label="Close">' + I('x-mark', 'i24') + '</button></div>' + def.html(e) + '</div></div>';
    if (!fresh) overlayEl.querySelector('.scrim').style.animation = 'none', overlayEl.querySelector('.sheet').style.animation = 'none';
    sheetShown = name;
    if (mounted) mounted.el.inert = true;
    if (fresh) overlayEl.querySelector('.sheet').focus({ preventScroll: true });
  }

  // ---------- toasts ----------
  var toastTimer = {};
  function toast(id, o) {
    dismissToast(id, true);
    var t = document.createElement('div');
    t.className = 'toast' + (o.ok ? ' ok' : ''); t.dataset.toast = id; t.setAttribute('role', 'status');
    t.innerHTML = I(o.icon, 'i20') + '<div class="tt"><b>' + o.title + '</b><p>' + o.body + '</p>' + (o.acts ? '<div class="acts">' + o.acts + '</div>' : '') + '</div>';
    toastsEl.appendChild(t);
    if (o.ms) toastTimer[id] = setTimeout(function () { dismissToast(id); }, o.ms);
  }
  function dismissToast(id, now) {
    clearTimeout(toastTimer[id]);
    var t = toastsEl.querySelector('[data-toast="' + id + '"]'); if (!t) return;
    if (now) { t.remove(); return; }
    t.classList.add('out'); setTimeout(function () { t.remove(); }, 200);
  }
  function signalToast() {
    if (!st.event.fired) return;
    toast('signal', {
      icon: 'bell20', title: 'kestrel opened ' + E.market + ' ' + E.side + ' ' + E.lev + 'x',
      body: 'Entry ' + money(E.traderEntry) + ' · ' + F.hm(st.event.at) + ' · now ' + money(E.priceNow),
      acts: '<button type="button" class="link" data-act="sig-view">View trade</button><button type="button" class="link" data-act="sig-copy">Copy trade</button>',
      ms: 12000
    });
  }

  // ---------- simulated market event: kestrel opens a NEW position after you follow ----------
  var evTimer = null;
  function scheduleEvent() {
    clearTimeout(evTimer);
    if (!st.follow.on || st.event.fired || copyActive()) return;
    var wait = Math.max(800, D.eventDelayMs - (Date.now() - st.follow.at));
    evTimer = setTimeout(fireEvent, wait);
  }
  function fireEvent() {
    st = S.read();
    if (!st.follow.on || st.event.fired || copyActive()) return;
    st.event = { fired: true, at: Date.now() }; st.notif.unread = true; save();
    refreshLive(); signalToast();
  }

  // ---------- shared fragments ----------
  var bellBadge = function () { return st.notif.unread ? '<span class="dot" aria-hidden="true"></span>' : ''; };
  function navBar(title, o) {
    o = o || {};
    // Figma 11 · My Copy: the whole "‹ Back to Trading" label is the back control and goes to Trade
    if (o.backLabel) return '<header class="nav"><button type="button" class="nav-back-lbl" data-act="' + o.backAct + '"><span class="nav-btn" aria-hidden="true">' + I('chev-left', 'i20') + '</span><span class="nav-title">' + o.backLabel + '</span></button></header>';
    return '<header class="nav">' + (o.back === false ? '<span class="nav-spacer"></span>' : '<button type="button" class="nav-btn" data-act="' + (o.backAct || 'back') + '" aria-label="Back">' + I('chev-left', 'i20') + '</button>') +
      '<h1 class="nav-title' + (o.dim ? ' dim' : '') + '">' + title + '</h1>' +
      (o.bell ? '<button type="button" class="nav-btn" data-act="bell" aria-label="Notifications' + (st.notif.unread ? ', 1 unread' : '') + '">' + I('bell18', 'i18') + bellBadge() + '</button>' : '') + '</header>';
  }
  function steps(n, label) {
    var b = ''; for (var i = 1; i <= 4; i++) b += '<i class="' + (i <= n ? 'on' : '') + '"></i>';
    return '<div class="steps"><b>Step ' + n + ' of 4 · ' + label + '</b><div class="bars">' + b + '</div></div>';
  }
  function bottomNav(active) {
    var tabs = [['markets', 'Markets', 'nav-markets'], ['chart', 'Chart', 'nav-chart'], ['trade', 'Trade', 'nav-trade'], ['portfolio', 'Portfolio', 'nav-portfolio'], ['leaderboard', 'Leaderboard', 'nav-leaderboard']];
    return '<nav class="bnav" aria-label="Main">' + tabs.map(function (t) {
      var act = active === 'chart' ? (t[0] === 'leaderboard' ? 'go-leaderboard' : '') : (t[0] === 'markets' || t[0] === 'chart' || t[0] === 'trade' ? 'go-trade' : '');
      var on = t[0] === active;
      var inner = I(t[2], 'i20') + '<span>' + t[1] + '</span>';
      return act && !on ? '<button type="button" class="bnav-t" data-act="' + act + '">' + inner + '</button>' : '<div class="bnav-t' + (on ? ' on' : '') + '"' + (on ? ' aria-current="page"' : '') + '>' + inner + '</div>';
    }).join('') + '</nav>';
  }
  var TRADERS = [
    { id: 'kestrel', i: 'K', bg: '#03de82', sub: '142 trading days · 238 copiers', roi: '+18.4%', roiC: 't-brand', dd: '−6.2%', cp: '+$41.2K', cpC: 't-brand', foot: 'Profit share 10% · Perps only', wallet: '0x4b2e…91ae 0x4b2e91ae' },
    { id: 'lumen', i: 'L', bg: '#fac515', sub: '311 trading days · 512 copiers', roi: '+9.1%', roiC: 't-brand', dd: '−3.4%', cp: '+$63.0K', cpC: 't-brand', foot: 'Profit share 10% · Perps only' },
    { id: 'orbit_fx', i: 'O', bg: '#7a5af8', sub: '63 trading days · 91 copiers', roi: '+42.7%', roiC: 't-brand', dd: '−24.8%', cp: '+$8.9K', cpC: 't-brand', foot: 'Profit share 10% · High drawdown' },
    { id: 'tidal', i: 'T', bg: '#36bffa', sub: '98 trading days · 40 copiers', roi: '−4.6%', roiC: 't-err', dd: '−11.9%', cp: '−$2.1K', cpC: 't-err', foot: 'Profit share 10% · Perps only' },
    { id: 'pyro', i: 'P', bg: '#ff6467', sub: '9 trading days · 3 copiers', roi: '—', roiC: 't-ter', dd: '—', ddC: 't-ter', cp: '—', cpC: 't-ter', foot: 'Not enough data · 9 of 30 days' }
  ];
  function traderCard(t) {
    var inner = '<div class="tc-top"><span class="av av36" style="background:' + t.bg + '">' + t.i + '</span><div class="nm"><span class="h14">' + t.id + '</span><span class="t11">' + t.sub + '</span></div></div>' +
      '<div class="tc-m"><div><span class="t11">ROI 30D</span><b class="num ' + t.roiC + '">' + t.roi + '</b></div><div><span class="t11">Max drawdown 30D</span><b class="num ' + (t.ddC || '') + '">' + t.dd + '</b></div><div><span class="t11">Copier PnL 30D</span><b class="num ' + t.cpC + '">' + t.cp + '</b></div></div>' +
      '<div class="tc-f"><span class="t11">' + t.foot + '</span><span class="link">View profile</span></div>';
    // In Figma only the kestrel card is wired (whole card → 03 · Trader profile)
    return t.id === 'kestrel' ? '<button type="button" class="card tcard" data-act="open-profile" aria-label="kestrel, view profile">' + inner + '</button>' : '<div class="card tcard">' + inner + '</div>';
  }
  var slLabel = function (c) { return c.mode === 'mine' ? 'My limit only' : 'Trader SL + my limit'; };
  var slShort = function (c) { return (c.mode === 'mine' ? 'My limit ' : 'Trader SL + ') + c.sl + '% of initial margin'; };
  var slAmt = function (c) { return usdc(num(c.margin) * num(c.sl) / 100); };
  var levTxt = function (c) { return c.lev ? c.lev + 'x' : 'Not set'; };
  var devTxt = function (c) { return c.dev ? c.dev + '%' : 'Not set'; };
  function kestrelPositions() {
    var p = [];
    if (st.event.fired) p.push({ m: 'ETH-PERP', side: 'Long 10x', size: '14.65 ETH', entry: money(E.traderEntry), mark: money(E.priceNow), pnl: signed(14.65 * (E.priceNow - E.traderEntry)), note: 'Opened ' + F.md(st.event.at) + ', ' + F.hm(st.event.at) + ' · TP ' + money(E.tp) + ' · SL ' + money(E.sl), id: 'pos-eth' });
    p.push({ m: 'SOL-PERP', side: 'Long 8x', size: '54.80 SOL', entry: '$182.40', mark: '$188.05', pnl: '+$309.62', note: 'Opened Nov 3, 08:15 · TP $195.00 · No stop loss set by trader' });
    return p;
  }
  function positionCard(p, hl) {
    return '<div class="card pos' + (hl ? ' hl' : '') + '"' + (p.id ? ' id="' + p.id + '"' : '') + '><div class="h-row"><span class="h14">' + p.m + '</span><span class="chip brand">' + p.side + '</span>' + (p.chip ? '<span class="chip grey" style="margin-left:auto">' + p.chip + '</span>' : '') + '</div>' +
      '<div class="pos-g"><div><span class="t11">Size</span><b class="num">' + p.size + '</b></div><div><span class="t11">Entry</span><b class="num">' + p.entry + '</b></div><div><span class="t11">Mark</span><b class="num">' + p.mark + '</b></div><div><span class="t11">PnL</span><b class="num t-brand">' + p.pnl + '</b></div></div>' +
      (p.note ? '<p class="t11">' + p.note + '</p>' : '') + '</div>';
  }

  // ================= SCREENS =================
  var SCREENS = {};

  // 01 · Trade (Perp)
  SCREENS.trade = {
    title: function () { return 'Trade BTC-PERP'; },
    live: true,
    html: function () {
      var px = [['78,400.0', 8], ['78,000.0', 87], ['77,600.0', 166], ['77,200.0', 245], ['76,800.0', 324]].map(function (p) { return '<span class="px num" style="top:' + p[1] + 'px">' + p[0] + '</span>'; }).join('');
      var tfs = ['1m', '5m', '15m', '30m', '1h', '4h', '1D', '1W'].map(function (t) { return '<span class="tf' + (t === '1h' ? ' on' : '') + '">' + t + '</span>'; }).join('');
      var m = st.manual;
      var positions = m ? '<div class="mypos"><button type="button" class="card tcard pos" data-act="open-position" aria-label="ETH-PERP manual copy position">' +
        positionCard({ m: 'ETH-PERP', side: 'Long 10x', chip: 'Manual copy · kestrel', size: m.size.toFixed(4) + ' ETH', entry: money(E.fill), mark: money(E.mark), pnl: signed(m.pnl) }).replace(/^<div class="card pos">|<\/div>$/g, '') + '</button></div>' : '<div class="pempty">You have no open position.</div>';
      return '<header class="hdr"><span class="sq36">' + I('menu', 'i18') + '</span><img class="logo" src="assets/img/logo.svg" alt="RISEx"><span class="hdr-sp"></span><div class="hdr-act">' +
        '<button type="button" class="hbtn grey" data-act="go-hub">Copy Trading</button><span class="hbtn green">Deposit</span>' +
        '<button type="button" class="round36" data-act="bell" aria-label="Notifications' + (st.notif.unread ? ', 1 unread' : '') + '">' + I('bell', 'i18') + bellBadge() + '</button>' +
        '<img class="me" src="assets/img/avatar-you.svg" alt=""></div></header>' +
        '<div class="body"><div class="mkt"><div class="mkt-row"><div class="mkt-sel"><img src="assets/img/btc.svg" width="20" height="20" alt=""><div><div class="sym-row"><span class="sym">BTC</span><span class="badge ok">25x</span>' + I('chev-down-m', 'i20') + '</div><span class="t-sec">Bitcoin</span></div></div>' +
        '<div class="mkt-px"><span class="last num">$77,693.6</span><span class="badge err num">-3.24%</span></div></div>' +
        '<div class="stats"><div class="stat"><span class="t-sec">Index</span><b class="num">77,690.9</b></div><div class="stat"><span class="t-sec u">Funding 1H / APR</span><b class="num t-brand">0.001685% / 14.76%</b></div><div class="stat"><span class="t-sec">24h Volume</span><b class="num">80.6M USDC</b></div><div class="stat"><span class="t-sec">OI</span><b class="num">$18.7M</b></div></div></div>' +
        '<div class="utabs"><span class="utab on">Price Chart</span><span class="utab">Orderbook</span><span class="utab">Trades</span></div>' +
        '<div class="ctool"><div class="tfs">' + tfs + '<span class="tool" style="width:20px">' + I('chev-down-s', 'i12') + '</span></div><span class="tool">' + I('candles', 'i20') + '</span><span class="tool">' + I('indicators', 'i20') + '</span><span class="tool">' + I('expand', 'i20') + '</span><span class="tool">' + I('camera', 'i20') + '</span><img class="scroll-hint" src="assets/img/scroll-hint.svg" alt=""></div>' +
        '<div class="chart"><img src="assets/img/chart-canvas.svg" alt="BTC price chart, 1h candles (illustrative)">' + px + '</div>' +
        '<div class="pstrip"><b>Positions (' + (m ? 1 : 0) + ')</b><span>Open orders (0)</span></div>' + positions + '</div>' +
        '<div class="bottom"><div class="actbar"><span class="b buy">Buy</span><span class="b sell">Sell</span><span class="adv">' + I('adv-order', 'i18') + '</span></div>' + bottomNav('chart') + '</div>';
    }
  };

  // L1 · Leaderboard (reference snapshot of the live RISEx page)
  SCREENS.leaderboard = {
    title: function () { return 'Leaderboard'; },
    live: true,
    html: function () {
      var top = [['#1', 'yeff', true, '+$43,118.07', '+28.09% ROI'], ['#2', 'gggg', false, '+$14,918.36', '+91.58% ROI'], ['#3', '0x01...BB21', false, '+$9,799.61', '+14.5% ROI'], ['#4', 'GCR', false, '+$6,164.4', '+29.73% ROI'], ['#5', '0xE6...631F', false, '+$2,136.09', '+6.44% ROI']];
      var rows = [['1', 'yeff', '@yeffjan', '$43.1K', '+28.1%'], ['2', 'gggg', '', '$14.9K', '+91.6%'], ['3', '0x01aB...BB21', '', '$9.80K', '+14.5%'], ['4', 'GCR', '', '$6.16K', '+29.7%'], ['5', '0xE663...631F', '', '$2.14K', '+6.4%'], ['6', '0x7C2D...07Ec', '', '$2.08K', '+69.2%'], ['7', 'happywifehappylife', '', '$2.02K', '+15.9%'], ['8', 'TOTHEMOON', '', '$1.85K', '+3.1%'], ['9', 'kiyo', '', '$1.33K', '+6.1%'], ['10', 'youyou', '', '$1.28K', '+16.0%']];
      return '<header class="hdr"><span class="sq36">' + I('menu', 'i18') + '</span><img class="logo" src="assets/img/logo.svg" alt="RISEx"><span class="hdr-sp"></span><div class="hdr-act" style="gap:6px">' +
        '<button type="button" class="round36" data-act="bell" aria-label="Notifications">' + I('bell', 'i18') + bellBadge() + '</button><span class="sq36">' + I('cog', 'i18') + '</span><span class="btn-signin">Sign In</span></div></header>' +
        '<div class="body"><h1 class="lb-title">Leaderboard</h1><div class="lb-period"><span class="on">1D</span><span>7D</span><span>30D</span><span>All</span></div>' +
        '<div class="lb-top">' + top.map(function (t, i) {
          return '<div class="lb-tc"><div class="lb-ra"><b>' + t[0] + '</b><img src="assets/img/lb-av' + (i + 1) + '-78.png" alt=""></div><div class="lb-res"><div class="n">' + t[1] + (t[2] ? '<span class="lb-x">' + I('x-handle', 'i12') + '@yeffjan</span>' : '') + '</div><span class="v num">' + t[3] + '</span><span class="r num">' + t[4] + '</span></div></div>';
        }).join('') + '</div>' +
        '<div class="lb-search" style="margin-top:112px">' + I('search16', 'i20') + '<span>Search by wallet address</span></div>' +
        '<div class="lb-sort"><span>Sort by</span><b>Realized PnL' + I('chev-down-s', 'i16') + '</b></div>' +
        '<div class="lb-list">' + rows.map(function (r, i) {
          return '<div class="lb-row"><span class="rk">' + r[0] + '</span><img src="assets/img/lb-av' + (i + 6) + '-40.png" alt=""><div class="nm"><b>' + r[1] + '</b>' + (r[2] ? '<span>' + r[2] + '</span>' : '') + '</div><div class="val"><b class="num">' + r[3] + '</b><span class="num">' + r[4] + '</span></div></div>';
        }).join('') + '</div>' +
        '<div class="lb-pg"><span class="nb">' + I('chev-left', 'i20') + '</span><div class="pgs"><span class="on">1</span><span>2</span><span>3</span><span>4</span><span>...</span><span>1410</span></div><span class="nb" style="transform:scaleX(-1)">' + I('chev-left', 'i20') + '</span></div></div>' +
        '<div class="bottom">' + bottomNav('leaderboard') + '</div>';
    }
  };

  // 02 · Copy Trading — Discover / Following / My Copy (H1–H4)
  var hub = { search: false, q: '' };
  function hubResults() {
    var q = hub.q.trim().toLowerCase(), searching = hub.search || !!q;
    var list = TRADERS.filter(function (t) { return !q || t.id.indexOf(q) >= 0 || (t.wallet && t.wallet.indexOf(q) >= 0); });
    if (searching && q && !list.length) {
      return '<div class="empty"><span class="empty-ic">' + I('search28', 'i28') + '</span><h2 class="h18">No traders match "' + esc(hub.q.trim()) + '"</h2><p>Check the wallet address or display name, or clear filters (At least 30 trading days is on).</p></div>' +
        '<div class="cta-row"><button type="button" class="btn outline s36" data-act="search-clear">Clear filters</button><button type="button" class="btn tertiary s36" data-act="search-clear">Clear search</button></div>';
    }
    if (searching && !q) return '';
    return list.map(traderCard).join('') + (searching ? '' : '<p class="t11">All metrics use the same 30-day period. Demo data is simulated — past performance does not guarantee future results.</p>');
  }
  function hubUpdate() {
    var searching = hub.search || !!hub.q.trim();
    var bc = $('#balCard'), sr = $('#sortRow'), rs = $('#results');
    if (bc) bc.hidden = searching; if (sr) sr.hidden = searching;
    if (rs) { var h = hubResults(); if (rs.dataset.h !== h) { rs.innerHTML = h; rs.dataset.h = h; } }
    var sb = $('#searchBox'); if (sb) sb.classList.toggle('focus', document.activeElement === $('#searchIn'));
  }
  SCREENS.hub = {
    title: function () { return 'Copy Trading'; },
    live: true,
    html: function (e) {
      var tab = (e.p && e.p.tab) || 'discover';
      var tabs = '<div class="utabs" role="tablist">' + [['discover', 'Discover'], ['following', 'Following'], ['mycopy', 'My Copy']].map(function (t) {
        return '<button type="button" role="tab" class="utab' + (t[0] === tab ? ' on' : '') + '" aria-selected="' + (t[0] === tab) + '" data-act="hub-tab" data-tab="' + t[0] + '">' + t[1] + '</button>';
      }).join('') + '</div>';
      var body = '<div class="card p16 cg12" id="balCard"><div class="h-row" style="gap:4px"><span class="f-l">Copy Balance</span>' + I('info12', 'i12 info-i') + '</div>' +
        '<div class="bal-v"><b class="num">' + money(st.copyAvailable) + '</b><span>USDC</span></div>' +
        '<p class="t11">Separate from your Trading Balance (' + money(st.tradingBalance) + '). Ready for Auto Copy.</p>' +
        '<div class="cta-row"><span class="btn tertiary s36">Transfer</span><button type="button" class="btn outline s36" data-act="sheet-how">How it works</button></div></div>' + tabs;
      if (tab === 'discover') {
        body += '<label class="search" id="searchBox">' + I('search16', 'i16') + '<span class="vh">Search trader or wallet</span><input id="searchIn" type="search" enterkeyhint="search" autocomplete="off" autocorrect="off" spellcheck="false" placeholder="Search trader or wallet" value="' + esc(hub.q) + '"></label>' +
          '<div class="sortrow" id="sortRow"><button type="button" class="pill" data-act="sheet-sort">Sort: ROI 30D' + I('chev-down-s', 'i12') + '</button><button type="button" class="pill" data-act="sheet-sort">Filters (1)' + I('chev-down-s', 'i12') + '</button><span class="t-ter" style="margin-left:auto">5 traders</span></div>' +
          '<div class="pad g16" id="results" style="padding:0"></div>';
      } else if (tab === 'following') {
        body += st.follow.on ? traderCard(TRADERS[0]) : '<div class="empty"><p>You’re not following any traders yet.</p></div>';
      } else {
        var c = st.copy;
        if (c) {
          var chip = c.status === 'active' ? '<span class="chip brand">Active · waiting</span>' : c.status === 'paused' ? '<span class="chip grey">Paused</span>' : '<span class="chip grey">Stopped</span>';
          body += '<button type="button" class="card tcard p14 cg8" data-act="open-mycopy" aria-label="kestrel Auto Copy"><div class="h-row"><span class="h14">kestrel</span><span style="margin-left:auto">' + chip + '</span></div><div class="rows">' +
            kv('Allocation', money(c.status === 'stopped' ? 0 : num(c.alloc))) + kv('Sizing', 'Fixed Amount · ' + money(num(c.margin))) + '</div></button>';
        } else body += '<div class="empty"><p>No Auto Copy yet.</p></div>';
      }
      return navBar('Copy Trading', { bell: true, backAct: 'hub-back' }) + '<div class="body"><div class="pad g16">' + body + '</div></div>';
    },
    mount: function (el) {
      var inp = $('#searchIn', el); if (!inp) return;
      hubUpdate();
      inp.addEventListener('focus', function () { hub.search = true; hubUpdate(); });
      inp.addEventListener('blur', function () { if (!inp.value.trim()) { hub.search = false; hub.q = ''; inp.value = ''; } hubUpdate(); });
      inp.addEventListener('input', function () { hub.q = inp.value; hubUpdate(); });
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); inp.blur(); } });
    }
  };

  // 03 · Trader profile (kestrel)
  SCREENS.profile = {
    title: function () { return 'Trader profile · kestrel'; },
    live: true,
    html: function () {
      var pos = kestrelPositions(), following = st.follow.on;
      var met = function (l, v, vc, sub) { return '<div class="metric"><div class="ml"><span>' + l + '</span>' + I('info12', 'i12 info-i') + '</div><b class="num ' + (vc || '') + '">' + v + '</b>' + (sub ? '<span class="t11">' + sub + '</span>' : '') + '</div>'; };
      var lastTrade = st.event.fired ? ago(st.event.at) : '12m ago';
      var note = following ? 'Following: notifications on. Auto Copy is ' + (copyActive() ? 'on.' : st.copy && st.copy.status === 'paused' ? 'paused.' : 'off.') : 'Follow is free. Auto Copy uses funds you allocate from Copy Balance.';
      return navBar('Trader profile', { bell: true }) + '<div class="body"><div class="pad g12">' +
        '<div class="ident"><span class="av av56">K</span><div class="nm"><div class="h-row"><span style="font-weight:600;font-size:20px;line-height:28px">kestrel</span><span class="chip brand">Active · last trade ' + lastTrade + '</span></div>' +
        '<div class="h-row" style="gap:6px"><span class="t-sec">0x4b2e…91aE</span>' + I('copy12', 'i12 t-ter') + '</div><span class="t11">Perps only · Trading since Jun 14, 2026</span></div></div>' +
        '<div class="socials"><div><b class="h14 num">238</b><span class="t11">Copiers</span></div><div><b class="h14 num">' + (D.followers + (following ? 1 : 0)).toLocaleString('en-US') + '</b><span class="t11">Followers</span></div><div><b class="h14">10%</b><span class="t11">Profit share</span></div></div>' +
        '<div class="seg"><span>7D</span><span class="on">30D</span><span>90D</span><span>All</span></div>' +
        '<div class="card p16 cg8"><div class="perf-h"><div><span class="t11">ROI 30D</span><div class="num t-brand" style="font-weight:500;font-size:24px;line-height:32px">+18.4%</div></div><div style="text-align:right"><span class="t11">PnL 30D</span><div class="h16 num t-brand">+$92,410</div></div></div>' +
        '<img src="assets/img/equity-chart.svg" width="326" height="96" alt="Account equity, last 30 days" style="width:100%;height:auto"><span class="t11">Account equity, last 30 days · simulated</span></div>' +
        '<div class="metrics">' + met('Max drawdown 30D', '−6.2%') + met('Win rate 30D', '61%', '', '48 of 79 trades') + met('Trading days', '142') + met('Avg. leverage', '7.4x') + met('Avg. hold time', '9h 20m') + met('Copier PnL 30D', '+$41.2K', 't-brand') + '</div>' +
        '<div class="utabs"><span class="utab">Positions (' + pos.length + ')</span><span class="utab">History</span></div>' +
        pos.map(function (p) { return positionCard(p); }).join('') +
        '<p class="t11">Trader statistics are calculated by RISEx from filled trades. Demo values are simulated.</p></div></div>' +
        '<div class="cta"><p class="cta-note">' + note + '</p><div class="cta-row">' +
        (following ? '<button type="button" class="btn tertiary" data-act="sheet-unfollow">Following</button>' : '<button type="button" class="btn outline" data-act="follow">Follow</button>') +
        '<button type="button" class="btn primary" data-act="auto-copy">Auto Copy</button></div></div>';
    },
    mount: function (el, e) {
      if (e.p && e.p.focus === 'eth') {
        var n = $('#pos-eth', el);
        if (n) { n.classList.add('hl'); setTimeout(function () { n.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, 60); }
      }
    }
  };

  // ---------- Auto Copy (Fixed Amount) 04–10 ----------
  function acDraft() { if (!st.draft.ac) st.draft.ac = { alloc: '', margin: '', lev: '', dev: '', mode: 'trader', sl: '' }; return st.draft.ac; }
  function acGuard() { if (copyLive()) return function () { backTo('profile'); }; return null; }
  function vAlloc(v) {
    var n = num(v); if (v === '') return { ok: false };
    if (!(n > 0)) return { ok: false, err: 'Enter an amount above 0 USDC.' };
    if (n > st.copyAvailable + 1e-9) return { ok: false, err: 'More than your available Copy Balance (' + money(st.copyAvailable) + ').' };
    return { ok: true };
  }
  function vMargin(v, alloc) {
    var n = num(v); if (v === '') return { ok: false };
    if (!(n > 0)) return { ok: false, err: 'Enter an amount above 0 USDC.' };
    if (n > num(alloc) + 1e-9) return { ok: false, err: 'Can’t be more than your ' + money(num(alloc)) + ' allocation.' };
    return { ok: true };
  }
  function vLev(v) { if (v === '') return { ok: true }; var n = num(v); return n >= 1 && n <= 25 ? { ok: true } : { ok: false, err: 'Enter a whole number from 1x to 25x, or leave it empty.' }; }
  function vDev(v) { if (v === '') return { ok: true }; var n = num(v); return n > 0 && n <= 10 ? { ok: true } : { ok: false, err: 'Enter 0.01–10%, or leave it empty.' }; }
  function vSl(v, touched) {
    if (v === '') return { ok: false, err: touched ? 'Enter a stop loss from 1% to 100% of initial margin.' : '' };
    var n = num(v);
    if (n === 0) return { ok: false, err: '0% would close at once. Enter 1–100% of initial margin.' };
    if (!(n >= 1 && n <= 100)) return { ok: false, err: 'Enter a stop loss from 1% to 100% of initial margin.' };
    return { ok: true };
  }
  var traderStrip = '<div class="card p12" style="flex-direction:row;align-items:center;gap:10px"><span class="av av32">K</span><div style="display:flex;flex-direction:column;min-width:0"><span class="h14">kestrel</span><span class="t11">ROI 30D +18.4% · Max DD 30D −6.2% · Profit share 10%</span></div></div>';

  SCREENS['ac-alloc'] = {
    title: function () { return 'Auto Copy · kestrel — Allocate funds'; },
    guard: acGuard,
    html: function () {
      var d = acDraft();
      var box = function (l, v, on, id) { return '<div class="card" style="flex:1 1 0;min-width:0;padding:10px;gap:2px;' + (on ? 'background:var(--bg-brand)' : '') + '"' + (id ? ' id="' + id + '"' : '') + '><span class="t11">' + l + '</span><b class="h14 num' + (on ? ' t-brand' : '') + '">' + v + '</b></div>'; };
      var q = [25, 50, 60, 100].map(function (p) { return '<button type="button" data-act="ac-quick" data-p="' + p + '">' + p + '%</button>'; }).join('');
      return navBar('Auto Copy · kestrel') + '<div class="body"><div class="pad g14">' + steps(1, 'Allocate funds') + traderStrip +
        '<div class="h-row" style="gap:6px">' + box('Trading', money(st.tradingBalance)) + I('chev-right12', 'i12 t-sec') + box('Copy Balance', money(st.copyAvailable)) + I('chev-right12', 'i12 t-sec') + '<div id="flowK" style="flex:1 1 0;min-width:0;display:flex"></div></div>' +
        field({ id: 'alloc', label: 'Allocate to kestrel', hint: 'Available ' + money(st.copyAvailable), ph: 'Enter amount', unit: 'USDC', dec: 2, fmt: true, val: d.alloc, max: 'ac-max', help: '' }) +
        '<div class="quick" id="quick">' + q + '</div></div></div>' +
        '<div class="cta"><p class="cta-note">We never move money from your Trading Balance automatically.</p><div class="cta-row">' + btn('Continue', { id: 'cont', act: 'ac-next', disabled: true }) + '</div></div>';
    },
    mount: function (el) {
      var d = acDraft();
      var upd = function (id, v) {
        if (id) { d.alloc = v; save(); }
        var r = vAlloc(d.alloc), n = num(d.alloc);
        $('#flowK').innerHTML = '<div class="card" style="flex:1 1 0;min-width:0;padding:10px;gap:2px;' + (r.ok ? 'background:var(--bg-brand)' : '') + '"><span class="t11">kestrel</span><b class="h14 num' + (r.ok ? ' t-brand' : '') + '">' + (r.ok ? money(n) : '—') + '</b></div>';
        setHelp('alloc', r.err || '', !!r.err);
        $('#h-alloc').hidden = !r.err;
        el.querySelectorAll('#quick button').forEach(function (b) { b.classList.toggle('on', r.ok && Math.abs(st.copyAvailable * b.dataset.p / 100 - n) < 0.005); });
        setBtn('cont', r.ok);
      };
      bindInputs(el, upd); upd();
      SCREENS['ac-alloc'].set = function (v) { setInput('alloc', v); upd('alloc', v); };
    }
  };

  SCREENS['ac-sizing'] = {
    title: function () { return 'Auto Copy · kestrel — Sizing'; },
    guard: function (e) { var g = acGuard(e); if (g) return g; if (!vAlloc(acDraft().alloc).ok) return function () { replace({ r: 'ac-alloc' }, 'back'); }; return null; },
    html: function () {
      var d = acDraft();
      return navBar('Auto Copy · kestrel') + '<div class="body"><div class="pad g14">' + steps(2, 'Sizing') +
        '<div class="seg"><span class="on">Fixed Amount</span><span>Fixed Ratio</span></div>' +
        field({ id: 'margin', label: 'Margin per new position', ph: 'Enter amount', unit: 'USDC', dec: 2, fmt: true, val: d.margin, help: '' }) +
        '<div class="notice">' + I('info16', 'i16') + '<div class="nt"><b>When kestrel adds to or reduces a position</b><p>Adds: Fixed Amount doesn\'t add more margin (proposed).<br>Reduces/closes: we reduce or close the same % of your copied part.</p></div></div>' +
        '<p class="t11">Fixed Ratio sizes each trade as a multiple of kestrel\'s notional instead. No portfolio-based mode.</p></div></div>' +
        '<div class="cta"><div class="cta-row">' + btn('Back', { v: 'outline', act: 'back' }) + btn('Continue', { id: 'cont', act: 'ac-next2', disabled: true }) + '</div></div>';
    },
    mount: function (el) {
      var d = acDraft();
      var upd = function (id, v) {
        if (id) { d.margin = v; save(); }
        var r = vMargin(d.margin, d.alloc);
        setHelp('margin', r.err || (r.ok ? 'Each time kestrel opens a NEW position, you open it with ' + money(num(d.margin)) + ' margin at kestrel\'s leverage (within your cap).' : 'Each time kestrel opens a NEW position, you open it with the margin you enter, at kestrel\'s leverage (within your cap).'), !!r.err);
        setBtn('cont', r.ok);
      };
      bindInputs(el, upd); upd();
    }
  };

  function riskFields(d, o) {
    var lev = field({ id: 'lev', label: 'Max leverage (optional)', ph: 'Enter leverage', unit: 'x', dec: 0, val: d.lev, help: 'Trades above this are skipped, not reduced.' });
    var dev = field({ id: 'dev', label: 'Max entry price deviation (optional)', ph: 'Enter percentage', unit: '%', dec: 2, val: d.dev, help: 'Skip if the price moved more than this from kestrel\'s fill.' });
    var slCard = '<div class="card p14 cg8"><div class="h-row" style="gap:6px"><span class="h14">Position stop loss</span>' + I('info12', 'i12 info-i') + '</div>' +
      '<div class="seg" role="radiogroup" aria-label="Stop loss mode"><button type="button" role="radio" class="seg-b' + (d.mode === 'trader' ? ' on' : '') + '" aria-checked="' + (d.mode === 'trader') + '" data-act="sl-mode" data-m="trader">Trader SL + my limit</button><button type="button" role="radio" class="seg-b' + (d.mode === 'mine' ? ' on' : '') + '" aria-checked="' + (d.mode === 'mine') + '" data-act="sl-mode" data-m="mine">My limit only</button></div>' +
      '<p class="t11" id="modeHelp">' + (d.mode === 'mine' ? 'Ignores kestrel\'s SL. kestrel\'s own reduce/close actions are still copied.' : 'Closes when kestrel\'s SL or your limit triggers first. kestrel can\'t widen your limit; if kestrel sets no SL, your limit is used.') + '</p>' +
      field({ id: 'sl', label: 'Stop loss per position', hint: '1–100%', ph: 'Enter percentage', unit: '% of initial margin', dec: 2, val: d.sl, help: '' }) +
      '<p class="t11">Trigger = initial margin × %. Measured on margin, not price.</p><p class="t11">Triggers a close; execution price and final loss may differ.</p></div>';
    return o.slFirst ? slCard + (o.between || '') + lev + dev : lev + dev + slCard;
  }
  function bindRisk(el, d, margin, onValid) {
    var touched = d._slTouched || false;
    var upd = function (id, v, ev) {
      if (id) { d[id] = v; if (id === 'sl' && (ev === 'blur' || v !== '')) touched = true; if (id === 'sl' && ev === 'input' && v === '' ) touched = true; d._slTouched = touched; save(); }
      var rl = vLev(d.lev), rd = vDev(d.dev), rs = vSl(d.sl, touched);
      setHelp('lev', rl.err || 'Trades above this are skipped, not reduced.', !!rl.err);
      setHelp('dev', rd.err || 'Skip if the price moved more than this from kestrel\'s fill.', !!rd.err);
      var m = usdc(margin);
      setHelp('sl', rs.err || (rs.ok ? '≈ ' + usdc(margin * num(d.sl) / 100) + ' USDC per position · based on ' + m + ' USDC initial margin' : '≈ — USDC per position · calculated after you enter a percentage (initial margin ' + m + ' USDC)'), !!rs.err);
      onValid(rl.ok && rd.ok && rs.ok);
    };
    bindInputs(el, upd); upd();
    return upd;
  }

  SCREENS['ac-risk'] = {
    title: function () { return 'Auto Copy · kestrel — Risk settings'; },
    guard: function (e) { var g = acGuard(e); if (g) return g; var d = acDraft(); if (!vAlloc(d.alloc).ok || !vMargin(d.margin, d.alloc).ok) return function () { replace({ r: 'ac-sizing' }, 'back'); }; return null; },
    html: function () {
      var d = acDraft();
      return navBar('Auto Copy · kestrel') + '<div class="body"><div class="pad g14">' + steps(3, 'Risk settings') + riskFields(d, {}) +
        '<p class="t11">Orders below the market minimum size are skipped with a reason.</p></div></div>' +
        '<div class="cta"><div class="cta-row">' + btn('Back', { v: 'outline', act: 'back' }) + btn('Continue', { id: 'cont', act: 'ac-next3', disabled: true }) + '</div></div>';
    },
    mount: function (el) { var d = acDraft(); this.upd = bindRisk(el, d, num(d.margin), function (ok) { setBtn('cont', ok); }); }
  };

  SCREENS['ac-review'] = {
    title: function () { return 'Auto Copy · kestrel — Review'; },
    guard: function (e) {
      var g = acGuard(e); if (g) return g; var d = acDraft();
      if (!vAlloc(d.alloc).ok || !vMargin(d.margin, d.alloc).ok || !(vLev(d.lev).ok && vDev(d.dev).ok && vSl(d.sl).ok)) return function () { replace({ r: 'ac-risk' }, 'back'); };
      return null;
    },
    html: function () {
      var d = acDraft(), a = num(d.alloc), m = num(d.margin), n = kestrelPositions().length;
      var sec = function (t, edit, rows, foot) { return '<div class="card p14 cg10"><div class="h-row"><span class="h14">' + t + '</span>' + (edit ? '<button type="button" class="link" style="margin-left:auto" data-act="' + edit + '">Edit</button>' : '') + '</div><div class="rows">' + rows + '</div>' + (foot ? '<p class="t11">' + foot + '</p>' : '') + '</div>'; };
      return navBar('Auto Copy · kestrel') + '<div class="body"><div class="pad g12">' + steps(4, 'Review') +
        sec('Funds', 'edit-alloc', kv('Trader', 'kestrel') + kv('Allocation', money(a) + ' from Copy Balance') + kv('Copy Balance left', money(st.copyAvailable - a) + ' available')) +
        sec('Sizing', 'edit-sizing', kv('Mode', 'Fixed Amount') + kv('Margin per new position', money(m)) + kv('Example', 'BTC 5x → ' + money(m) + ' margin · ' + money(m * 5) + ' notional')) +
        sec('Risk', 'edit-risk', kv('Max leverage', levTxt(d)) + kv('Max entry deviation', devTxt(d)) + kv('Position stop loss', slLabel(d)) + kv('My limit', d.sl + '% of initial margin ≈ ' + slAmt(d) + ' USDC')) +
        sec('What gets copied', '', kv('Copied', 'New positions opened after you start') + kv('Not copied', 'kestrel\'s ' + n + ' position' + (n === 1 ? '' : 's') + ' already open', 't-warn') + kv('Adds to a copied position', 'Not added (Fixed Amount)') + kv('Reduce / close', 'Same % on your copied part'), 'If kestrel already holds a market, we wait until it\'s closed and a new position opens.') +
        '<div class="card p14 cg10"><div class="h-row"><span class="h14">Fees</span><span class="link" style="margin-left:auto">Details</span></div><div class="rows">' + kv('Subscription', 'None') + kv('Trading fees &amp; funding', 'As usual') + kv('Profit share', '10% of net profit (proposed)') + '</div><p class="t11">Charged only on net profit above your high-water mark, when positions close. Tap Details for a worked example.</p></div>' +
        '<div class="notice">' + I('info16', 'i16') + '<div class="nt"><b>Permission</b><p>Trade-only access to your ' + money(a) + ' allocation. No withdrawals. You can pause or stop anytime.</p></div></div></div></div>' +
        '<div class="cta"><p class="cta-note">Next: sign a trade-only permission in your wallet.</p><div class="cta-row">' + btn('Start Auto Copy', { act: 'sheet-authorize' }) + '</div></div>';
    }
  };

  var walletTimer = null;
  SCREENS['ac-wallet'] = {
    title: function () { return 'Confirm in your wallet'; },
    guard: acGuard,
    html: function () {
      return '<div class="body" style="padding-top:var(--safe-t)"><div class="pad g16"><div style="height:120px"></div><div class="state"><span class="empty-ic spin-slow">' + I('clock28', 'i28') + '</span><h2>Confirm in your wallet</h2><p>Sign the trade-only permission for kestrel. Request expires in <span id="exp" class="num">4:58</span>.</p></div></div></div>' +
        '<div class="cta"><div class="cta-row">' + btn('Cancel', { v: 'outline', act: 'wallet-cancel' }) + '</div></div>';
    },
    mount: function () {
      var t0 = Date.now(), left = 298;
      var tick = setInterval(function () { var s = Math.max(0, left - Math.floor((Date.now() - t0) / 1000)); var n = $('#exp'); if (n) n.textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }, 1000);
      // Figma: 09 → 10 after 2.5 s (simulated wallet signature). Waits while the tab is hidden.
      var wait = function () { if (document.hidden) { walletTimer = setTimeout(wait, 400); return; } walletTimer = setTimeout(activate, 2500); };
      wait();
      this.unmount = function () { clearInterval(tick); clearTimeout(walletTimer); };
    }
  };
  function activate() {
    st = S.read();
    if (copyLive() || cur().r !== 'ac-wallet') return;
    var d = acDraft(), a = num(d.alloc), now = Date.now();
    if (!vAlloc(d.alloc).ok) { replace({ r: 'ac-alloc' }, 'back'); return; }
    st.copyAvailable = F.r2(st.copyAvailable - a);
    st.copy = { status: 'active', alloc: d.alloc, margin: d.margin, lev: d.lev, dev: d.dev, mode: d.mode, sl: d.sl, startedAt: now,
      log: [{ t: now, title: 'Auto Copy started', sub: 'Allocation ' + money(a) + ' · Fixed Amount ' + money(num(d.margin)) }] };
    st.draft.ac = null; save();
    clearTimeout(evTimer); // kestrel's next trade would now be copied; the follow demo event waits (see report)
    replace({ r: 'ac-on' }, 'fwd');
  }

  SCREENS['ac-on'] = {
    title: function () { return 'Auto Copy is on'; },
    guard: function () { if (!st.copy) return function () { backTo('profile'); }; return null; },
    html: function () {
      var c = st.copy;
      return '<div class="body" style="padding-top:var(--safe-t)"><div class="pad g16"><div style="height:60px"></div><div class="state"><span class="empty-ic ok">' + I('check28', 'i28') + '</span><h2>Auto Copy is on</h2><p>Waiting for kestrel\'s next new position. Positions kestrel already holds won\'t be copied.</p></div>' +
        '<div class="card p14 cg8"><div class="h-row"><span class="h14">kestrel</span><span class="chip brand" style="margin-left:auto">Active · waiting</span></div><div class="rows">' +
        kv('Allocation', money(num(c.alloc))) + kv('Sizing', 'Fixed Amount · ' + money(num(c.margin))) + kv('Max leverage', levTxt(c)) +
        kv('Stop loss / position', (c.mode === 'mine' ? 'My limit ' : 'Trader SL + ') + c.sl + '% (≈ ' + slAmt(c) + ' USDC)') + kv('Started', F.md(c.startedAt) + ', ' + F.hm(c.startedAt)) + '</div></div></div></div>' +
        '<div class="cta"><div class="cta-row">' + btn('Done', { v: 'outline', act: 'to-mycopy' }) + btn('View in My Copy', { act: 'to-mycopy' }) + '</div></div>';
    }
  };

  // 11 · My Copy — kestrel (Waiting / Paused / Stopped)
  SCREENS.mycopy = {
    title: function () { return 'kestrel · Auto Copy'; },
    live: true,
    guard: function () { if (!st.copy) return function () { replace({ r: 'hub', p: { tab: 'mycopy' } }, 'back'); }; return null; },
    html: function () {
      var c = st.copy, s = c.status, a = s === 'stopped' ? 0 : num(c.alloc);
      var sub = s === 'active' ? 'Fixed Amount ' + money(num(c.margin)) + (c.lev ? ' · max ' + c.lev + 'x' : '') + ' · since ' + F.hm(c.startedAt)
        : s === 'paused' ? 'Paused ' + F.hm(c.pausedAt) + ' · settings kept · started ' + F.hm(c.startedAt) : 'Stopped ' + F.hm(c.stoppedAt) + ' · settings removed';
      var chip = s === 'active' ? '<span class="chip brand">Active · Waiting</span>' : s === 'paused' ? '<span class="chip grey">Paused</span>' : '<span class="chip grey">Stopped</span>';
      var actions = s === 'stopped' ? '<div class="qa">' + btn('Back to Copy Trading', { v: 'tertiary', s: 's36', act: 'to-hub' }) + '</div>'
        : '<div class="qa">' + btn('Edit', { v: 'tertiary', s: 's36', act: 'mc-edit' }) + (s === 'active' ? btn('Pause', { v: 'tertiary', s: 's36', act: 'sheet-pause' }) : btn('Resume', { v: 'tertiary', s: 's36', act: 'mc-resume' })) + btn('Stop', { v: 'tertiary', s: 's36', act: 'sheet-stop' }) + '</div>';
      var logs = c.log.slice().reverse().map(function (l, i) { return '<div class="log"><span class="el' + (i === 0 && c.log.length > 1 ? ' ter' : '') + '"></span><div class="t"><b>' + l.title + '</b><p>' + l.sub + '</p></div><time>' + F.hm(l.t) + '</time></div>'; }).join('');
      return (s === 'active' ? navBar('', { backLabel: 'Back to Trading', backAct: 'go-trade' }) : navBar('kestrel · Auto Copy')) + '<div class="body"><div class="pad g12"><div class="card p14 cg10">' +
        '<div class="mc-h"><span class="av av36">K</span><div class="t"><span class="h16">kestrel</span><span class="t11">' + sub + '</span></div>' + chip + '</div><div class="rows">' +
        kv('Allocation', money(a)) + kv('In positions (margin)', '$0.00') + kv('Free to copy', money(a)) + kv('Unrealized PnL', '$0.00') + kv('Realized PnL', '$0.00') + kv('Fees paid', '$0.00') +
        kv('Stop loss / position', s === 'stopped' ? '—' : slShort(c)) + '</div>' + actions + '</div>' +
        '<div class="utabs"><span class="utab">Positions</span><span class="utab on">Activity</span></div>' +
        (s === 'active' ? '<p class="t-sec">Waiting for kestrel\'s next position. Positions kestrel opened before ' + F.hm(c.startedAt) + ' aren\'t copied.</p>' : '') +
        '<div>' + logs + '</div></div></div>';
    }
  };

  // 11a · Edit risk — saved settings, no open positions
  var edit = null;
  SCREENS['mc-edit'] = {
    title: function () { return 'Edit risk · kestrel'; },
    guard: function () { if (!copyLive()) return function () { backTo('mycopy'); }; return null; },
    html: function () {
      var c = st.copy;
      if (!edit) edit = { lev: c.lev, dev: c.dev, mode: c.mode, sl: c.sl };
      return navBar('Edit risk · kestrel') + '<div class="body"><div class="pad g14">' +
        riskFields(edit, { slFirst: true, between: '<p class="t-sec">No open copied positions yet. Changes apply to new positions.</p>' }) +
        '<p class="t11">Orders below the market minimum size are skipped with a reason.</p></div></div>' +
        '<div class="cta"><div class="cta-row">' + btn('Cancel', { v: 'outline', act: 'edit-cancel' }) + btn('Save', { id: 'save', act: 'edit-save', disabled: true }) + '</div></div>';
    },
    mount: function (el) {
      var c = st.copy;
      var check = function (ok) { var changed = edit.lev !== c.lev || edit.dev !== c.dev || edit.mode !== c.mode || edit.sl !== c.sl; setBtn('save', ok && changed); };
      this.upd = bindRisk(el, edit, num(c.margin), check);
    },
    unmount: function () {}
  };

  // ---------- Follow & Manual copy: 06–10 ----------
  function ctDraft() { if (!st.draft.ct) st.draft.ct = { margin: '' }; return st.draft.ct; }
  function vCt(v) {
    var n = num(v); if (v === '') return { ok: false };
    if (!(n > 0)) return { ok: false, err: 'Enter an amount above 0 USDC.' };
    var o = S.order(n);
    if (n + o.fee > st.tradingBalance + 1e-9) return { ok: false, err: 'Not enough Trading Balance. Available ' + money(st.tradingBalance) + ' incl. the trading fee.' };
    return { ok: true, o: o };
  }
  var signalHead = function () {
    var at = st.event.at;
    return '<div class="card p16 cg10"><div class="h-row" style="gap:10px"><span class="av av32">K</span><div style="flex:1;min-width:0;display:flex;flex-direction:column"><span class="h14">Manual copy from kestrel</span><span class="t11">Signal ' + F.md(at) + ', ' + F.hms(at) + ' · ' + ago(at) + '</span></div><span class="chip grey">Manual order</span></div>' +
      '<div class="tc-m"><div><span class="t11">Trader entry</span><b class="h14 num" style="font-size:14px;line-height:20px">' + money(E.traderEntry) + '</b></div><div><span class="t11">Price now</span><b class="h14 num" style="font-size:14px;line-height:20px">' + money(E.priceNow) + '</b></div><div><span class="t11">Difference</span><b class="h14 num t-warn" style="font-size:14px;line-height:20px">+' + ((E.priceNow / E.traderEntry - 1) * 100).toFixed(2) + '%</b></div></div></div>';
  };
  SCREENS['ct-draft'] = {
    title: function () { return 'Copy trade'; },
    guard: function () { if (!st.event.fired) return function () { backTo('trade'); }; if (st.manual) return function () { replace({ r: 'position' }, 'none'); }; return null; },
    html: function () {
      var d = ctDraft();
      return navBar('Copy trade') + '<div class="body"><div class="pad g12">' + signalHead() +
        '<div class="h-row"><span class="av" style="width:20px;height:20px;background:#627eea;color:#fff;font-size:10px;line-height:12px">E</span><span class="h16">ETH-PERP</span><span class="chip grey">Isolated</span><span class="t-sec" style="margin-left:auto;font-weight:500">Market order</span></div>' +
        '<div class="seg"><span class="on long">Long</span><span>Short</span></div>' +
        '<div class="f-st"><span class="f-l">Leverage</span><span class="h14 num" style="margin-left:auto">10x</span><span class="chip grey">From trader</span></div>' +
        field({ id: 'ctm', label: 'Margin', hint: 'Available ' + money(st.tradingBalance), ph: 'Enter amount', unit: 'USDC', dec: 2, fmt: true, val: d.margin, max: 'ct-max', help: '' }) +
        '<div class="card p12 cg8"><div class="h-row"><span style="font-weight:600">TP / SL from trader</span><span class="switch on" style="margin-left:auto" role="img" aria-label="On"></span></div><div class="rows">' + kv('Take profit', money(E.tp) + ' ✓', 't-brand') + kv('Stop loss', money(E.sl) + ' ✓', 't-brand') + '</div></div>' +
        '<div class="rows" id="ctRows"></div></div></div>' +
        '<div class="cta"><p class="cta-note">Uses your Trading Balance. This order won\'t follow kestrel\'s later trades.</p><div class="cta-row">' + btn('Review order', { id: 'cont', act: 'sheet-order', disabled: true }) + '</div></div>';
    },
    mount: function (el) {
      var d = ctDraft();
      var upd = function (id, v) {
        if (id) { d.margin = v; save(); }
        var r = vCt(d.margin), o = r.o;
        setHelp('ctm', r.err || ('Trader\'s size 14.65 ETH ($50.0K notional) ' + (r.ok ? '-' : '—') + ' reference only, not copied.'), !!r.err);
        $('#ctRows').innerHTML = kv('Size', r.ok ? o.size.toFixed(4) + ' ETH' : '—') + kv('Notional', r.ok ? money(o.notional) : '—') + kv('Est. liquidation price', r.ok ? money(o.liq) : '—') + kv('Est. trading fee (0.045%)', r.ok ? money(o.fee) : '—') + (r.ok ? kv('Trading Balance after', money(st.tradingBalance - o.margin - o.fee)) : '');
        setBtn('cont', r.ok);
      };
      bindInputs(el, upd); upd();
    }
  };

  var placeTimer = null;
  SCREENS['ct-placing'] = {
    title: function () { return 'Placing your order'; },
    guard: function () { if (st.manual) return function () { replace({ r: 'position' }, 'none'); }; if (!st.pending) return function () { backTo('ct-draft'); }; return null; },
    html: function () {
      var p = st.pending;
      return '<header class="nav"><span class="nav-spacer"></span></header>'.replace('<header class="nav">', '<header class="nav" style="box-shadow:none">') + '<div class="body"><div class="pad g16"><div style="height:80px"></div><div class="state"><span class="empty-ic spin-slow">' + I('clock28', 'i28') + '</span><h2>Placing your order…</h2><p>ETH-PERP Long 10x · market · ' + money(p.margin) + ' margin. Keep the app open.</p></div><p class="t11" style="text-align:center">Prototype only — no real order is sent.</p></div></div>';
    },
    mount: function () {
      var wait = function () { if (document.hidden) { placeTimer = setTimeout(wait, 400); return; } placeTimer = setTimeout(fill, 1500); };
      wait(); this.unmount = function () { clearTimeout(placeTimer); };
    }
  };
  function fill() {
    st = S.read();
    if (st.manual || !st.pending || cur().r !== 'ct-placing') return;
    var o = S.order(st.pending.margin);
    st.tradingBalance = F.r2(st.tradingBalance - o.margin - o.fee);
    st.manual = { margin: o.margin, size: o.size, fee: o.fee, liq: o.liq, pnl: o.pnl, pnlPct: o.pnlPct, filledAt: Date.now() };
    st.pending = null; st.draft.ct = null; save();
    // drop the draft/placing entries: Back from the position goes to where the copy started
    for (var j = nav.idx; j >= 0 && nav.stack[j].r !== 'ct-draft'; j--);
    if (j > 0) { nav.pending = function () { push({ r: 'position' }); }; history.go(j - 1 - nav.idx); } else replace({ r: 'position' }, 'fwd');
  }

  SCREENS.position = {
    title: function () { return 'Position · ETH-PERP'; },
    guard: function () { if (!st.manual) return function () { backTo('trade'); }; return null; },
    html: function () {
      var m = st.manual;
      return navBar('Position') + '<div class="body"><div class="pad g16"><div class="notice ok">' + I('check16', 'i16') + '<div class="nt"><b>Order filled</b><p class="num">' + m.size.toFixed(4) + ' ETH at ' + money(E.fill) + ' · ' + F.hms(m.filledAt) + '</p></div></div>' +
        '<div class="card p16 cg10"><div class="h-row" style="gap:6px"><span class="h16">ETH-PERP</span><span class="chip brand">Long 10x</span><span class="chip grey" style="margin-left:auto">Manual copy · kestrel</span></div><div class="rows">' +
        kv('Unrealized PnL', signed(m.pnl) + ' (' + (m.pnlPct >= 0 ? '+' : '') + m.pnlPct.toFixed(2) + '%)', 't-brand') + kv('Size', m.size.toFixed(4) + ' ETH') + kv('Entry · Mark', money(E.fill) + ' · ' + money(E.mark)) +
        kv('Margin', money(m.margin)) + kv('Liq. price', money(m.liq)) + kv('Take profit', money(E.tp)) + kv('Stop loss', money(E.sl)) + kv('Fees paid', money(m.fee)) + '</div></div>' +
        '<div class="notice">' + I('info16', 'i16') + '<div class="nt"><b>Self-managed</b><p>This position won\'t follow kestrel. You\'ll still get kestrel\'s notifications.</p></div></div></div></div>' +
        '<div class="cta"><div class="cta-row">' + btn('Done', { v: 'tertiary', act: 'go-trade' }) + '<span class="btn danger">Close position</span></div></div>';
    }
  };

  // ================= SHEETS =================
  var SHEETS = {
    sort: {
      title: function () { return 'Sort &amp; filter'; },
      html: function () {
        var opts = ['ROI 30D', 'Lowest max drawdown 30D', 'Copier PnL 30D', 'Trading days', 'Copiers'];
        return '<span class="sh-l">Period</span><div class="seg"><span>7D</span><span class="on">30D</span><span>90D</span></div><span class="sh-l">Sort by</span><div>' +
          opts.map(function (o, i) { return '<div class="opt' + (i ? '' : ' on') + '">' + o + '<span class="radio' + (i ? '' : ' on') + '"></span></div>'; }).join('') + '</div>' +
          '<span class="sh-l">Filters</span><div class="set"><div class="st"><b>At least 30 trading days</b><span class="t-ter">Hides traders without enough data</span></div><span class="switch on"></span></div>' +
          '<div class="set"><div class="st"><b>Max drawdown 30D ≤ 20%</b></div><span class="switch"></span></div>' +
          '<div class="cta-row">' + btn('Reset', { v: 'outline', act: 'sheet-close' }) + btn('Show traders', { act: 'sheet-close' }) + '</div>';
      }
    },
    how: {
      title: function () { return 'How copy trading works'; },
      html: function () {
        var it = [['Follow', 'Free. Get notified when a trader opens a new position, then decide and place your own order from your Trading Balance.'], ['Auto Copy', 'Copies only NEW positions the trader opens after you start, using funds you allocate from Copy Balance and your caps.'], ['ROI 30D', 'Net PnL ÷ average equity over the last 30 days, after fees and funding.'], ['Max drawdown 30D', 'Largest peak-to-trough drop in the trader\'s equity over the same 30 days.'], ['Copier PnL 30D', 'Combined PnL of all copiers over 30 days, after fees.'], ['Profit share', '10% of copiers\' net profit above their previous high-water mark. No subscription fee.']];
        return it.map(function (x) { return '<div class="item"><b>' + x[0] + '</b><p>' + x[1] + '</p></div>'; }).join('') + '<p class="t11">Proposed model for RISEx. Values in this demo are simulated.</p>' + btn('Got it', { act: 'sheet-close' });
      }
    },
    authorize: {
      title: function () { return 'Authorize Auto Copy'; },
      html: function () {
        var a = money(num(acDraft().alloc));
        var p = function (ok, t) { return '<div class="perm">' + I(ok ? 'check16' : 'xcircle16', 'i16 ' + (ok ? 't-brand' : 't-err')) + '<span>' + t + '</span></div>'; };
        return '<div class="card p14 cg10">' + p(true, 'Open, reduce and close perps positions to copy kestrel') + p(true, 'Only within your ' + a + ' allocation') + p(false, 'Can\'t withdraw or transfer your funds') + p(false, 'Can\'t trade your Trading Balance') + '</div>' +
          '<div class="rows">' + kv('Valid until', 'You stop copying kestrel') + kv('Signature', 'Wallet message · no gas') + '</div>' +
          '<div class="cta-row">' + btn('Cancel', { v: 'outline', act: 'sheet-close' }) + btn('Sign &amp; start', { act: 'sign-start' }) + '</div>';
      }
    },
    pause: {
      title: function () { return 'Pause Auto Copy?'; },
      html: function () {
        return '<div class="rows">' + kv('New positions from kestrel', 'Not copied while paused') + kv('Open copied positions', 'None') + kv('Allocation', usdc(num(st.copy.alloc)) + ' USDC stays reserved') + kv('Settings', 'Kept') + '</div>' +
          '<div class="notice">' + I('info16', 'i16') + '<div class="nt"><b>You can resume anytime</b><p>Positions kestrel opens while paused won\'t be copied later.</p></div></div>' +
          '<div class="cta-row">' + btn('Cancel', { v: 'outline', act: 'sheet-close' }) + btn('Pause', { act: 'mc-pause' }) + '</div>';
      }
    },
    stop: {
      title: function () { return 'Stop copying kestrel?'; },
      html: function () {
        return '<div class="rows">' + kv('Open copied positions', 'None — nothing to close') + kv('Allocation returned', usdc(num(st.copy.alloc)) + ' USDC → Copy Balance') + kv('Settings', 'Removed') + '</div>' +
          '<div class="notice">' + I('info16', 'i16') + '<div class="nt"><b>No copy orders are open</b><p>You can start Auto Copy for kestrel again later.</p></div></div>' +
          '<div class="cta-row">' + btn('Cancel', { v: 'outline', act: 'sheet-close' }) + btn('Stop Auto Copy', { v: 'danger', act: 'mc-stop' }) + '</div>';
      }
    },
    unfollow: {
      title: function () { return 'Unfollow kestrel?'; },
      html: function () {
        var c = st.copy;
        return '<p class="t14 t-sec">You\'ll stop getting notifications when kestrel opens new positions.</p>' +
          (copyLive() ? '<div class="notice">' + I('info16', 'i16') + '<div class="nt"><b>Auto Copy keeps running</b><p>You also Auto Copy kestrel (' + money(num(c.alloc)) + ' allocated). Unfollowing won\'t pause or stop it - manage it in My Copy.</p></div></div>' : '') +
          '<div class="cta-row">' + btn('Cancel', { v: 'outline', act: 'sheet-close' }) + btn('Unfollow', { v: 'danger', act: 'unfollow' }) + '</div>';
      }
    },
    order: {
      title: function () { return 'Review manual order'; },
      html: function () {
        var o = S.order(num(ctDraft().margin));
        return '<div class="rows">' + kv('Market', 'ETH-PERP · Long · 10x Isolated') + kv('Order type', 'Market (max slippage 0.5%)') + kv('Margin', money(o.margin)) + kv('Size · Notional', o.size.toFixed(4) + ' ETH · ' + money(o.notional)) +
          kv('Price now', money(E.priceNow)) + kv('Trader entry', money(E.traderEntry) + ' (+' + ((E.priceNow / E.traderEntry - 1) * 100).toFixed(2) + '%)', 't-warn') + '<div style="height:1px;background:var(--border-secondary)"></div>' +
          kv('Take profit', money(E.tp)) + kv('Stop loss', money(E.sl)) + kv('Est. liquidation price', money(o.liq)) + kv('Est. trading fee', money(o.fee)) + kv('Paid from', 'Trading Balance') + kv('Source', 'kestrel · signal ' + F.hm(st.event.at)) + '</div>' +
          '<div class="notice">' + I('info16', 'i16') + '<div class="nt"><b>Self-managed position</b><p>It won\'t close or change when kestrel does. No profit share on manual copies.</p></div></div>' +
          '<div class="cta-row">' + btn('Edit', { v: 'outline', act: 'sheet-close' }) + btn('Confirm order', { act: 'confirm-order', id: 'confirmOrder' }) + '</div>';
      }
    }
  };

  // ================= ACTIONS =================
  var busy = false; // blocks double submits while a transition is in flight
  function once(fn) { if (busy) return; busy = true; setTimeout(function () { busy = false; }, 450); fn(); }
  var ACTS = {
    back: function () { back(); },
    'hub-back': function () { hub.search = false; hub.q = ''; backTo('trade'); },
    'go-trade': function () { backTo('trade'); },
    'go-hub': function () { hub.search = false; hub.q = ''; push({ r: 'hub', p: { tab: 'discover' } }); },
    'go-leaderboard': function () { push({ r: 'leaderboard' }); },
    'to-hub': function () { backTo('hub'); },
    'hub-tab': function (b) { hub.search = false; hub.q = ''; replace({ r: 'hub', p: { tab: b.dataset.tab } }, 'none'); },
    'search-clear': function () { hub.search = false; hub.q = ''; var i = $('#searchIn'); if (i) { i.value = ''; i.blur(); } hubUpdate(); },
    'sheet-sort': function () { openSheet('sort'); },
    'sheet-how': function () { openSheet('how'); },
    'sheet-close': function () { closeSheet(); },
    'open-profile': function () { push({ r: 'profile' }); },
    'open-mycopy': function () { push({ r: 'mycopy' }); },
    'open-position': function () { push({ r: 'position' }); },
    bell: function () {
      if (st.event.fired) signalToast(); // no Notification Center in Figma: the bell brings back the latest notification
    },
    follow: function () {
      once(function () {
        st.follow = { on: true, at: Date.now() }; save(); refresh();
        toast('follow', { ok: true, icon: 'check16', title: 'You\'re following kestrel', body: 'We\'ll notify you when kestrel opens a new position. Auto Copy is ' + (copyActive() ? 'on.' : copyLive() ? 'paused.' : 'still off.'), ms: 2800 });
        scheduleEvent();
      });
    },
    'sheet-unfollow': function () { openSheet('unfollow'); },
    unfollow: function () { once(function () { st.follow = { on: false, at: 0 }; save(); clearTimeout(evTimer); dismissToast('follow', true); back(); }); },
    'auto-copy': function () { if (copyLive()) push({ r: 'mycopy' }); else push({ r: 'ac-alloc' }); },
    'ac-max': function () { SCREENS['ac-alloc'].set(usdc(st.copyAvailable).replace(/,/g, '')); },
    'ac-quick': function (b) { SCREENS['ac-alloc'].set((Math.floor(st.copyAvailable * b.dataset.p) / 100).toFixed(2)); },
    'ac-next': function () { if (vAlloc(acDraft().alloc).ok) once(function () { push({ r: 'ac-sizing' }); }); },
    'ac-next2': function () { var d = acDraft(); if (vMargin(d.margin, d.alloc).ok) once(function () { push({ r: 'ac-risk' }); }); },
    'ac-next3': function () { var d = acDraft(); if (vLev(d.lev).ok && vDev(d.dev).ok && vSl(d.sl).ok) once(function () { push({ r: 'ac-review' }); }); },
    'sl-mode': function (b) {
      var target = mounted.e.r === 'mc-edit' ? edit : acDraft();
      target.mode = b.dataset.m; save();
      mounted.el.querySelectorAll('[data-act="sl-mode"]').forEach(function (x) { var on = x.dataset.m === target.mode; x.classList.toggle('on', on); x.setAttribute('aria-checked', on); });
      $('#modeHelp').textContent = target.mode === 'mine' ? 'Ignores kestrel\'s SL. kestrel\'s own reduce/close actions are still copied.' : 'Closes when kestrel\'s SL or your limit triggers first. kestrel can\'t widen your limit; if kestrel sets no SL, your limit is used.';
      if (mounted.scr.upd) mounted.scr.upd();
    },
    'edit-alloc': function () { backTo('ac-alloc'); },
    'edit-sizing': function () { backTo('ac-sizing'); },
    'edit-risk': function () { backTo('ac-risk'); },
    'sheet-authorize': function () { openSheet('authorize'); },
    'sign-start': function (b) { once(function () { b.classList.add('is-loading'); replace({ r: 'ac-wallet' }, 'fwd'); }); },
    'wallet-cancel': function () { back(); },
    'to-mycopy': function () { once(function () { backTo('profile', function () { push({ r: 'mycopy' }); }); }); },
    'mc-edit': function () { edit = null; push({ r: 'mc-edit' }); },
    'edit-cancel': function () { edit = null; back(); },
    'edit-save': function () {
      once(function () {
        var c = st.copy; c.lev = edit.lev; c.dev = edit.dev; c.mode = edit.mode; c.sl = edit.sl; save(); edit = null; back();
      });
    },
    'sheet-pause': function () { openSheet('pause'); },
    'sheet-stop': function () { openSheet('stop'); },
    'mc-pause': function () {
      once(function () { var now = Date.now(); st.copy.status = 'paused'; st.copy.pausedAt = now; st.copy.log.push({ t: now, title: 'Auto Copy paused', sub: 'No open positions · settings kept' }); save(); back(); scheduleEvent(); });
    },
    'mc-resume': function () {
      once(function () { var now = Date.now(); st.copy.status = 'active'; st.copy.log.push({ t: now, title: 'Auto Copy resumed', sub: 'Settings kept · waiting for kestrel\'s next position' }); save(); clearTimeout(evTimer); refresh(); });
    },
    'mc-stop': function () {
      once(function () {
        var now = Date.now(), a = num(st.copy.alloc);
        st.copyAvailable = F.r2(st.copyAvailable + a); st.copy.status = 'stopped'; st.copy.stoppedAt = now;
        st.copy.log.push({ t: now, title: 'Auto Copy stopped', sub: usdc(a) + ' USDC returned to Copy Balance' }); save();
        back(); scheduleEvent();
      });
    },
    'sig-view': function () { st.notif.unread = false; save(); dismissToast('signal'); if (cur().r === 'profile') replace({ r: 'profile', p: { focus: 'eth' } }, 'none'); else push({ r: 'profile', p: { focus: 'eth' } }); },
    'sig-copy': function () { st.notif.unread = false; save(); dismissToast('signal'); if (st.manual) push({ r: 'position' }); else push({ r: 'ct-draft' }); },
    'ct-max': function () {
      var max = Math.floor(st.tradingBalance / (1 + E.lev * E.feeRate) * 100) / 100;
      var inp = $('#in-ctm'); inp.value = max.toFixed(2); inp.dispatchEvent(new Event('input'));
    },
    'sheet-order': function () { if (vCt(ctDraft().margin).ok) openSheet('order'); },
    'confirm-order': function (b) {
      if (st.pending || st.manual) return;
      once(function () { b.classList.add('is-loading'); st.pending = { margin: num(ctDraft().margin), at: Date.now() }; save(); replace({ r: 'ct-placing' }, 'fwd'); });
    }
  };
  document.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-act]');
    if (!b || b.disabled || !device.contains(b)) return;
    var fn = ACTS[b.dataset.act]; if (!fn) return;
    ev.preventDefault(); fn(b);
  });
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && cur().sheet) { ev.preventDefault(); closeSheet(); } });

  // ---------- reset ----------
  function resetDemo() { S.reset(); location.replace(location.pathname); }
  document.getElementById('demoReset').addEventListener('click', resetDemo);
  if (/[?&]reset\b/.test(location.search)) { S.reset(); history.replaceState(null, '', location.pathname); st = S.read(); }

  // ---------- keyboard / viewport ----------
  if (window.visualViewport) {
    var vv = window.visualViewport;
    var fit = function () { if (window.innerWidth < 600 || window.innerHeight < 700) document.documentElement.style.setProperty('--app-h', vv.height + 'px'); else document.documentElement.style.removeProperty('--app-h'); window.scrollTo(0, 0); };
    vv.addEventListener('resize', fit); fit();
  }

  // ---------- other tabs ----------
  window.addEventListener('storage', function (e) { if (e.key === S.KEY) { st = S.read(); refreshLive(); } });

  // ---------- boot ----------
  (function boot() {
    var saved = null; try { saved = JSON.parse(sessionStorage.getItem(NAVKEY) || 'null'); } catch (e) {}
    var hs = history.state;
    if (saved && saved.stack && hs && typeof hs.i === 'number' && hs.i < saved.stack.length) {
      nav.stack = saved.stack; nav.idx = hs.i;
      var c = cur();
      if (c.r === 'ac-wallet') nav.stack[nav.idx] = { r: 'ac-review' };      // the wallet request does not survive a reload
      if (c.r === 'ct-placing' && !st.pending) nav.stack[nav.idx] = { r: st.manual ? 'position' : 'ct-draft' };
      history.replaceState({ i: nav.idx }, '', '#' + cur().r);
    } else {
      nav.stack = [{ r: 'trade' }]; nav.idx = 0;
      history.replaceState({ i: 0 }, '', location.pathname + location.search);
    }
    navSave(); render('none'); scheduleEvent();
  })();
})();
