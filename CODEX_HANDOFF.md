# Codex Handoff Guide

## Project Identity

- Project path: `C:\Users\Admin\Desktop\newchart`
- App type: client-heavy `Next.js` TradingView Charting Library web app
- Target deploy: `Vercel`
- Runtime model: pure web app, no custom backend required for market data
- Persistence:
  - TradingView save/load: `Firebase Firestore`
  - symbol catalog cache: `IndexedDB`
  - some lightweight client state may still use browser storage helpers

This file is intended for future Codex agents. Read this before changing architecture, datasource routing, replay, or save/load behavior.

## Core User Requirements

The user wants a TradingView-style charting platform with these rules:

- The page should be dominated by the TradingView chart itself.
- Avoid extra custom app chrome unless it is strictly necessary.
- Prefer TradingView widget APIs over building custom UI with separate divs/buttons.
- Datasources must be modular and extendable.
- Current supported datasources:
  - `BINANCE_SPOT`
  - `BINANCE_FUTURES`
  - `OANDA`
- Search must support cross-source discovery:
  - source filter includes `All Sources`
  - symbol type filter includes `All`
- Futures symbol search convention:
  - `.P` suffix means Binance Futures
- Spot symbol search convention:
  - `.S` suffix means Binance Spot
- OANDA symbols should resolve to OANDA, not accidentally fall back to Binance.
- Replay is a first-class feature and should remain close to TradingView behavior.
- Save/load should use Firebase, not local-only storage.
- Browser title must update with:
  - current symbol
  - last price
  - direction arrow up/down
- Timezone should be `Asia/Ho_Chi_Minh` (UTC+7).

## Current Stack

- Framework: `Next.js 15`
- React: `19`
- TypeScript
- TradingView Charting Library from local static assets
- Firebase client SDK
- `idb` for IndexedDB cache
- Playwright used for smoke testing

## Important NPM Dependencies

From `package.json`:

- `next`
- `react`
- `react-dom`
- `firebase`
- `idb`
- `playwright`
- `typescript`

## Main App Structure

- App entry: [C:\Users\Admin\Desktop\newchart\app\page.tsx](C:\Users\Admin\Desktop\newchart\app\page.tsx)
- Global styles: [C:\Users\Admin\Desktop\newchart\app\globals.css](C:\Users\Admin\Desktop\newchart\app\globals.css)
- Not found page: [C:\Users\Admin\Desktop\newchart\app\not-found.tsx](C:\Users\Admin\Desktop\newchart\app\not-found.tsx)
- PWA manifest route: [C:\Users\Admin\Desktop\newchart\app\manifest.ts](C:\Users\Admin\Desktop\newchart\app\manifest.ts) if present, or the static manifest route if the app is using that path

Main components:

- Shell: [C:\Users\Admin\Desktop\newchart\components\chart\chart-app-shell.tsx](C:\Users\Admin\Desktop\newchart\components\chart\chart-app-shell.tsx)
- Widget host: [C:\Users\Admin\Desktop\newchart\components\chart\tradingview-host.tsx](C:\Users\Admin\Desktop\newchart\components\chart\tradingview-host.tsx)

Core libraries:

- Datasource types: [C:\Users\Admin\Desktop\newchart\lib\datasources\types.ts](C:\Users\Admin\Desktop\newchart\lib\datasources\types.ts)
- Datasource base class: [C:\Users\Admin\Desktop\newchart\lib\datasources\base-adapter.ts](C:\Users\Admin\Desktop\newchart\lib\datasources\base-adapter.ts)
- Datasource registry: [C:\Users\Admin\Desktop\newchart\lib\datasources\registry.ts](C:\Users\Admin\Desktop\newchart\lib\datasources\registry.ts)
- TradingView datafeed: [C:\Users\Admin\Desktop\newchart\lib\datasources\tradingview-datafeed.ts](C:\Users\Admin\Desktop\newchart\lib\datasources\tradingview-datafeed.ts)
- Binance adapter: [C:\Users\Admin\Desktop\newchart\lib\datasources\binance-adapter.ts](C:\Users\Admin\Desktop\newchart\lib\datasources\binance-adapter.ts)
- OANDA adapter: [C:\Users\Admin\Desktop\newchart\lib\datasources\oanda-adapter.ts](C:\Users\Admin\Desktop\newchart\lib\datasources\oanda-adapter.ts)
- Replay controller: [C:\Users\Admin\Desktop\newchart\lib\replay\replay-controller.ts](C:\Users\Admin\Desktop\newchart\lib\replay\replay-controller.ts)
- Firebase client: [C:\Users\Admin\Desktop\newchart\lib\firebase\client.ts](C:\Users\Admin\Desktop\newchart\lib\firebase\client.ts)
- Firestore layout store: [C:\Users\Admin\Desktop\newchart\lib\storage\chart-layout-store.ts](C:\Users\Admin\Desktop\newchart\lib\storage\chart-layout-store.ts)
- TradingView save/load adapter bridge: [C:\Users\Admin\Desktop\newchart\lib\storage\tv-save-load-adapter.ts](C:\Users\Admin\Desktop\newchart\lib\storage\tv-save-load-adapter.ts)
- Symbol cache: [C:\Users\Admin\Desktop\newchart\lib\storage\symbol-cache.ts](C:\Users\Admin\Desktop\newchart\lib\storage\symbol-cache.ts)

