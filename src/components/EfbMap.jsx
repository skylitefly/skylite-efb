import {useEffect, useMemo, useRef, useState} from 'react';
import {Button, Popover, Segmented, Space, Tooltip, Typography} from 'antd';
import {
  AimOutlined,
  CloseOutlined,
  EnvironmentOutlined,
  GlobalOutlined,
  MinusOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import {MAP_STYLES, MAPBOX_TOKEN} from '../config';
import {buildRouteLineGeoJson, getUnwrappedRouteCoordinates} from '../utils/mapRouteUtils';

mapboxgl.accessToken = MAPBOX_TOKEN;

const {Text} = Typography;

const emptyCollection = {type: 'FeatureCollection', features: []};

const pointsToLine = (points) => buildRouteLineGeoJson(points);

const pointsToFeatures = (points, section) => ({
  type: 'FeatureCollection',
  features: (points || [])
    .filter((point) => Number.isFinite(Number(point.longitude)) && Number.isFinite(Number(point.latitude)))
    .map((point, index) => ({
      type: 'Feature',
      geometry: {type: 'Point', coordinates: [Number(point.longitude), Number(point.latitude)]},
      properties: {
        id: `${section}-${point.ident || point.icao || 'POINT'}-${index}`,
        ident: point.ident || point.icao || point.name || '',
        type: point.type || section,
        section,
      },
    })),
});

const addLineLayer = (map, id, color) => {
  if (!map.getSource(id)) {
    map.addSource(id, {type: 'geojson', data: emptyCollection});
  }
  if (!map.getLayer(id)) {
    map.addLayer({
      id,
      type: 'line',
      source: id,
      layout: {'line-cap': 'round', 'line-join': 'round'},
      paint: {'line-color': color, 'line-width': 3, 'line-opacity': 0.9},
    });
  }
};

const addPointLayers = (map, id, color) => {
  const sourceId = `${id}-points`;
  const pointLayerId = `${id}-point-layer`;
  const labelLayerId = `${id}-label-layer`;
  if (!map.getSource(sourceId)) {
    map.addSource(sourceId, {type: 'geojson', data: emptyCollection});
  }
  if (!map.getLayer(pointLayerId)) {
    map.addLayer({
      id: pointLayerId,
      type: 'circle',
      source: sourceId,
      paint: {
        'circle-radius': ['match', ['get', 'type'], 'airport', 7, 4],
        'circle-color': color,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 1.4,
      },
    });
  }
  if (!map.getLayer(labelLayerId)) {
    map.addLayer({
      id: labelLayerId,
      type: 'symbol',
      source: sourceId,
      layout: {
        'text-field': ['get', 'ident'],
        'text-size': 11,
        'text-offset': [0, 1.15],
        'text-anchor': 'top',
        'text-allow-overlap': false,
      },
      paint: {
        'text-color': '#ffffff',
        'text-halo-color': '#111827',
        'text-halo-width': 1,
      },
    });
  }
};

const fitRouteBounds = (map, route) => {
  const coordinates = getUnwrappedRouteCoordinates([
    ...(route?.departure || []),
    ...(route?.cruise || []),
    ...(route?.arrival || []),
  ]);
  if (coordinates.length < 2) return;
  const bounds = coordinates.reduce(
    (current, coordinate) => current.extend(coordinate),
    new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]),
  );
  map.fitBounds(bounds, {padding: 72, duration: 700, maxZoom: 8});
};

const whenStyleReady = (map, update) => {
  const run = () => {
    if (map.isStyleLoaded()) update();
  };
  map.on('style.load', update);
  map.on('idle', run);
  run();
  return () => {
    map.off('style.load', update);
    map.off('idle', run);
  };
};

const chartCoordinates = (chart) => {
  const box = Array.isArray(chart?.bounding_boxes) ? chart.bounding_boxes[0] : chart?.bounding_boxes;
  if (!box) return null;
  const planview = box.planview;
  if (planview?.pixels && planview?.latlng && chart?.width && chart?.height) {
    const {x1, y1, x2, y2} = planview.pixels;
    const {lng1, lat1, lng2, lat2} = planview.latlng;
    if ([x1, y1, x2, y2, lng1, lat1, lng2, lat2, chart.width, chart.height].every(Number.isFinite)) {
      const lngPerPixel = (lng2 - lng1) / (x2 - x1);
      const latPerPixel = (lat2 - lat1) / (y1 - y2);
      const west = lng1 - x1 * lngPerPixel;
      const east = lng1 + (chart.width - x1) * lngPerPixel;
      const north = lat2 + y2 * latPerPixel;
      const south = lat2 - (chart.height - y2) * latPerPixel;
      return [[west, north], [east, north], [east, south], [west, south]];
    }
  }
  const west = box.west ?? box.min_lon ?? box.minLon ?? box.left;
  const east = box.east ?? box.max_lon ?? box.maxLon ?? box.right;
  const north = box.north ?? box.max_lat ?? box.maxLat ?? box.top;
  const south = box.south ?? box.min_lat ?? box.minLat ?? box.bottom;
  if ([west, east, north, south].every(Number.isFinite)) {
    return [[west, north], [east, north], [east, south], [west, south]];
  }
  if (Array.isArray(box) && box.length >= 4) return box.slice(0, 4);
  return null;
};

