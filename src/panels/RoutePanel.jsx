import {useEffect, useState} from 'react';
import {Button, Dropdown, Input, List, Segmented, Space, Tag, Typography, message} from 'antd';
import {ArrowLeftOutlined, MoreOutlined, PlusOutlined, ThunderboltOutlined} from '@ant-design/icons';
import AirportSearchModal from '../components/AirportSearchModal';
import {navApi} from '../api';

const {Text} = Typography;

const airportIcao = (airport) => (typeof airport === 'string' ? airport : airport?.icao);

const procedureRunways = (procedures) => {
  const values = new Set();
  procedures.forEach((item) => values.add(item.runway || 'ALL'));
  return ['ALL', ...Array.from(values).filter((value) => value !== 'ALL').sort()];
};

const procedureNames = (procedures) => ['Direct', ...Array.from(new Set(procedures.map((item) => item.procedure))).sort()];

function ProcedureChooser({mode, airport, procedures, selected, onBack, onPreview, onSelect}) {
  const [runway, setRunway] = useState(selected?.runway || 'ALL');
  const [procedure, setProcedure] = useState(selected?.procedure || 'Direct');
  const [transition, setTransition] = useState(selected?.transition || 'None');
  const filtered = procedures.filter((item) => runway === 'ALL' || item.runway === runway);
  const transitions = filtered.filter((item) => item.procedure === procedure);
  const selectedItem = transitions.find((item) => (item.transition || 'None') === transition) || transitions[0];

  useEffect(() => {
    onPreview(procedure === 'Direct' ? null : selectedItem || null);
  }, [onPreview, procedure, selectedItem]);

  const transitionOptions = procedure === 'Direct'
    ? [{transition: 'None'}]
    : transitions.length ? transitions : [{transition: 'None'}];

  return (
    <div className="procedure-page">
      <Button type="text" icon={<ArrowLeftOutlined/>} onClick={onBack}>Back</Button>
      <Segmented
        value={runway}
        onChange={(value) => {
          setRunway(value);
          setProcedure('Direct');
          setTransition('None');
        }}
        options={procedureRunways(procedures).map((item) => ({label: item, value: item}))}
        style={{margin: '8px 0 12px'}}
      />
      <div className="procedure-columns">
        <div>
          <Text strong>Procedure</Text>
          <List
            size="small"
            dataSource={procedureNames(filtered)}
            renderItem={(item) => (
              <List.Item
                className={procedure === item ? 'selectable-list-item is-selected' : 'selectable-list-item'}
                onClick={() => {
                  setProcedure(item);
                  const nextTransition = filtered.find((option) => option.procedure === item)?.transition || 'None';
                  setTransition(item === 'Direct' ? 'None' : nextTransition);
                }}
              >
                {item}
              </List.Item>
            )}
          />
        </div>
        <div>
          <Text strong>Transition</Text>
          <List
            size="small"
            dataSource={transitionOptions}
            renderItem={(item) => {
              const value = item.transition || 'None';
              return (
                <List.Item
                  className={transition === value ? 'selectable-list-item is-selected' : 'selectable-list-item'}
                  onClick={() => setTransition(value)}
                >
                  {value}
                </List.Item>
              );
            }}
          />
        </div>
      </div>
      <Button
        block
        type="primary"
        onClick={() => onSelect(procedure === 'Direct' ? null : selectedItem)}
      >
        Select {mode === 'departure' ? 'Departure' : 'Arrival'} for {airportIcao(airport)}
      </Button>
    </div>
  );
}

function RouteHeader() {
  return (
    <div className="route-header">
      <Text strong>Ident</Text>
    </div>
  );
}

function RoutePoint({point, section}) {
  return (
    <div className={`route-point route-point--${section || point.type || 'route'}`}>
      <Text strong>{point.ident || point.icao || '-'}</Text>
      <Text type="secondary">{point.name || point.type || ''}</Text>
    </div>
  );
}