Static assets:

- TradingView library assets are expected under `public/charting_library`
- Custom studies are under `public/tv-custom-studies`

## Architecture Rules That Must Not Be Broken

### 1. Datasources must stay isolated

Every datasource must keep its own:

- symbol namespace
- REST base URL
- websocket/stream URL
- symbol normalization rules
- history retrieval logic
- realtime subscription logic

Do not add fallback behavior that silently routes unknown symbols to Binance Spot before checking registry resolution. This caused real bugs such as `XAU_USD` resolving to Binance Spot by mistake.

### 2. New datasources should inherit the base adapter

Use the datasource inheritance pattern already established:

- create a class extending `BaseAdapter`
- implement datasource-specific methods
- register it in `registry.ts`

Do not bypass the registry with one-off symbol parsing in UI components.

### 3. Search must stay source-aware and cross-source capable

Current intended behavior:

- exchange/source filter includes `ALL`
- symbol type filter includes `all`
- symbol search should work across all sources without the user having to manually switch source
- suffix `.P` forces Binance Futures
- suffix `.S` forces Binance Spot

### 4. TradingView widget should remain the primary UI

The user explicitly asked to remove extra custom navs, symbol lists, and unnecessary buttons. Custom UI should be kept to:

- loading/error overlays
- replay-specific overlay and controls only where TradingView APIs are not enough

Avoid reintroducing custom sidebars or shell elements that duplicate built-in TradingView UI.

## Datasource Design

## Datasource Interface

See [C:\Users\Admin\Desktop\newchart\lib\datasources\types.ts](C:\Users\Admin\Desktop\newchart\lib\datasources\types.ts).

Each adapter conforms to:

- `id`
- `label`
- `marketType`
- `supportedResolutions`
- `initialize()`
- `getSymbols()`
- `canResolveInput()`
- `normalizeInputSymbol()`
- `searchSymbols()`
- `resolveSymbol()`
- `getBars()`
- `subscribeBars()`
- `unsubscribeBars()`

## Active Datasources

### Binance Spot

- datasource id: `BINANCE_SPOT`
- market type: `spot`
- symbol examples: `BTCUSDT`, `ETHUSDT`

### Binance Futures

- datasource id: `BINANCE_FUTURES`
- market type: `futures`
- symbol examples:
  - search display: `BTCUSDT.P`
  - internal full name: `BINANCE_FUTURES:BTCUSDT`

### OANDA

- datasource id: `OANDA`
- market type: `forex`
- instruments include:
  - major forex pairs
  - gold
  - silver
  - oil
- examples:
  - `OANDA:XAU_USD`
  - `OANDA:EUR_USD`
  - `OANDA:WTICO_USD`

## OANDA-Specific Rules

OANDA has special market gap handling and this is important.

The implementation references legacy behavior from:

- [C:\Users\Admin\Desktop\newchart\datafeeds\oanda-datasource.js](C:\Users\Admin\Desktop\newchart\datafeeds\oanda-datasource.js)

Key expectations:

- preserve gap handling for weekend and holiday behavior
- do not assume continuous crypto-style data
- for higher timeframes, gap filling logic matters
- if a request lands inside a gap and returns no candles, fetch earlier bars so the chart does not appear empty

If you touch OANDA history behavior, compare against the legacy datasource file before shipping changes.

## Symbol Search Behavior

Implemented in [C:\Users\Admin\Desktop\newchart\lib\datasources\tradingview-datafeed.ts](C:\Users\Admin\Desktop\newchart\lib\datasources\tradingview-datafeed.ts).

