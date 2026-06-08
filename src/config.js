export const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://api.skylitefly.com';
export const WEATHER_API_BASE_URL = import.meta.env.VITE_WEATHER_API_URL || 'https://weather.api.skylitefly.com';
export const NAVIGATION_API_BASE_URL = import.meta.env.VITE_NAVIGATION_API_URL || 'https://navigation.api.skylitefly.com';
export const WHAZZUP_URL = import.meta.env.VITE_WHAZZUP_URL || 'https://fsddata.skylitefly.com/whazzup.json';
export const AUTH_FRONTEND_URL = import.meta.env.VITE_AUTH_FRONTEND_URL || 'https://skylitefly.com';
export const OAUTH_CLIENT_ID = import.meta.env.VITE_OAUTH_CLIENT_ID || '';
export const OAUTH_SCOPE = import.meta.env.VITE_OAUTH_SCOPE || 'openid profile email';
export const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || '';

export const MAP_STYLES = [
  {id: 'ifr-high', label: 'IFR High', url: `${NAVIGATION_API_BASE_URL}/api/charts/style/ifr-high.json`},
  {id: 'ifr-low', label: 'IFR Low', url: `${NAVIGATION_API_BASE_URL}/api/charts/style/ifr-low.json`},
  {id: 'vfr', label: 'VFR', url: `${NAVIGATION_API_BASE_URL}/api/charts/style/vfr.json`},
  {id: 'streets', label: 'Mapbox Streets', url: 'mapbox://styles/mapbox/streets-v12'},
];
