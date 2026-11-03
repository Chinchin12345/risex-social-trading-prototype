/* Demo state for the Social Trading mobile prototype.
   Kept under its own localStorage key so it never reads, writes or clears the
   On-ramp / Off-ramp demos (all GitHub Pages projects share one origin). */
(function () {
  var KEY = 'risex-social-demo-v1';
  var TTL = 6 * 60 * 60 * 1000; // a demo older than six hours starts fresh

  // Illustrative numbers from Figma section "7. Social Trading — Main flows (Mobile)".
  var DEMO = {
    copyBalance: 500,        // bar "Auto Copy flow - fixed amount (giả định Copy Balance đã có $500)"
    tradingBalance: 1950,    // 02 · Copy Trading — Discover: "Separate from your Trading Balance ($1,950.00)"
    followers: 1204,
    eth: {
      market: 'ETH-PERP', side: 'Long', lev: 10,
      traderEntry: 3412.50, priceNow: 3418.20, fill: 3418.40, mark: 3421.00,
      tp: 3650, sl: 3300, traderSize: 14.65, traderNotional: 50000,
      feeRate: 0.00045, slippage: 0.5
    },
    eventDelayMs: 3000       // 04 · Following → 05 after 3 s in Figma
  };

  function blank() {
    return {
      v: 1, updatedAt: Date.now(),
      copyAvailable: DEMO.copyBalance,
      tradingBalance: DEMO.tradingBalance,
      follow: { on: false, at: 0 },
      event: { fired: false, at: 0 },      // kestrel opens ETH-PERP Long 10x (once per demo)
      notif: { unread: false },
      copy: null,                          // saved Auto Copy configuration for kestrel
      draft: { ac: null, ct: null },
      manual: null                         // manual copy position from the ETH-PERP signal
    };
  }
  function read() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return blank();
      var s = JSON.parse(raw);
      if (!s || s.v !== 1 || Date.now() - (s.updatedAt || 0) > TTL) return blank();
      return s;
    } catch (e) { return blank(); }
  }
  function write(s) {
    s.updatedAt = Date.now();
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {}
    return s;
  }
  function reset() {
    try { localStorage.removeItem(KEY); sessionStorage.removeItem(KEY + ':nav'); } catch (e) {}
  }

  var r2 = function (n) { return Math.round(n * 100) / 100; };
  var money = function (n) { var s = Math.abs(r2(n)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); return (n < 0 ? '−$' : '$') + s; };
  var usdc = function (n) { return r2(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  var pad = function (n) { return String(n).padStart(2, '0'); };
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var hm = function (t) { var d = new Date(t); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  var hms = function (t) { var d = new Date(t); return hm(t) + ':' + pad(d.getSeconds()); };
  var md = function (t) { var d = new Date(t); return MON[d.getMonth()] + ' ' + d.getDate(); };

  // Manual copy order maths (ETH-PERP, isolated, market). Matches Figma 07/08/10 for 100 USDC.
  function order(margin) {
    var e = DEMO.eth, notional = r2(margin * e.lev);
    var size = Math.floor(notional / e.priceNow * 10000) / 10000;
    var fee = r2(notional * e.feeRate);
    var liq = r2(e.priceNow * (1 - 1 / e.lev + 0.00533));
    var pnl = r2(size * (e.mark - e.fill));
    return { margin: r2(margin), notional: notional, size: size, fee: fee, liq: liq, pnl: pnl, pnlPct: margin ? r2(pnl / margin * 100) : 0 };
  }

  window.Store = { KEY: KEY, DEMO: DEMO, read: read, write: write, reset: reset, blank: blank, order: order,
    fmt: { r2: r2, money: money, usdc: usdc, hm: hm, hms: hms, md: md } };
})();