Current expected behavior:

- search source filter includes:
  - `All Sources`
  - `BINANCE_SPOT`
  - `BINANCE_FUTURES`
  - `OANDA`
- search type filter includes:
  - `All`
  - `Spot`
  - `Futures`
  - `Forex`
- searching `BTCUSDT` with source `All Sources` should return all matching source variants
- searching `XAU_USD` should resolve to OANDA

## Symbol Cache Behavior

The user explicitly asked to avoid repeatedly loading symbol lists from exchanges.

Required behavior:

- symbol catalogs should be loaded during datasource initialization
- subsequent search should read from cache
- do not repeatedly request exchange instrument catalogs for each search action

Current caching helper:

- [C:\Users\Admin\Desktop\newchart\lib\storage\symbol-cache.ts](C:\Users\Admin\Desktop\newchart\lib\storage\symbol-cache.ts)

## Replay System

Replay is one of the most important features to the user.

Core implementation:

- [C:\Users\Admin\Desktop\newchart\lib\replay\replay-controller.ts](C:\Users\Admin\Desktop\newchart\lib\replay\replay-controller.ts)

## Replay Requirements Already Established

- Replay must feel close to TradingView.
- Replay should not degrade the normal chart UI.
- Replay mode should preserve the normal chart UI as much as possible.
- Replay selection uses a vertical line and shaded overlay.
- Replay can preload data into cache rather than continuously requesting during playback.
- If replay chart requests bars older than the preload start, the system should backfill older bars from server.
- If replay panel closes, replay mode should stop and the app should return to normal mode.

## Replay UI Expectations

These details were explicitly requested by the user:

- selection line styling was customized heavily
- replay selection stamp contains:
  - replay time label
  - `Start` button
- the line and scissors cursor behavior were refined several times

If you change replay UX, re-check `globals.css` and `replay-controller.ts` together. Much of the behavior depends on both JS logic and CSS.

## Replay Data Rules

The replay system should:

- preload bars from selected replay point to current time
- cache those bars
- serve replay playback from cache
- if TradingView asks for older bars than current replay cache contains, fetch backfill from server and prepend it
- not loop infinitely in `getBars()`

There was a real `Maximum call stack size exceeded` issue in replay mode before the replay `getBars()` contract was fixed. Be careful not to reintroduce a datafeed loop by returning the full replay dataset regardless of `from/to`.

## Save / Load

TradingView save/load is expected to use Firebase, not local-only persistence.

Relevant files:

- [C:\Users\Admin\Desktop\newchart\lib\firebase\client.ts](C:\Users\Admin\Desktop\newchart\lib\firebase\client.ts)
- [C:\Users\Admin\Desktop\newchart\lib\storage\chart-layout-store.ts](C:\Users\Admin\Desktop\newchart\lib\storage\chart-layout-store.ts)
- [C:\Users\Admin\Desktop\newchart\lib\storage\tv-save-load-adapter.ts](C:\Users\Admin\Desktop\newchart\lib\storage\tv-save-load-adapter.ts)

Expected persisted objects include:

- chart layouts
- study templates
- drawing templates

Do not silently move save/load back to local storage unless the user explicitly asks for it.

## Firebase Environment

Environment files:

- [C:\Users\Admin\Desktop\newchart\.env](C:\Users\Admin\Desktop\newchart\.env)
- [C:\Users\Admin\Desktop\newchart\.env.example](C:\Users\Admin\Desktop\newchart\.env.example)

The app currently expects `NEXT_PUBLIC_FIREBASE_*` variables for the client SDK and Firestore access.

If save/load breaks, check:

- Firebase config variables
- Firestore rules
- workspace id / collection namespace assumptions in the layout store

## OANDA Environment

The app currently also expects OANDA environment variables such as:

- `NEXT_PUBLIC_OANDA_ACCOUNT_ID`
- `NEXT_PUBLIC_OANDA_TOKEN`
- `NEXT_PUBLIC_OANDA_REST_URL`
- `NEXT_PUBLIC_OANDA_STREAM_URL`

The existing `.env` was populated from the legacy datasource setup. If OANDA stops working, inspect the env values before changing code.

## Browser Title Behavior

The HTML title now updates dynamically from:

- active symbol
- last price
- direction arrow

Implementation is in:

- [C:\Users\Admin\Desktop\newchart\components\chart\tradingview-host.tsx](C:\Users\Admin\Desktop\newchart\components\chart\tradingview-host.tsx)
- [C:\Users\Admin\Desktop\newchart\lib\datasources\tradingview-datafeed.ts](C:\Users\Admin\Desktop\newchart\lib\datasources\tradingview-datafeed.ts)

Behavior:

- when symbol changes, title resets to symbol
- when price updates arrive, title becomes something like:
  - `BTCUSDT 104,250.3 ▲`
  - `XAU_USD 3,281.15 ▼`

Do not implement title updates by scraping DOM from the TradingView iframe. Keep it data-driven through the datafeed.

## TradingView Host Conventions

In [C:\Users\Admin\Desktop\newchart\components\chart\tradingview-host.tsx](C:\Users\Admin\Desktop\newchart\components\chart\tradingview-host.tsx):

- widget is client-only
- library is loaded from local scripts
- custom studies are loaded from `public/tv-custom-studies`
- widget timezone should stay `Asia/Ho_Chi_Minh`
- replay controller is attached after chart ready

If you change widget features, preserve the TradingView-native UI as much as possible.

## Build / Verification Workflow

Standard commands:

```powershell
npm run dev
npm run build
```

If build artifacts become stale, this cleanup has been safe and useful:

```powershell
if (Test-Path '.next') { Remove-Item -Recurse -Force '.next' }
npm run build
```

Use Playwright or browser smoke tests for:

- symbol search
- datasource routing
- replay start/stop
- replay backfill behavior
- Firebase save/load flows
- title update behavior

## Files Most Likely To Be Touched Next

- [C:\Users\Admin\Desktop\newchart\components\chart\tradingview-host.tsx](C:\Users\Admin\Desktop\newchart\components\chart\tradingview-host.tsx)
- [C:\Users\Admin\Desktop\newchart\lib\replay\replay-controller.ts](C:\Users\Admin\Desktop\newchart\lib\replay\replay-controller.ts)
- [C:\Users\Admin\Desktop\newchart\lib\datasources\tradingview-datafeed.ts](C:\Users\Admin\Desktop\newchart\lib\datasources\tradingview-datafeed.ts)
- [C:\Users\Admin\Desktop\newchart\lib\datasources\registry.ts](C:\Users\Admin\Desktop\newchart\lib\datasources\registry.ts)
- [C:\Users\Admin\Desktop\newchart\lib\datasources\binance-adapter.ts](C:\Users\Admin\Desktop\newchart\lib\datasources\binance-adapter.ts)
- [C:\Users\Admin\Desktop\newchart\lib\datasources\oanda-adapter.ts](C:\Users\Admin\Desktop\newchart\lib\datasources\oanda-adapter.ts)
- [C:\Users\Admin\Desktop\newchart\lib\storage\chart-layout-store.ts](C:\Users\Admin\Desktop\newchart\lib\storage\chart-layout-store.ts)
- [C:\Users\Admin\Desktop\newchart\app\globals.css](C:\Users\Admin\Desktop\newchart\app\globals.css)

## Known Pitfalls

- Do not default unknown symbols directly to Binance Spot before registry resolution.
- Do not break OANDA gap handling.
- Do not return replay bars incorrectly for any `from/to` request range.
- Do not replace TradingView-native UI with large custom panels unless the user explicitly asks.
- Do not move save/load away from Firebase.
- Do not fetch symbol catalogs repeatedly on every search.

## Practical Rule For Future Agents

Before changing anything substantial, inspect these files first:

1. [C:\Users\Admin\Desktop\newchart\components\chart\tradingview-host.tsx](C:\Users\Admin\Desktop\newchart\components\chart\tradingview-host.tsx)
2. [C:\Users\Admin\Desktop\newchart\lib\datasources\tradingview-datafeed.ts](C:\Users\Admin\Desktop\newchart\lib\datasources\tradingview-datafeed.ts)
3. [C:\Users\Admin\Desktop\newchart\lib\datasources\registry.ts](C:\Users\Admin\Desktop\newchart\lib\datasources\registry.ts)
4. [C:\Users\Admin\Desktop\newchart\lib\replay\replay-controller.ts](C:\Users\Admin\Desktop\newchart\lib\replay\replay-controller.ts)
5. [C:\Users\Admin\Desktop\newchart\datafeeds\oanda-datasource.js](C:\Users\Admin\Desktop\newchart\datafeeds\oanda-datasource.js)

This project has already gone through many user-directed refinements. Continue from the current architecture instead of rethinking it from scratch.
