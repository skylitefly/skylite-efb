import {useCallback, useEffect, useMemo, useState} from 'react';
import {Button, Layout, Menu, Spin, Typography, message} from 'antd';
import {
  CompassOutlined,
  EnvironmentOutlined,
  LoginOutlined,
  NodeIndexOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import './App.css';
import {fetchWhazzup, navApi, oauthApi} from './api';
import {clearToken, completeLoginFromCallback, getStoredToken, startLogin} from './auth';
import GlobalSearch from './components/GlobalSearch';
import SidePanel from './components/SidePanel';
import EfbMap from './components/EfbMap';
import FlightPlanPanel from './panels/FlightPlanPanel';
import RoutePanel from './panels/RoutePanel';
import AirportPanel from './panels/AirportPanel';
import SettingsPanel from './panels/SettingsPanel';

const {Header, Sider, Content} = Layout;
const {Text} = Typography;

const panelMeta = {
  flightPlan: {title: 'Flight Plan', icon: <CompassOutlined/>},
  route: {title: 'Route', icon: <NodeIndexOutlined/>},
  airport: {title: 'Airport', icon: <EnvironmentOutlined/>},
  settings: {title: 'Settings', icon: <SettingOutlined/>},
};

const panelItems = Object.entries(panelMeta).map(([key, item]) => ({
  key,
  icon: item.icon,
  label: item.title,
}));

const onlinePilotForUser = (whazzup, user) => {
  const cid = String(user?.preferred_username || user?.username || user?.sub || '');
  const pilots = Array.isArray(whazzup?.pilot) ? whazzup.pilot : [];
  return pilots.find((pilot) => String(pilot.cid || pilot.callsign || '') === cid);
};

const routeTextEndpoints = (routeText) => {
  const tokens = String(routeText || '').toUpperCase().match(/[A-Z0-9]{2,}/g) || [];
  const airports = tokens.filter((token) => /^[A-Z]{4}$/.test(token));
  return {origin: airports[0], destination: airports.at(-1)};
};

const pointKey = (point) => point?.ident || point?.icao || point?.id || '';

const sameRoutePoint = (a, b) => {
  const aKey = pointKey(a);
  const bKey = pointKey(b);
  if (aKey && bKey && aKey === bKey) return true;
  return Number.isFinite(Number(a?.longitude)) && Number.isFinite(Number(b?.longitude))
    && Number.isFinite(Number(a?.latitude)) && Number.isFinite(Number(b?.latitude))
    && Math.abs(Number(a.longitude) - Number(b.longitude)) < 0.0001
    && Math.abs(Number(a.latitude) - Number(b.latitude)) < 0.0001;
};

const dedupeRoutePoints = (points) => {
  const result = [];
  (points || []).forEach((point) => {
    if (!point) return;
    if (result.length && sameRoutePoint(result.at(-1), point)) return;
    result.push(point);
  });
  return result;
};

const indexOfRoutePoint = (points, target) => points.findIndex((point) => sameRoutePoint(point, target));

const buildRouteOverlay = (routeData, departure, arrival) => {
  const points = routeData?.route?.waypoints || [];
  const origin = points[0] || routeData?.origin;
  const destination = points.at(-1) || routeData?.destination;
  const departureConnection = departure?.waypoints?.at(-1);
  const arrivalConnection = arrival?.waypoints?.[0];

  const departureConnectionIndex = departureConnection ? indexOfRoutePoint(points, departureConnection) : -1;
  const arrivalConnectionIndex = arrivalConnection ? indexOfRoutePoint(points, arrivalConnection) : -1;
  const firstCruisePoint = points.length > 1 ? points[1] : null;
  const lastCruisePoint = points.length > 1 ? points.at(-2) : null;

  const cruiseStart = departureConnectionIndex >= 0 ? departureConnectionIndex : Math.min(points.length, firstCruisePoint ? 1 : 0);
  const cruiseEndExclusive = arrivalConnectionIndex >= 0 ? arrivalConnectionIndex + 1 : Math.max(cruiseStart, points.length - (lastCruisePoint ? 1 : 0));
  const cruise = points.slice(cruiseStart, cruiseEndExclusive);

  return {
    departure: departure
      ? dedupeRoutePoints([origin, ...(departure.waypoints || [])])
      : dedupeRoutePoints([origin, firstCruisePoint].filter(Boolean)),
    cruise,
    arrival: arrival
      ? dedupeRoutePoints([...(arrival.waypoints || []), destination])
      : dedupeRoutePoints([lastCruisePoint, destination].filter(Boolean)),
  };
};

function LandingPage({onLogin, loading}) {
  return (
    <div className="landing-page">
      <div className="landing-page__brand">
        <span className="landing-page__brand-main">Skylite</span>
        <span className="landing-page__brand-product">EFB</span>
      </div>
      <Text type="secondary">Login is required to use Skylite EFB.</Text>
      <Button type="primary" size="large" icon={<LoginOutlined/>} loading={loading} onClick={onLogin}>
        Login
      </Button>
    </div>
  );
}

export default function App() {
  const [booting, setBooting] = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [preferences, setPreferences] = useState({});
  const [sideOpen, setSideOpen] = useState(true);
  const [activePanel, setActivePanel] = useState('flightPlan');
  const [plan, setPlan] = useState(null);
  const [routeOrigin, setRouteOrigin] = useState(null);
  const [routeDestination, setRouteDestination] = useState(null);
  const [routeText, setRouteText] = useState('');
  const [routeData, setRouteData] = useState(null);
  const [selectedDeparture, setSelectedDeparture] = useState(null);
  const [selectedArrival, setSelectedArrival] = useState(null);
  const [procedurePreview, setProcedurePreview] = useState(null);
  const [airportIcao, setAirportIcao] = useState(null);
  const [selectedChart, setSelectedChart] = useState(null);
  const [georefChart, setGeorefChart] = useState(null);
  const [whazzup, setWhazzup] = useState(null);
  const [networkTraffic, setNetworkTraffic] = useState(false);
  const [movingMap, setMovingMap] = useState(false);

  useEffect(() => {
    const boot = async () => {
      setBooting(true);
      try {
        let stored = await completeLoginFromCallback();
        if (!stored) stored = getStoredToken();
        if (!stored?.access_token) return;
        setToken(stored);
        const profile = await oauthApi.userInfo(stored.access_token);
        setUser(profile);
        const pref = await oauthApi.preferences(stored.access_token);
        setPreferences(pref.preferences || {});
      } catch (error) {
        clearToken();
        message.error(error.message || 'Login failed');
      } finally {
        setBooting(false);
      }
    };
    boot();
  }, []);

  useEffect(() => {
    if (!networkTraffic && !movingMap) return undefined;
    let stopped = false;
    const load = async () => {
      try {
        const data = await fetchWhazzup();
        if (!stopped) setWhazzup(data);
      } catch {
        if (!stopped) message.error('Failed to fetch whazzup data');
      }
    };
    load();
    const timer = window.setInterval(load, 5000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [movingMap, networkTraffic]);

  const patchPreferences = useCallback(async (next) => {
    setPreferences((current) => ({...current, ...next}));
    if (!token?.access_token) return;
    const response = await oauthApi.patchPreferences(token.access_token, next);
    setPreferences(response.preferences || {});
    message.success('Preferences saved');
  }, [token]);

  const openAirport = useCallback((airport) => {
    const icao = typeof airport === 'string' ? airport : airport?.icao;
    if (!icao) return;
    setAirportIcao(icao.toUpperCase());
    setActivePanel('airport');
    setSideOpen(true);
  }, []);

  const parseRouteText = useCallback(async ({text, origin, destination, silent = false}) => {
    if (!text?.trim()) return null;
    const endpoints = routeTextEndpoints(text);
    const resolvedOrigin = origin || routeOrigin?.icao || routeData?.origin?.icao || plan?.origin || endpoints.origin;
    const resolvedDestination = destination || routeDestination?.icao || routeData?.destination?.icao || plan?.destination || endpoints.destination;
    const hide = silent ? null : message.loading('Parsing route...', 0);
    try {
      const parsed = await navApi.parseRoute({route: text, origin: resolvedOrigin, destination: resolvedDestination});
      setRouteData((current) => ({
        ...(current || {}),
        origin: resolvedOrigin ? {icao: resolvedOrigin} : current?.origin,
        destination: resolvedDestination ? {icao: resolvedDestination} : current?.destination,
        route: {
          string: parsed.route,
          distance_nm: parsed.distance_nm,
          distance_km: parsed.distance_km,
          waypoints: parsed.waypoints || [],
          segments: parsed.segments || [],
        },
      }));
      return parsed;
    } catch (error) {
      if (!silent) message.error(error.message || 'Route parsing failed');
      return null;
    } finally {
      hide?.();
    }
  }, [plan, routeData, routeDestination, routeOrigin]);

  const updatePlan = useCallback(async (nextPlan) => {
    setPlan(nextPlan);
    const nextRoute = nextPlan?.route || '';
    const nextOrigin = nextPlan?.origin ? {icao: nextPlan.origin} : null;
    const nextDestination = nextPlan?.destination ? {icao: nextPlan.destination} : null;
    setRouteText(nextRoute);
    setRouteOrigin(nextOrigin);
    setRouteDestination(nextDestination);
    setSelectedDeparture(null);
    setSelectedArrival(null);
    setProcedurePreview(null);
    if (nextRoute) {
      await parseRouteText({
        text: nextRoute,
        origin: nextPlan?.origin,
        destination: nextPlan?.destination,
        silent: false,
      });
    }
  }, [parseRouteText]);

  const autoRoute = useCallback(async () => {
    const origin = routeOrigin?.icao || routeData?.origin?.icao || plan?.origin;
    const destination = routeDestination?.icao || routeData?.destination?.icao || plan?.destination;
    if (!origin || !destination) return;
    const hide = message.loading('Planning route...', 0);
    try {
      const data = await navApi.planRoute({
        origin,
        destination,
        ...(selectedDeparture ? {departure: selectedDeparture.procedure, departure_transition: selectedDeparture.transition} : {}),
        ...(selectedArrival ? {arrival: selectedArrival.procedure, arrival_transition: selectedArrival.transition} : {}),
      });
      setRouteData(data);
      setRouteText(data.route?.string || '');
      setRouteOrigin(data.origin || {icao: origin});
      setRouteDestination(data.destination || {icao: destination});
      setSelectedDeparture(data.selected_departure || selectedDeparture || null);
      setSelectedArrival(data.selected_arrival || selectedArrival || null);
      setPlan((current) => ({...(current || {}), origin, destination, route: data.route?.string || ''}));
      setActivePanel('route');
      setSideOpen(true);
    } catch (error) {
      message.error(error.message || 'Route planning failed');
    } finally {
      hide();
    }
  }, [plan, routeData, routeDestination, routeOrigin, selectedArrival, selectedDeparture]);

  const parseRoute = useCallback(async () => {
    await parseRouteText({text: routeText});
  }, [parseRouteText, routeText]);

  const handleRouteAirportChange = useCallback((target, airport) => {
    if (target === 'origin') {
      setRouteOrigin(airport);
      setSelectedDeparture(null);
      setProcedurePreview(null);
      setPlan((current) => current ? {...current, origin: airport.icao} : current);
    }
    if (target === 'destination') {
      setRouteDestination(airport);
      setSelectedArrival(null);
      setProcedurePreview(null);
      setPlan((current) => current ? {...current, destination: airport.icao} : current);
    }
    setRouteData((current) => ({
      ...(current || {}),
      ...(target === 'origin' ? {origin: airport} : {}),
      ...(target === 'destination' ? {destination: airport} : {}),
      route: routeText ? current?.route : null,
    }));
  }, [routeText]);

  const handleMovingMapChange = useCallback(async (checked) => {
    if (!checked) {
      setMovingMap(false);
      return;
    }
    const hide = message.loading('Checking online position...', 0);
    try {
      const data = await fetchWhazzup();
      setWhazzup(data);
      if (!onlinePilotForUser(data, user)) {
        message.error('Your CID is not online in whazzup.json');
        return;
      }
      setMovingMap(true);
    } catch (error) {
      message.error(error.message || 'Moving Maps check failed');
    } finally {
      hide();
    }
  }, [user]);

  const routeOverlay = useMemo(
    () => buildRouteOverlay(routeData, selectedDeparture, selectedArrival),
    [routeData, selectedArrival, selectedDeparture],
  );

  if (booting) {
    return <div className="boot-screen"><Spin size="large"/></div>;
  }

  if (!token?.access_token) {
    return (
      <LandingPage
        loading={loginLoading}
        onLogin={async () => {
          setLoginLoading(true);
          try {
            await startLogin();
          } catch (error) {
            message.error(error.message);
            setLoginLoading(false);
          }
        }}
      />
    );
  }

  return (
    <Layout className="app-shell">
      <Header className="app-header">
        <div className="app-header__brand">
          <span className="app-header__brand-main">Skylite</span>
          <span className="app-header__brand-product">EFB</span>
        </div>
        <GlobalSearch onAirportSelect={openAirport}/>
        <Text type="secondary" className="app-header__user">{user?.preferred_username || user?.username}</Text>
      </Header>
      <Layout className="app-main">
        <Sider theme="light" collapsed trigger={null} width={64} collapsedWidth={64} className="app-sider">
          <Menu
            mode="inline"
            selectedKeys={[activePanel]}
            items={panelItems}
            onClick={({key}) => {
              setActivePanel(key);
              setSideOpen(true);
            }}
          />
        </Sider>
        <Content className="workspace">
          {sideOpen && (
            <SidePanel title={panelMeta[activePanel].title} onClose={() => setSideOpen(false)}>
              <div className={activePanel === 'flightPlan' ? 'panel-pane is-active' : 'panel-pane'}>
                <FlightPlanPanel
                  plan={plan}
                  user={user}
                  preferences={preferences}
                  onPlanChange={updatePlan}
                  onPreferenceChange={patchPreferences}
                  onOpenAirport={openAirport}
                />
              </div>
              <div className={activePanel === 'route' ? 'panel-pane is-active' : 'panel-pane'}>
                <RoutePanel
                  routeText={routeText}
                  routeData={routeData}
                  routeOrigin={routeOrigin}
                  routeDestination={routeDestination}
                  selectedDeparture={selectedDeparture}
                  selectedArrival={selectedArrival}
                  onRouteTextChange={setRouteText}
                  onParseRoute={parseRoute}
                  onAutoRoute={autoRoute}
                  onProcedureSelect={(mode, procedure) => {
                    if (mode === 'departure') setSelectedDeparture(procedure);
                    if (mode === 'arrival') setSelectedArrival(procedure);
                  }}
                  onProcedurePreview={setProcedurePreview}
                  onRouteAirportChange={handleRouteAirportChange}
                  onOpenAirport={openAirport}
                />
              </div>
              <div className={activePanel === 'airport' ? 'panel-pane is-active' : 'panel-pane'}>
                <AirportPanel
                  airportIcao={airportIcao}
                  plan={plan}
                  preferences={preferences}
                  routeData={routeData}
                  selectedChart={selectedChart}
                  georefChart={georefChart}
                  onAirportSelect={openAirport}
                  onChartSelect={setSelectedChart}
                  onGeorefChartChange={setGeorefChart}
                />
              </div>
              <div className={activePanel === 'settings' ? 'panel-pane is-active' : 'panel-pane'}>
                <SettingsPanel
                  preferences={preferences}
                  onPreferenceChange={patchPreferences}
                  onLogout={() => {
                    clearToken();
                    setToken(null);
                    setUser(null);
                  }}
                />
              </div>
            </SidePanel>
          )}
          <EfbMap
            route={routeOverlay}
            procedurePreview={procedurePreview}
            selectedChart={selectedChart}
            georefChart={georefChart}
            whazzup={whazzup}
            networkTraffic={networkTraffic}
            movingMap={movingMap}
            user={user}
            onTrafficSelect={(traffic) => {
              message.info(`${traffic.callsign || 'Traffic'} ${traffic.altitude || ''}`);
            }}
            onCloseChart={() => setSelectedChart(null)}
            onNetworkTrafficChange={setNetworkTraffic}
            onMovingMapChange={handleMovingMapChange}
          />
        </Content>
      </Layout>
    </Layout>
  );
}
