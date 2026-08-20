const AEROWAY_SOURCE_ID = 'aeroway-streets-v8';
const AEROWAY_SOURCE_LAYER = 'aeroway';
const AEROWAY_MIN_ZOOM = 9;

// Line widths use multi-stop interpolation instead of a fixed screen size:
//   - thin (near-invisible) at country/city zoom so the lines never read as an
//     "absolute" overlay that gets too thick when the map is zoomed out;
//   - growing fast through airport zoom (z13+) so the dark surface clearly
//     covers the basemap's light airport landuse fill and reads as a real strip;
//   - tapering at very high zoom to avoid absurd thickness at street level.
// All values are screen pixels, tuned for legibility against streets/dark/satellite basemaps.
const RUNWAY_WIDTH = ['interpolate', ['linear'], ['zoom'],
  9, 0.8,
  11, 2,
  12, 4.8,
  13, 12,
  14, 24,
  15, 40,
  16, 60,
  18, 88,
];
const TAXIWAY_WIDTH = ['interpolate', ['linear'], ['zoom'],
  9, 0.15,
  11, 0.4,
  12, 0.9,
  13, 1.8,
  14, 3.5,
  15, 6,
  16, 9,
  18, 13,
];
const RUNWAY_CENTERLINE_WIDTH = ['interpolate', ['linear'], ['zoom'],
  13, 0.8,
  14, 1.4,
  15, 2.2,
  16, 3.5,
  18, 5,
];

const AEROWAY_LAYER_IDS = {
  runwayFill: 'aeroway-runway-fill',
  runwayCasing: 'aeroway-runway-casing',
  runwayLine: 'aeroway-runway-line',
  runwayCenterline: 'aeroway-runway-centerline',
  taxiwayFill: 'aeroway-taxiway-fill',
  taxiwayLineBg: 'aeroway-taxiway-line-bg',
  taxiwayLine: 'aeroway-taxiway-line',
  taxiwayLineCenter: 'aeroway-taxiway-line-center',
  apronFill: 'aeroway-apron-fill',
  helipadFill: 'aeroway-helipad-fill',
  labelLine: 'aeroway-label-line',
  labelArea: 'aeroway-label-area',
};

const AEROWAY_LAYER_ID_LIST = Object.values(AEROWAY_LAYER_IDS);

const pickBeforeLayerId = (map) => {
  const layers = map.getStyle()?.layers || [];
  return layers.find((layer) => layer.type === 'symbol')?.id;
};

const buildTypeFilter = (value) => ['==', ['get', 'type'], value];

const ensureAerowaySource = (map) => {
  if (map.getSource(AEROWAY_SOURCE_ID)) return;
  map.addSource(AEROWAY_SOURCE_ID, {
    type: 'vector',
    url: 'mapbox://mapbox.mapbox-streets-v8',
  });
};

const addLayerOnce = (map, layer, beforeId) => {
  if (map.getLayer(layer.id)) return;
  if (beforeId) map.addLayer(layer, beforeId);
  else map.addLayer(layer);
};

// The Mapbox streets / satellite styles already render the `aeroway`
// source-layer themselves (thin grey runway lines, light taxiway/apron fills).
// When our detailed aeroway layers are shown we hide those native basemap
// layers so only our styling is visible; when turned off we restore them so
// the airport outline remains at its original basemap fidelity. A layer is
// considered "native" when it reads the aeroway source-layer but was not
// created by us (i.e. not one of our own layer ids / our own source).
const ourLayerIdSet = new Set(AEROWAY_LAYER_ID_LIST);

const setBasemapAerowayVisible = (map, visible) => {
  if (!map?.getStyle || !map?.setLayoutProperty) return;
  const layers = map.getStyle()?.layers || [];
  const visibility = visible ? 'visible' : 'none';
  layers.forEach((layer) => {
    if (ourLayerIdSet.has(layer.id)) return;          // skip our own layers
    if (layer.source === AEROWAY_SOURCE_ID) return;   // skip our own source
    if (layer['source-layer'] !== AEROWAY_SOURCE_LAYER) return; // only aeroway
    if (map.getLayer(layer.id)) map.setLayoutProperty(layer.id, 'visibility', visibility);
  });
};

