# AGENTS.md — skylite-efb

**Electronic Flight Bag PWA** for Skylite (route planning, airport reference,
charts, weather, network traffic, moving-map). React 19 + Vite 8 + Ant Design 6
+ mapbox-gl. **Pure JSX, no TypeScript, no router, no state library, no test
runner.** Thin frontend consuming existing Skylite backend services.

```bash
npm install
npm run build          # PWA build (prefer over dev server)
npm run lint           # eslint . — the only quality gate; no test script
```

## Architecture invariants (do not break)

1. **No router, no global state lib.** Single-`App.jsx`-owns-everything model.
   New cross-panel state must be lifted into `App.jsx` and threaded via props.
2. **Panels are CSS-toggled, not unmounted.** All four panels stay mounted
   inside `<SidePanel>` and are shown/hidden via `panel-pane.is-active`
   (`display:none/block`), not conditional rendering — switching to
   conditional render wipes internal panel state (procedure chooser, chart
   selections, form values) and unmounts `EfbMap`. `EfbMap` must stay mounted
   across panel switches.
3. **No global auth header.** Each authenticated call must fetch a fresh access
   token via `getValidAccessToken()` and pass `Authorization: Bearer ...`.
4. **OAuth refresh dedup.** `refreshPromise` is a module singleton; never call
   `oauthApi.token(refresh)` directly — always go through `getValidAccessToken()`.
5. **Flight plan lives in `sessionStorage`** (`skylite-efb.flight-plan`);
   tokens in `localStorage`. Don't confuse them. `sessionStorage` was chosen so
   plans don't survive a fresh tab.
6. **Mapbox requires `whenStyleReady`.** Any new layer/source must subscribe to
   `style.load` + `idle` and be idempotent (`getSource`/`getLayer` guards).
   Style swaps wipe layers.
7. **Antimeridian correctness.** Never feed raw route coordinates to a line
   layer — always go through `buildRouteLineGeoJson` /
   `getUnwrappedRouteCoordinates` (`utils/mapRouteUtils.js`).
8. **Native image drag stays disabled** on the chart overlay
   (`draggable={false}`, `onDragStart` preventDefault, `-webkit-user-drag:none`).
9. **Numbers from API are defensively coerced** with `Number(...)` +
   `Number.isFinite` before rendering or mapbox use.
10. **antd locale is `zhCN` but copy is English.** Don't "fix" this — the
    locale only affects built-in antd strings. New UI text stays English.

## File structure (`src/`)

`main.jsx` (mount, `ConfigProvider locale={zhCN}` + `dayjs/locale/zh-cn`) ·
`App.jsx` (root: owns global state, auth/boot flow, panel routing) · `App.css`
(single stylesheet, BEM-ish kebab classes, no CSS modules/Tailwind) ·
`index.css` (`@font-face` JetBrains Mono + reset) · `config.js` (env →
constants + `MAP_STYLES`) · `auth.js` (OAuth PKCE, token storage/refresh) ·
`api.js` (all HTTP) · `components/` (`EfbMap`, `SidePanel`, `GlobalSearch`,
`AirportSearchModal`) · `panels/` (`FlightPlanPanel`, `RoutePanel`,
`AirportPanel`, `SettingsPanel`) · `utils/` (`mapRouteUtils`, `mapboxAeroway`).

## API client (`api.js`)

Shared `jsonRequest(baseUrl, path, options)`: `Accept: application/json`,
`Content-Type` only when `body`; errors thrown as `Error` pulling
`error_description`/`error`/`detail`/`HTTP <status>` in that order (matches
backend OAuth + DRF shapes). Exported as object namespaces of one-liners:

- `navApi` → `VITE_NAVIGATION_API_URL`: `searchAirports`, `getAirport`,
  `getAirportProcedures`, `planRoute` (GET + URLSearchParams), `parseRoute`.
- `weatherApi` → `VITE_WEATHER_API_URL`: `getAirportWeather(icao)` →
  `/api/icao/<icao>/`.
- `chartsApi` → `VITE_API_URL`: `getCharts(icao, provider='jeppesen')` →
  `/api/charts/<icao>/?version=STD&rules=IFR&provider=jeppesen`.
- `oauthApi` → `VITE_API_URL`: `token`, `userInfo`, `preferences`,
  `patchPreferences` (Bearer).
- `fetchWhazzup()` → `VITE_WHAZZUP_URL` with cache-busting `_=Date.now()`.
- `fetchSimBrief(username)` → external simbrief JSON.

**Add new endpoints by extending these objects — never ad-hoc `fetch` in
components.**

## Ant Design conventions

- `Layout`/`Header`/`Sider`(64px icon rail, never collapses)/`Content`.
- `Menu mode="inline"` via `items` API (data-driven from `panelMeta`).
- `Table`: `size="small"`, `pagination={false}`, `scroll={{x: 'max-content'}}`,
  `rowKey="id"`.