function ChartOverlay({chart, onClose}) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({x: 0, y: 0});
  const dragRef = useRef(null);

  return (
    <div className="chart-overlay">
      <Space className="chart-overlay__tools">
        <Button icon={<PlusOutlined/>} onClick={() => setScale((value) => Math.min(value + 0.2, 5))}/>
        <Button icon={<MinusOutlined/>} onClick={() => setScale((value) => Math.max(value - 0.2, 0.4))}/>
        <Button icon={<AimOutlined/>} onClick={() => { setScale(1); setOffset({x: 0, y: 0}); }}/>
        <Button icon={<CloseOutlined/>} onClick={onClose}/>
      </Space>
      <div
        className="chart-overlay__stage"
        onWheel={(event) => {
          event.preventDefault();
          const delta = event.deltaY < 0 ? 0.12 : -0.12;
          setScale((value) => Math.min(5, Math.max(0.4, value + delta)));
        }}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          dragRef.current = {x: event.clientX, y: event.clientY, offset};
        }}
        onPointerMove={(event) => {
          if (!dragRef.current) return;
          setOffset({
            x: dragRef.current.offset.x + event.clientX - dragRef.current.x,
            y: dragRef.current.offset.y + event.clientY - dragRef.current.y,
          });
        }}
        onPointerUp={() => { dragRef.current = null; }}
      >
        <img
          src={chart.image_day_url || chart.image_day}
          alt={chart.name}
          draggable={false}
          onDragStart={(event) => event.preventDefault()}
          style={{transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`}}
        />
      </div>
    </div>
  );
}

export default function EfbMap({
  route,
  procedurePreview,
  selectedChart,
  georefChart,
  whazzup,
  networkTraffic,
  movingMap,
  user,
  onTrafficSelect,
  onCloseChart,
  onNetworkTrafficChange,
  onMovingMapChange,
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const trafficSelectRef = useRef(onTrafficSelect);
  const routeFitSignatureRef = useRef('');
  const appliedStyleRef = useRef(MAP_STYLES[0].url);
  const [styleId, setStyleId] = useState('ifr-high');
  const [mapLoaded, setMapLoaded] = useState(false);

  const style = useMemo(() => MAP_STYLES.find((item) => item.id === styleId) || MAP_STYLES[0], [styleId]);
  const ownCid = String(user?.preferred_username || user?.username || user?.sub || '');

  useEffect(() => {
    trafficSelectRef.current = onTrafficSelect;
  }, [onTrafficSelect]);

  useEffect(() => {
    if (mapRef.current || !mapContainerRef.current) return;
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: appliedStyleRef.current,
      center: [105, 35],
      zoom: 3.5,
      minZoom: 2,
      renderWorldCopies: true,
      attributionControl: false,
    });
    map.addControl(new mapboxgl.NavigationControl({showCompass: false}), 'bottom-right');
    window.requestAnimationFrame(() => map.resize());
    map.on('style.load', () => setMapLoaded(true));
    map.on('error', (event) => {
      console.warn('Mapbox error', event?.error || event);
    });
    map.on('click', 'traffic-points', (event) => {
      const feature = event.features?.[0];
      if (feature?.properties) trafficSelectRef.current?.(feature.properties);
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      setMapLoaded(false);
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    if (appliedStyleRef.current === style.url) return;
    appliedStyleRef.current = style.url;
    mapRef.current.setStyle(style.url);
  }, [style.url]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return undefined;
    const update = () => {
      addLineLayer(map, 'route-departure', '#ff6b6b');
      addLineLayer(map, 'route-cruise', '#1677ff');
      addLineLayer(map, 'route-arrival', '#16a34a');
      addLineLayer(map, 'procedure-preview', '#a855f7');
      addPointLayers(map, 'route-departure', '#ff6b6b');
      addPointLayers(map, 'route-cruise', '#1677ff');
      addPointLayers(map, 'route-arrival', '#16a34a');
      addPointLayers(map, 'procedure-preview', '#a855f7');
      map.getSource('route-departure')?.setData(pointsToLine(route?.departure || []));
      map.getSource('route-cruise')?.setData(pointsToLine(route?.cruise || []));
      map.getSource('route-arrival')?.setData(pointsToLine(route?.arrival || []));
      map.getSource('procedure-preview')?.setData(pointsToLine(procedurePreview?.waypoints || []));
      map.getSource('route-departure-points')?.setData(pointsToFeatures(route?.departure || [], 'departure'));
      map.getSource('route-cruise-points')?.setData(pointsToFeatures(route?.cruise || [], 'cruise'));
      map.getSource('route-arrival-points')?.setData(pointsToFeatures(route?.arrival || [], 'arrival'));
      map.getSource('procedure-preview-points')?.setData(pointsToFeatures(procedurePreview?.waypoints || [], 'preview'));
      const fitSignature = JSON.stringify([
        route?.departure?.map((point) => point.ident || point.icao),
        route?.cruise?.map((point) => point.ident || point.icao),
        route?.arrival?.map((point) => point.ident || point.icao),
      ]);
      if (!procedurePreview && fitSignature !== routeFitSignatureRef.current) {
        routeFitSignatureRef.current = fitSignature;
        fitRouteBounds(map, route);
      }
    };
    return whenStyleReady(map, update);
  }, [route, procedurePreview]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return undefined;
    const update = () => {
      const pilots = Array.isArray(whazzup?.pilot) ? whazzup.pilot : [];
      const trafficFeatures = networkTraffic ? pilots
        .filter((pilot) => String(pilot.cid || '') !== ownCid)
        .filter((pilot) => Number.isFinite(Number(pilot.longitude)) && Number.isFinite(Number(pilot.latitude)))
        .map((pilot) => ({
          type: 'Feature',
          geometry: {type: 'Point', coordinates: [Number(pilot.longitude), Number(pilot.latitude)]},
          properties: {
            callsign: pilot.callsign,
            cid: pilot.cid,
            altitude: pilot.altitude,
            groundspeed: pilot.groundspeed,
            heading: pilot.heading,
            route: pilot.flight_plan?.route || '',
          },
        })) : [];
      const ownPilot = pilots.find((pilot) => String(pilot.cid || pilot.callsign || '') === ownCid);
      const ownFeatures = movingMap && ownPilot ? [{
        type: 'Feature',
        geometry: {type: 'Point', coordinates: [Number(ownPilot.longitude), Number(ownPilot.latitude)]},
        properties: {},
      }] : [];

      if (!map.getSource('traffic')) map.addSource('traffic', {type: 'geojson', data: emptyCollection});
      if (!map.getLayer('traffic-points')) {
        map.addLayer({
          id: 'traffic-points',
          type: 'circle',
          source: 'traffic',
          paint: {'circle-radius': 5, 'circle-color': '#1677ff', 'circle-stroke-width': 1, 'circle-stroke-color': '#ffffff'},
        });
      }
      if (!map.getSource('ownship')) map.addSource('ownship', {type: 'geojson', data: emptyCollection});
      if (!map.getLayer('ownship-point')) {
        map.addLayer({
          id: 'ownship-point',
          type: 'circle',
          source: 'ownship',
          paint: {'circle-radius': 7, 'circle-color': '#faad14', 'circle-stroke-width': 2, 'circle-stroke-color': '#111827'},
        });
      }
      map.getSource('traffic')?.setData({type: 'FeatureCollection', features: trafficFeatures});
      map.getSource('ownship')?.setData({type: 'FeatureCollection', features: ownFeatures});
    };
    return whenStyleReady(map, update);
  }, [movingMap, networkTraffic, ownCid, user, whazzup]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return undefined;

    const removeGeoref = () => {
      try {
        if (map.getLayer('georef-chart-layer')) map.removeLayer('georef-chart-layer');
        if (map.getSource('georef-chart')) map.removeSource('georef-chart');
      } catch {
        // Style may be in a transitional state; safe to ignore.
      }
    };

    const applyGeoref = () => {
      removeGeoref();
      const coordinates = chartCoordinates(georefChart);
      const url = georefChart?.image_day_url || georefChart?.image_day;
      if (!coordinates || !url) return;
      try {
        map.addSource('georef-chart', {type: 'image', url, coordinates});
        map.addLayer({
          id: 'georef-chart-layer',
          type: 'raster',
          source: 'georef-chart',
          paint: {'raster-opacity': 0.72},
        });
      } catch {
        // Style not ready yet; will retry on style.load.
      }
    };

    applyGeoref();
    const onStyleLoad = () => applyGeoref();
    map.on('style.load', onStyleLoad);

    return () => {
      map.off('style.load', onStyleLoad);
      removeGeoref();
    };
  }, [georefChart, mapLoaded]);

  const mapPresetContent = (
    <div className="map-preset">
      <Text strong>Map Presets</Text>
      <Segmented
        vertical
        block
        value={styleId}
        onChange={setStyleId}
        options={MAP_STYLES.map((item) => ({label: item.label, value: item.id}))}
      />
    </div>
  );

  return (
    <div className="efb-map">
      <div
        ref={mapContainerRef}
        className="efb-map__canvas"
        style={{position: 'absolute', inset: 0, width: '100%', height: '100%'}}
      />
      <div className="map-controls">
        <Popover content={mapPresetContent} trigger="click" placement="rightTop">
          <Tooltip title="Map presets" placement="right">
            <Button icon={<GlobalOutlined/>}/>
          </Tooltip>
        </Popover>
        <Tooltip title="Network Traffic" placement="right">
          <Button className={networkTraffic ? 'is-active' : ''} icon={<EnvironmentOutlined/>} onClick={() => onNetworkTrafficChange(!networkTraffic)}/>
        </Tooltip>
        <Tooltip title="Moving Maps" placement="right">
          <Button className={movingMap ? 'is-active' : ''} icon={<AimOutlined/>} onClick={() => onMovingMapChange(!movingMap)}/>
        </Tooltip>
      </div>
      {selectedChart && <ChartOverlay chart={selectedChart} onClose={onCloseChart}/>}
    </div>
  );
}