function AddRow({label, disabled, onClick}) {
  return (
    <Button className="route-add-row" icon={<PlusOutlined/>} disabled={disabled} onClick={onClick}>
      {label}
    </Button>
  );
}

function SectionTitle({title, color, action}) {
  return (
    <div className="route-section-title">
      <Text style={color ? {color} : undefined}>{title}</Text>
      {action}
    </div>
  );
}

export default function RoutePanel({
  routeText,
  routeData,
  routeOrigin,
  routeDestination,
  selectedDeparture,
  selectedArrival,
  onRouteTextChange,
  onParseRoute,
  onAutoRoute,
  onProcedureSelect,
  onProcedurePreview,
  onRouteAirportChange,
  onOpenAirport,
}) {
  const [chooser, setChooser] = useState(null);
  const [airportTarget, setAirportTarget] = useState(null);
  const [departureOptions, setDepartureOptions] = useState([]);
  const [arrivalOptions, setArrivalOptions] = useState([]);

  const origin = routeOrigin || routeData?.origin;
  const destination = routeDestination || routeData?.destination;
  const originIcao = airportIcao(origin);
  const destinationIcao = airportIcao(destination);
  const routePoints = routeData?.route?.waypoints || [];
  const cruisePoints = routePoints.filter((point) => ![originIcao, destinationIcao].includes(point.ident || point.icao));

  useEffect(() => {
    if (!originIcao) {
      return undefined;
    }
    let cancelled = false;
    navApi.getAirportProcedures(originIcao, 'departure')
      .then((data) => {
        if (!cancelled) setDepartureOptions(data.procedures || []);
      })
      .catch((error) => {
        if (!cancelled) {
          setDepartureOptions([]);
          message.error(error.message || 'Failed to load departure procedures');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [originIcao]);

  useEffect(() => {
    if (!destinationIcao) {
      return undefined;
    }
    let cancelled = false;
    navApi.getAirportProcedures(destinationIcao, 'arrival')
      .then((data) => {
        if (!cancelled) setArrivalOptions(data.procedures || []);
      })
      .catch((error) => {
        if (!cancelled) {
          setArrivalOptions([]);
          message.error(error.message || 'Failed to load arrival procedures');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [destinationIcao]);

  const currentProcedures = chooser === 'departure' ? departureOptions : arrivalOptions;
  const currentAirport = chooser === 'departure' ? origin : destination;
  const currentSelection = chooser === 'departure' ? selectedDeparture : selectedArrival;

  const originMenu = {
    items: [
      {key: 'change', label: 'Change Airport'},
      ...(originIcao ? [{key: 'open', label: 'Open Airport'}] : []),
    ],
    onClick: ({key}) => {
      if (key === 'change') setAirportTarget('origin');
      if (key === 'open' && originIcao) onOpenAirport(originIcao);
    },
  };

  const destinationMenu = {
    items: [
      {key: 'change', label: 'Change Airport'},
      ...(destinationIcao ? [{key: 'open', label: 'Open Airport'}] : []),
    ],
    onClick: ({key}) => {
      if (key === 'change') setAirportTarget('destination');
      if (key === 'open' && destinationIcao) onOpenAirport(destinationIcao);
    },
  };

  const procedureMenu = (mode, selected) => ({
    items: [
      ...(selected ? [{key: 'remove', label: 'Remove Procedure'}] : []),
      {key: 'change', label: 'Change Procedure'},
    ],
    onClick: ({key}) => {
      if (key === 'remove') onProcedureSelect(mode, null);
      if (key === 'change') setChooser(mode);
    },
  });

  if (chooser) {
    return (
      <ProcedureChooser
        mode={chooser}
        airport={currentAirport}
        procedures={currentProcedures}
        selected={currentSelection}
        onBack={() => { setChooser(null); onProcedurePreview(null); }}
        onPreview={onProcedurePreview}
        onSelect={(procedure) => {
          onProcedureSelect(chooser, procedure);
          onProcedurePreview(null);
          setChooser(null);
        }}
      />
    );
  }

  return (
    <div className="panel-content route-panel">
      <Input.TextArea
        className="route-textarea"
        rows={4}
        value={routeText}
        onChange={(event) => onRouteTextChange(event.target.value.toUpperCase())}
        onBlur={onParseRoute}
        onPressEnter={(event) => {
          if (event.ctrlKey || event.metaKey) onParseRoute();
        }}
        placeholder="Enter route as text"
      />
      <RouteHeader/>
      <div className="route-timeline">
        <SectionTitle
          title="Origin"
          action={originIcao ? (
            <Dropdown menu={originMenu} trigger={['click']}>
              <Button type="text" size="small" icon={<MoreOutlined/>}/>
            </Dropdown>
          ) : null}
        />
        {originIcao ? (
          <RoutePoint point={{ident: originIcao, elevation_ft: origin?.elevation_ft}} section="origin"/>
        ) : <AddRow label="Add" onClick={() => setAirportTarget('origin')}/>}

        {originIcao && (
          <>
            <SectionTitle
              title="Departure"
              color="#ff4d4f"
              action={
                <Space size={4}>
                  <Tag color={selectedDeparture ? 'red' : 'default'}>{selectedDeparture?.procedure || 'Direct'}</Tag>
                  <Dropdown menu={procedureMenu('departure', selectedDeparture)} trigger={['click']}>
                    <Button type="text" size="small" icon={<MoreOutlined/>}/>
                  </Dropdown>
                </Space>
              }
            />
            {(selectedDeparture?.waypoints || []).map((point, index) => (
              <RoutePoint key={`dep-${point.ident}-${index}`} point={point} section="departure"/>
            ))}
          </>
        )}

        <SectionTitle
          title="Route"
          color="#a855f7"
          action={
            <Button
              icon={<ThunderboltOutlined/>}
              disabled={!originIcao || !destinationIcao}
              onClick={onAutoRoute}
            >
              Auto-Route
            </Button>
          }
        />
        {cruisePoints.length ? cruisePoints.map((point, index) => (
          <RoutePoint key={`route-${point.ident}-${index}`} point={point} section="route"/>
        )) : <AddRow label="Add" disabled/>}

        {destinationIcao && (
          <>
            <SectionTitle
              title="Arrival"
              color="#52c41a"
              action={
                <Space size={4}>
                  <Tag color={selectedArrival ? 'green' : 'default'}>{selectedArrival?.procedure || 'Direct'}</Tag>
                  <Dropdown menu={procedureMenu('arrival', selectedArrival)} trigger={['click']}>
                    <Button type="text" size="small" icon={<MoreOutlined/>}/>
                  </Dropdown>
                </Space>
              }
            />
            {(selectedArrival?.waypoints || []).map((point, index) => (
              <RoutePoint key={`arr-${point.ident}-${index}`} point={point} section="arrival"/>
            ))}
          </>
        )}

        <SectionTitle
          title="Destination"
          action={destinationIcao ? (
            <Dropdown menu={destinationMenu} trigger={['click']}>
              <Button type="text" size="small" icon={<MoreOutlined/>}/>
            </Dropdown>
          ) : null}
        />
        {destinationIcao ? (
          <RoutePoint point={{ident: destinationIcao, elevation_ft: destination?.elevation_ft}} section="destination"/>
        ) : <AddRow label="Add" onClick={() => setAirportTarget('destination')}/>}
      </div>
      <AirportSearchModal
        open={Boolean(airportTarget)}
        title={airportTarget === 'origin' ? 'Select Origin' : 'Select Destination'}
        onCancel={() => setAirportTarget(null)}
        onSelect={(airport) => {
          onRouteAirportChange(airportTarget, airport);
          setAirportTarget(null);
        }}
      />
    </div>
  );
}