- `Tabs`/`Collapse`/`List`/`Dropdown` always use the `items`/`dataSource` API,
  never legacy children.
- `Form.useForm()` + `layout="vertical"` + `initialValues` + `onFinish`.
- Feedback: `message.loading(text, 0)` returns `hide` (call in `finally`);
  `message.success`/`message.error(error.message || '<fallback>')`. Empty
  states `<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="...">`.
- Mobile support is minimal (one `@media (max-width: 1100px)` breakpoint);
  targets desktop/tablet-landscape. No antd `Grid`/`useBreakpoint`.

## mapbox-gl (`components/EfbMap.jsx`, `utils/`)

Map created **once** in a mount effect guarded by refs; center `[105, 35]`,
zoom 3.5, `renderWorldCopies: true`. Style switching uses `appliedStyleRef` +
`whenStyleReady`. Idempotent layer adders (`addLineLayer`, `addPointLayers`,
`addLayerOnce`). Route in 4 section colors (departure `#ff6b6b`, cruise
`#1677ff`, arrival `#16a34a`, procedure-preview `#a855f7`). Traffic/ownship as
`circle` layers; click handler uses a `trafficSelectRef` (kept fresh via its
own effect) to avoid stale closures. Georeferenced chart = `raster` layer over
`image` source, opacity via `setPaintProperty`. Fit-bounds is
signature-guarded (`routeFitSignatureRef`) and suppressed during procedure
preview. Chart viewer (`ChartOverlay`) has custom pan + wheel zoom + inertia.

## Code style

- `.js` for logic, `.jsx` for components. No PropTypes/JSDoc.
- `function Foo(){}` components, `export default function`. Small presentational
  helpers co-located in the panel file.
- Imports: `react` hooks → antd → `@ant-design/icons` → relative. `const
  {Text, Title} = Typography;` destructure at top.
- `useEffect` always returns a cleanup (`return undefined;` early-returns);
  `cancelled`/`stopped` flags + `AbortController` for fetches; debounce via
  `window.setTimeout(..., 180)`.
- `camelCase` vars/fns, `PascalCase` components, `UPPER_SNAKE` constants, BEM
  kebab CSS. Inline `style={{...}}` acceptable for one-off layout.
- Async actions: try/catch/finally with `message.loading` hide in finally,
  `message.error(error.message || '<fallback>')`. Never let promises throw
  uncaught in handlers.
- ESLint flat config (`eslint.config.js`): `@eslint/js` recommended +
  `react-hooks` + `react-refresh` (vite), globals = browser. No Prettier.

## Copywriting / 文案 — **English UI**

All user-facing copy is **English** despite the `zhCN` antd locale. Buttons:
`Login`, `Import`, `Auto-Route`, `Refresh`, `Save`, `Log out`. Placeholders:
`"Search airport"`, `"ICAO or airport name"`, `"Enter route as text"`. Tabs:
`Info`, `Comms`, `Runways`, `Weather`, `Charts`. Empty states: `"No flight plan
loaded"`, `"No charts available"`. Toasts: `"SimBrief flight plan imported"`,
`"Preferences saved"`, `"Your CID is not online in whazzup.json"`.

**Style:** concise, sentence-case English; no trailing periods on
labels/buttons; Title Case for tab/section headers; sentence case for
toasts/empty states. Aviation terminology correct (METAR/TAF, ICAO, SID/STAR
via "Departure"/"Arrival"). ICAO inputs uppercased client-side. Numbers with
units: `"${value} ft"`, `"FL ${transition_level}"`, frequency `toFixed(3)`.

## Env vars (`src/config.js`, all `VITE_*`)

`VITE_API_URL` (`https://api.skylitefly.com`), `VITE_WEATHER_API_URL`,
`VITE_NAVIGATION_API_URL`, `VITE_WHAZZUP_URL`, `VITE_AUTH_FRONTEND_URL`
(`https://skylitefly.com`), `VITE_OAUTH_CLIENT_ID` ('' — `startLogin` throws if
missing), `VITE_OAUTH_SCOPE` (`'profile'`), `VITE_MAPBOX_TOKEN` ('').

## Build (Vite + PWA, `vite.config.js`)

`@vitejs/plugin-react` + `VitePWA` (`registerType: 'autoUpdate'`,
`maximumFileSizeToCacheInCacheInBytes: 4MB`). Manifest: name/short_name
`"Skylite EFB"`, `display: standalone`, icons `/pwa-192.png` + `/pwa-512.png`.
No path aliases, no proxy. Fonts self-hosted in `public/fonts/` (JetBrains
Mono). `index.html` `lang="en"`.