export const addAerowayLayers = (map) => {
  if (!map?.getStyle || !map?.addSource || !map?.addLayer) return;

  ensureAerowaySource(map);
  const beforeId = pickBeforeLayerId(map);
  const supportsText = Boolean(map.getStyle()?.glyphs);

  // --- Polygon surfaces (fills) ---

  addLayerOnce(map, {
    id: AEROWAY_LAYER_IDS.runwayFill,
    type: 'fill',
    source: AEROWAY_SOURCE_ID,
    'source-layer': AEROWAY_SOURCE_LAYER,
    minzoom: AEROWAY_MIN_ZOOM,
    filter: ['all', ['==', ['geometry-type'], 'Polygon'], buildTypeFilter('runway')],
    paint: {
      'fill-color': '#3a3a3a',
      'fill-opacity': 0.85,
      'fill-outline-color': '#1f1f1f',
    },
  }, beforeId);

  addLayerOnce(map, {
    id: AEROWAY_LAYER_IDS.taxiwayFill,
    type: 'fill',
    source: AEROWAY_SOURCE_ID,
    'source-layer': AEROWAY_SOURCE_LAYER,
    minzoom: AEROWAY_MIN_ZOOM,
    filter: ['all', ['==', ['geometry-type'], 'Polygon'], buildTypeFilter('taxiway')],
    paint: {
      'fill-color': '#9a9a9a',
      'fill-opacity': 0.85,
      'fill-outline-color': '#6a6a6a',
    },
  }, beforeId);

  addLayerOnce(map, {
    id: AEROWAY_LAYER_IDS.apronFill,
    type: 'fill',
    source: AEROWAY_SOURCE_ID,
    'source-layer': AEROWAY_SOURCE_LAYER,
    minzoom: AEROWAY_MIN_ZOOM,
    filter: ['all', ['==', ['geometry-type'], 'Polygon'], buildTypeFilter('apron')],
    paint: {
      'fill-color': '#cfcfcf',
      'fill-opacity': 0.55,
      'fill-outline-color': '#9a9a9a',
    },
  }, beforeId);

  addLayerOnce(map, {
    id: AEROWAY_LAYER_IDS.helipadFill,
    type: 'fill',
    source: AEROWAY_SOURCE_ID,
    'source-layer': AEROWAY_SOURCE_LAYER,
    minzoom: AEROWAY_MIN_ZOOM,
    filter: ['all', ['==', ['geometry-type'], 'Polygon'], buildTypeFilter('helipad')],
    paint: {
      'fill-color': '#c4c4c4',
      'fill-opacity': 0.65,
      'fill-outline-color': '#8a8a8a',
    },
  }, beforeId);

  // --- Taxiway LineStrings: casing + surface + yellow centerline ---
  // (added before the runway group so runways render on top at crossings)

  addLayerOnce(map, {
    id: AEROWAY_LAYER_IDS.taxiwayLineBg,
    type: 'line',
    source: AEROWAY_SOURCE_ID,
    'source-layer': AEROWAY_SOURCE_LAYER,
    minzoom: AEROWAY_MIN_ZOOM,
    filter: ['all', ['==', ['geometry-type'], 'LineString'], buildTypeFilter('taxiway')],
    layout: {'line-join': 'round', 'line-cap': 'butt'},
    paint: {
      'line-color': '#6a6a6a',
      'line-width': ['+', TAXIWAY_WIDTH, 1.5],
      'line-opacity': 0.9,
    },
  }, beforeId);

  addLayerOnce(map, {
    id: AEROWAY_LAYER_IDS.taxiwayLine,
    type: 'line',
    source: AEROWAY_SOURCE_ID,
    'source-layer': AEROWAY_SOURCE_LAYER,
    minzoom: AEROWAY_MIN_ZOOM,
    filter: ['all', ['==', ['geometry-type'], 'LineString'], buildTypeFilter('taxiway')],
    layout: {'line-join': 'round', 'line-cap': 'butt'},
    paint: {
      'line-color': '#9a9a9a',
      'line-width': TAXIWAY_WIDTH,
    },
  }, beforeId);

  addLayerOnce(map, {
    id: AEROWAY_LAYER_IDS.taxiwayLineCenter,
    type: 'line',
    source: AEROWAY_SOURCE_ID,
    'source-layer': AEROWAY_SOURCE_LAYER,
    minzoom: AEROWAY_MIN_ZOOM,
    filter: ['all', ['==', ['geometry-type'], 'LineString'], buildTypeFilter('taxiway')],
    layout: {'line-join': 'round', 'line-cap': 'butt'},
    paint: {
      'line-color': '#f4c430',
      'line-width': ['interpolate', ['linear'], ['zoom'], 9, 0.4, 16, 2],
      'line-opacity': 0.95,
    },
  }, beforeId);

  // --- Runway LineStrings: casing + surface + dashed centerline ---
  // (above the taxiway group so the runway covers the taxiway centerline at intersections)

  addLayerOnce(map, {
    id: AEROWAY_LAYER_IDS.runwayCasing,
    type: 'line',
    source: AEROWAY_SOURCE_ID,
    'source-layer': AEROWAY_SOURCE_LAYER,
    minzoom: AEROWAY_MIN_ZOOM,
    filter: ['all', ['==', ['geometry-type'], 'LineString'], buildTypeFilter('runway')],
    layout: {'line-join': 'round', 'line-cap': 'butt'},
    paint: {
      'line-color': '#1f1f1f',
      'line-width': ['+', RUNWAY_WIDTH, 2],
    },
  }, beforeId);

  addLayerOnce(map, {
    id: AEROWAY_LAYER_IDS.runwayLine,
    type: 'line',
    source: AEROWAY_SOURCE_ID,
    'source-layer': AEROWAY_SOURCE_LAYER,
    minzoom: AEROWAY_MIN_ZOOM,
    filter: ['all', ['==', ['geometry-type'], 'LineString'], buildTypeFilter('runway')],
    layout: {'line-join': 'round', 'line-cap': 'butt'},
    paint: {
      'line-color': '#3a3a3a',
      'line-width': RUNWAY_WIDTH,
    },
  }, beforeId);

  addLayerOnce(map, {
    id: AEROWAY_LAYER_IDS.runwayCenterline,
    type: 'line',
    source: AEROWAY_SOURCE_ID,
    'source-layer': AEROWAY_SOURCE_LAYER,
    minzoom: 13,
    filter: ['all', ['==', ['geometry-type'], 'LineString'], buildTypeFilter('runway')],
    layout: {'line-join': 'round', 'line-cap': 'butt'},
    paint: {
      'line-color': '#f0f0f0',
      'line-width': RUNWAY_CENTERLINE_WIDTH,
      'line-dasharray': [6, 5],
    },
  }, beforeId);

  // --- Labels (only when the base style exposes glyphs) ---

  if (supportsText) {
    addLayerOnce(map, {
      id: AEROWAY_LAYER_IDS.labelLine,
      type: 'symbol',
      source: AEROWAY_SOURCE_ID,
      'source-layer': AEROWAY_SOURCE_LAYER,
      minzoom: AEROWAY_MIN_ZOOM,
      filter: [
        'all',
        ['==', ['geometry-type'], 'LineString'],
        ['in', ['get', 'type'], ['literal', ['runway', 'taxiway']]],
        ['any', ['has', 'ref'], ['has', 'name']],
      ],
      layout: {
        'symbol-placement': 'line',
        'text-field': ['coalesce', ['get', 'ref'], ['get', 'name']],
        'text-size': ['interpolate', ['linear'], ['zoom'], 9, 11, 16, 14],
        'text-rotation-alignment': 'map',
        'text-keep-upright': true,
      },
      paint: {'text-color': '#2a2a2a', 'text-halo-color': '#f5f5f5', 'text-halo-width': 1.2},
    });

    addLayerOnce(map, {
      id: AEROWAY_LAYER_IDS.labelArea,
      type: 'symbol',
      source: AEROWAY_SOURCE_ID,
      'source-layer': AEROWAY_SOURCE_LAYER,
      minzoom: AEROWAY_MIN_ZOOM,
      filter: [
        'all',
        ['==', ['geometry-type'], 'Polygon'],
        ['in', ['get', 'type'], ['literal', ['apron', 'helipad']]],
        ['any', ['has', 'ref'], ['has', 'name']],
      ],
      layout: {
        'symbol-placement': 'point',
        'text-field': ['coalesce', ['get', 'ref'], ['get', 'name']],
        'text-size': ['interpolate', ['linear'], ['zoom'], 10, 10, 16, 13],
      },
      paint: {'text-color': '#2a2a2a', 'text-halo-color': '#f5f5f5', 'text-halo-width': 1.1},
    });
  }
};

export const setAerowayLayerVisibility = (map, isVisible) => {
  if (!map?.getLayer || !map?.setLayoutProperty) return;
  const visibility = isVisible ? 'visible' : 'none';
  AEROWAY_LAYER_ID_LIST.forEach((layerId) => {
    if (map.getLayer(layerId)) map.setLayoutProperty(layerId, 'visibility', visibility);
  });
  // When our detailed layers are visible, suppress the basemap's own aeroway
  // rendering (otherwise they double up); restore it when we are hidden so
  // the airport still shows at the basemap's native fidelity.
  setBasemapAerowayVisible(map, !isVisible);
};

export default addAerowayLayers;
