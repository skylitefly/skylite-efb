export const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://api.skylitefly.com';
export const WEATHER_API_BASE_URL = import.meta.env.VITE_WEATHER_API_URL || 'https://weather.api.skylitefly.com';
export const NAVIGATION_API_BASE_URL = import.meta.env.VITE_NAVIGATION_API_URL || 'https://navigation.api.skylitefly.com';
export const WHAZZUP_URL = import.meta.env.VITE_WHAZZUP_URL || 'https://fsddata.skylitefly.com/whazzup.json';
export const AUTH_FRONTEND_URL = import.meta.env.VITE_AUTH_FRONTEND_URL || 'https://skylitefly.com';
export const OAUTH_CLIENT_ID = import.meta.env.VITE_OAUTH_CLIENT_ID || '';
export const OAUTH_SCOPE = import.meta.env.VITE_OAUTH_SCOPE || 'profile';
export const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || '';

const navVectorSource = (chart) => ({
  type: 'vector',
  tiles: [`${NAVIGATION_API_BASE_URL}/api/charts/${chart}/{z}/{x}/{y}.pbf`],
  minzoom: 0,
  maxzoom: 14,
});

const osmRasterSource = {
  type: 'raster',
  tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
  tileSize: 256,
  attribution: 'OpenStreetMap',
};

const navStyle = ({chart, airwayColor, airportColor, navaidColor}) => ({
  version: 8,
  name: `Skylite ${chart}`,
  sources: {
    osm: osmRasterSource,
    'skylite-navdata': navVectorSource(chart),
  },
  layers: [
    {id: 'background', type: 'background', paint: {'background-color': '#ffffff'}},
    {id: 'osm', type: 'raster', source: 'osm', paint: {'raster-opacity': 0.42}},
    {
      id: 'runway',
      type: 'line',
      source: 'skylite-navdata',
      'source-layer': 'runway',
      minzoom: 8,
      paint: {
        'line-color': '#374151',
        'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1, 12, 4],
        'line-opacity': 0.8,
      },
    },
    {
      id: 'airway',
      type: 'line',
      source: 'skylite-navdata',
      'source-layer': 'airway',
      minzoom: chart === 'ifr-high' ? 3 : 4,
      paint: {
        'line-color': airwayColor,
        'line-width': ['interpolate', ['linear'], ['zoom'], 3, 0.4, 8, 1.2],
        'line-opacity': 0.85,
      },
    },
    {
      id: 'airport',
      type: 'circle',
      source: 'skylite-navdata',
      'source-layer': 'airport',
      minzoom: 2,
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 2.5, 8, 5],
        'circle-color': airportColor,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 1,
      },
    },
    {
      id: 'navaid',
      type: 'circle',
      source: 'skylite-navdata',
      'source-layer': 'navaid',
      minzoom: 5,
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 2, 8, 4],
        'circle-color': navaidColor,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 1,
      },
    },
    {
      id: 'waypoint',
      type: 'circle',
      source: 'skylite-navdata',
      'source-layer': 'waypoint',
      minzoom: 5,
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 1.6, 8, 3.5],
        'circle-color': '#111827',
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 1,
      },
    },
  ],
});

const streetsStyle = () => {
  if (MAPBOX_TOKEN) return 'mapbox://styles/mapbox/streets-v12';
  return {
    version: 8,
    name: 'World Map',
    sources: {osm: osmRasterSource},
    layers: [
      {id: 'background', type: 'background', paint: {'background-color': '#ffffff'}},
      {id: 'osm', type: 'raster', source: 'osm'},
    ],
  };
};

export const MAP_STYLES = [
  {id: 'ifr-high', label: 'IFR High', getStyle: () => navStyle({chart: 'ifr-high', airwayColor: '#0f65b8', airportColor: '#1769aa', navaidColor: '#202020'})},
  {id: 'ifr-low', label: 'IFR Low', getStyle: () => navStyle({chart: 'ifr-low', airwayColor: '#1677ff', airportColor: '#1769aa', navaidColor: '#202020'})},
  {id: 'vfr', label: 'VFR', getStyle: () => navStyle({chart: 'vfr', airwayColor: '#16885a', airportColor: '#00884f', navaidColor: '#116b43'})},
  {id: 'streets', label: MAPBOX_TOKEN ? 'Mapbox Streets' : 'World Map', getStyle: streetsStyle},
];
