# RISEx Social Trading — mobile prototype

Interactive web prototype of four flows from Figma section **"7. Social Trading — Main flows (Mobile)"**
(`133:114939`, page Assignment). Mobile only; on a computer it shows a centred 390 px phone frame.

Static site, no build step, no network calls: no wallet, no real order, no real money.

## Flows (all start on 01 · Trade (Perp))

| Flow | Path |
|---|---|
| Entry & Copy Trading hub | Trade → Copy Trading → Sort & filter / How it works / search (no results) → Back; Trade → Leaderboard (reference snapshot) → Chart |
| Auto Copy — Fixed Amount | Profile → Allocate → Sizing → Risk settings → Review → Authorize → Confirm in wallet → Auto Copy is on → My Copy (Waiting) → Edit / Pause / Resume / Stop |
| Follow & Manual copy | Profile → Follow → (3 s later) kestrel opens ETH-PERP Long 10x → Copy trade → margin → Review → Placing → Position → Done → Trade |
| Follow & Unfollow | Profile → Follow → Following → Unfollow kestrel? → Unfollow / Cancel |

## Run locally

```bash
cd prototypes/social-trading-mobile
python3 -m http.server 8767
```

Open http://127.0.0.1:8767/.

## Deploy

Live: https://chinchin12345.github.io/risex-social-trading-prototype/ (GitHub Pages, repo `Chinchin12345/risex-social-trading-prototype`).
Upload this folder as-is to any static HTTPS host; `index.html` is the entry point.

## Demo data (illustrative)

- Copy Balance 500 USDC; Trading Balance 1,950 USDC (Figma 02: "Separate from your Trading Balance ($1,950.00)").
- kestrel's simulated trade: ETH-PERP Long 10x, entry 3,412.50, price now 3,418.20, fill 3,418.40, mark 3,421.00, TP 3,650, SL 3,300, fee 0.045 %.
- 100 USDC margin → 0.2925 ETH, notional 1,000, est. liq. 3,094.60, fee 0.45, Trading Balance after 1,849.55.

## Reset

- On a computer: **Restart demo** (bottom right, outside the phone frame).
- On a phone: open the link with `?reset`, e.g. https://chinchin12345.github.io/risex-social-trading-prototype/?reset

State lives in `localStorage` under its own key `risex-social-demo-v1` (6-hour expiry) and the navigation stack in
`sessionStorage`; neither touches the On-ramp / Off-ramp demos on the same origin.

## Files

| File | Role |
|---|---|
| `index.html` | Shell: device frame, stage, overlay, toasts |
| `assets/app.js` | Router (history-backed stack), screens, sheets, validation, simulated events |
| `assets/app.css` | RISEx tokens (from Figma variables) and components |
| `assets/store.js` | Demo state and order maths |
| `assets/icons.js` | Icons exported from Figma (`RISEx/Icon/*`), recoloured to `currentColor` |
| `assets/img/` | Logo, BTC, chart canvas, equity line, leaderboard avatars exported from Figma |
| `assets/fonts/` | Geist / Geist Mono (self-hosted, OFL) |
