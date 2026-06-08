import {useEffect, useMemo, useRef, useState} from 'react';
import {Button, Popover, Segmented, Space, Switch, Tooltip, Typography} from 'antd';
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

mapboxgl.accessToken = MAPBOX_TOKEN;

const {Text} = Typography;

const emptyCollection = {type: 'FeatureCollection', features: []};

const pointsToLine = (points) => ({
  type: 'FeatureCollection',
  features: points?.length > 1 ? [{
    type: 'Feature',
    geometry: {type: 'LineString', coordinates: points.map((point) => [point.longitude, point.latitude])},
    properties: {},
  }] : [],
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
  const appliedStyleRef = useRef(MAP_STYLES[0].url);
  const [styleId, setStyleId] = useState('ifr-high');

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
      attributionControl: false,
    });
    map.addControl(new mapboxgl.NavigationControl({showCompass: false}), 'bottom-right');
    window.requestAnimationFrame(() => map.resize());
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
      map.getSource('route-departure')?.setData(pointsToLine(route?.departure || []));
      map.getSource('route-cruise')?.setData(pointsToLine(route?.cruise || []));
      map.getSource('route-arrival')?.setData(pointsToLine(route?.arrival || []));
      map.getSource('procedure-preview')?.setData(pointsToLine(procedurePreview?.waypoints || []));
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
    if (!map) return undefined;
    const update = () => {
      if (map.getLayer('georef-chart-layer')) map.removeLayer('georef-chart-layer');
      if (map.getSource('georef-chart')) map.removeSource('georef-chart');
      const coordinates = chartCoordinates(georefChart);
      const url = georefChart?.image_day_url || georefChart?.image_day;
      if (coordinates && url) {
        map.addSource('georef-chart', {type: 'image', url, coordinates});
        map.addLayer({
          id: 'georef-chart-layer',
          type: 'raster',
          source: 'georef-chart',
          paint: {'raster-opacity': 0.72},
        });
      }
    };
    return whenStyleReady(map, update);
  }, [georefChart]);

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
        <div className="map-controls__switch">
          <Switch size="small" checked={networkTraffic} onChange={onNetworkTrafficChange}/>
          <Text type="secondary">Traffic</Text>
        </div>
      </div>
      {selectedChart && <ChartOverlay chart={selectedChart} onClose={onCloseChart}/>}
    </div>
  );
}
