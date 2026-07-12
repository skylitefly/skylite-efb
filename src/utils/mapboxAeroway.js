const AEROWAY_SOURCE_ID = 'aeroway-streets-v8';
const AEROWAY_SOURCE_LAYER = 'aeroway';
const AEROWAY_MIN_ZOOM = 9;

const AEROWAY_LAYER_IDS = {
  runwayFill: 'aeroway-runway-fill',
  runwayLine: 'aeroway-runway-line',
  taxiwayFill: 'aeroway-taxiway-fill',
  taxiwayLineBg: 'aeroway-taxiway-line-bg',
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

export const addAerowayLayers = (map) => {
  if (!map?.getStyle || !map?.addSource || !map?.addLayer) return;

  ensureAerowaySource(map);
  const beforeId = pickBeforeLayerId(map);
  const supportsText = Boolean(map.getStyle()?.glyphs);

  addLayerOnce(map, {
    id: AEROWAY_LAYER_IDS.runwayFill,
    type: 'fill',
    source: AEROWAY_SOURCE_ID,
    'source-layer': AEROWAY_SOURCE_LAYER,
    minzoom: AEROWAY_MIN_ZOOM,
    filter: ['all', ['==', ['geometry-type'], 'Polygon'], buildTypeFilter('runway')],
    paint: {'fill-color': '#e6e6e6', 'fill-opacity': 0.65},
  }, beforeId);

  addLayerOnce(map, {
    id: AEROWAY_LAYER_IDS.runwayLine,
    type: 'line',
    source: AEROWAY_SOURCE_ID,
    'source-layer': AEROWAY_SOURCE_LAYER,
    minzoom: AEROWAY_MIN_ZOOM,
    filter: ['all', ['==', ['geometry-type'], 'LineString'], buildTypeFilter('runway')],
    layout: {'line-join': 'round', 'line-cap': 'round'},
    paint: {
      'line-color': '#f2f2f2',
      'line-width': ['interpolate', ['linear'], ['zoom'], 9, 1.2, 16, 7],
    },
  }, beforeId);

  addLayerOnce(map, {
    id: AEROWAY_LAYER_IDS.taxiwayFill,
    type: 'fill',
    source: AEROWAY_SOURCE_ID,
    'source-layer': AEROWAY_SOURCE_LAYER,
    minzoom: AEROWAY_MIN_ZOOM,
    filter: ['all', ['==', ['geometry-type'], 'Polygon'], buildTypeFilter('taxiway')],
    paint: {'fill-color': '#d0d0d0', 'fill-opacity': 0.55},
  }, beforeId);

  addLayerOnce(map, {
    id: AEROWAY_LAYER_IDS.taxiwayLineBg,
    type: 'line',
    source: AEROWAY_SOURCE_ID,
    'source-layer': AEROWAY_SOURCE_LAYER,
    minzoom: AEROWAY_MIN_ZOOM,
    filter: ['all', ['==', ['geometry-type'], 'LineString'], buildTypeFilter('taxiway')],
    layout: {'line-join': 'round', 'line-cap': 'round'},
    paint: {
      'line-color': '#7a7a7a',
      'line-width': ['interpolate', ['linear'], ['zoom'], 9, 6, 16, 9],
      'line-opacity': 0.9,
    },
  }, beforeId);

  addLayerOnce(map, {
    id: AEROWAY_LAYER_IDS.taxiwayLineCenter,
    type: 'line',
    source: AEROWAY_SOURCE_ID,
    'source-layer': AEROWAY_SOURCE_LAYER,
    minzoom: AEROWAY_MIN_ZOOM,
    filter: ['all', ['==', ['geometry-type'], 'LineString'], buildTypeFilter('taxiway')],
    layout: {'line-join': 'round', 'line-cap': 'round'},
    paint: {
      'line-color': '#f4c430',
      'line-width': ['interpolate', ['linear'], ['zoom'], 9, 0.4, 16, 2],
      'line-opacity': 0.95,
    },
  }, beforeId);

  addLayerOnce(map, {
    id: AEROWAY_LAYER_IDS.apronFill,
    type: 'fill',
    source: AEROWAY_SOURCE_ID,
    'source-layer': AEROWAY_SOURCE_LAYER,
    minzoom: AEROWAY_MIN_ZOOM,
    filter: ['all', ['==', ['geometry-type'], 'Polygon'], buildTypeFilter('apron')],
    paint: {'fill-color': '#c7c7c7', 'fill-opacity': 0.5},
  }, beforeId);

  addLayerOnce(map, {
    id: AEROWAY_LAYER_IDS.helipadFill,
    type: 'fill',
    source: AEROWAY_SOURCE_ID,
    'source-layer': AEROWAY_SOURCE_LAYER,
    minzoom: AEROWAY_MIN_ZOOM,
    filter: ['all', ['==', ['geometry-type'], 'Polygon'], buildTypeFilter('helipad')],
    paint: {'fill-color': '#bdbdbd', 'fill-opacity': 0.6},
  }, beforeId);

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
};

export default addAerowayLayers;
