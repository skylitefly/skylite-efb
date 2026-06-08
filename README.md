# Skylite EFB

Skylite EFB is a React + Vite electronic flight bag for PC and tablet use. It uses existing Skylite services for authentication, user preferences, weather, charts, navigation data, route planning, and network traffic.

## Required Environment

Create production environment variables before building:

```bash
VITE_OAUTH_CLIENT_ID=<public OAuth client id>
VITE_API_URL=https://api.skylitefly.com
VITE_WEATHER_API_URL=https://weather.api.skylitefly.com
VITE_NAVIGATION_API_URL=https://navigation.api.skylitefly.com
VITE_AUTH_FRONTEND_URL=https://skylitefly.com
VITE_WHAZZUP_URL=https://fsddata.skylitefly.com/whazzup.json
VITE_MAPBOX_TOKEN=<mapbox token>
```

The OAuth client must allow the deployed EFB origin as a redirect URI.

## Commands

```bash
npm install
npm run lint
npm run build
```

The build emits a Vite PWA into `dist/`.
