import {useMemo, useState} from 'react';
import {Button, Empty, Input, List, Segmented, Space, Tag, Typography} from 'antd';
import {ArrowLeftOutlined, ThunderboltOutlined} from '@ant-design/icons';

const {Text, Title} = Typography;

const procedureRunways = (procedures) => {
  const values = new Set();
  procedures.forEach((item) => values.add(item.runway || 'ALL'));
  return ['ALL', ...Array.from(values).filter((value) => value !== 'ALL').sort()];
};

function ProcedureChooser({mode, airport, procedures, selected, onBack, onPreview, onSelect}) {
  const [runway, setRunway] = useState('ALL');
  const [procedure, setProcedure] = useState(selected?.procedure || 'Direct');
  const filtered = procedures.filter((item) => runway === 'ALL' || item.runway === runway);
  const transitions = filtered.filter((item) => item.procedure === procedure);
  const selectedItem = transitions[0] || filtered.find((item) => item.procedure === procedure);

  return (
    <div className="procedure-page">
      <Button type="text" icon={<ArrowLeftOutlined/>} onClick={onBack}>Back</Button>
      <Segmented
        value={runway}
        onChange={setRunway}
        options={procedureRunways(procedures).map((item) => ({label: item, value: item}))}
        style={{margin: '8px 0 12px'}}
      />
      <div className="procedure-columns">
        <div>
          <Text strong>Procedure</Text>
          <List
            size="small"
            dataSource={['Direct', ...Array.from(new Set(filtered.map((item) => item.procedure))).sort()]}
            renderItem={(item) => (
              <List.Item
                className={procedure === item ? 'selectable-list-item is-selected' : 'selectable-list-item'}
                onClick={() => {
                  setProcedure(item);
                  const preview = filtered.find((option) => option.procedure === item);
                  onPreview(preview || null);
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
            dataSource={procedure === 'Direct' ? [{transition: 'None'}] : transitions}
            renderItem={(item) => (
              <List.Item className="selectable-list-item">
                {item.transition || 'None'}
              </List.Item>
            )}
          />
        </div>
      </div>
      <Button
        block
        type="primary"
        onClick={() => onSelect(procedure === 'Direct' ? null : selectedItem)}
      >
        Select {mode === 'departure' ? 'Departure' : 'Arrival'} for {airport}
      </Button>
    </div>
  );
}

export default function RoutePanel({
  plan,
  routeText,
  routeData,
  selectedDeparture,
  selectedArrival,
  onRouteTextChange,
  onParseRoute,
  onAutoRoute,
  onProcedureSelect,
  onProcedurePreview,
}) {
  const [chooser, setChooser] = useState(null);
  const origin = routeData?.origin?.icao || plan?.origin;
  const destination = routeData?.destination?.icao || plan?.destination;
  const departureOptions = routeData?.departure_options || [];
  const arrivalOptions = routeData?.arrival_options || [];
  const timeline = useMemo(() => {
    const points = routeData?.route?.waypoints || [];
    if (points.length) return points;
    return [origin, destination].filter(Boolean).map((icao) => ({ident: icao, type: 'airport'}));
  }, [destination, origin, routeData]);

  if (chooser) {
    return (
        <ProcedureChooser
          mode={chooser}
          airport={chooser === 'departure' ? origin : destination}
          procedures={chooser === 'departure' ? departureOptions : arrivalOptions}
          selected={chooser === 'departure' ? selectedDeparture : selectedArrival}
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

  const actions = (
    <Button icon={<ThunderboltOutlined/>} disabled={!origin || !destination} onClick={onAutoRoute}>
      Auto
    </Button>
  );

  return (
      <div className="panel-content">
        <div className="panel-toolbar">{actions}</div>
        <Space direction="vertical" size="middle" style={{width: '100%'}}>
          <Input.TextArea
            rows={4}
            value={routeText}
            onChange={(event) => onRouteTextChange(event.target.value.toUpperCase())}
            onBlur={onParseRoute}
            onPressEnter={(event) => {
              if (event.ctrlKey || event.metaKey) onParseRoute();
            }}
            placeholder="ZBAA SID OMDUP A599 STAR ZGGG"
          />
          {!origin || !destination ? (
            <Empty description="Select origin and destination to plan a route" image={Empty.PRESENTED_IMAGE_SIMPLE}/>
          ) : (
            <div className="route-timeline">
              <div className="route-row route-row--section">
                <Title level={5}>Origin</Title>
                <Text strong>{origin}</Text>
              </div>
              <div className="route-row">
                <Text type="danger">Departure</Text>
                <Space>
                  <Tag color={selectedDeparture ? 'red' : 'default'}>{selectedDeparture?.procedure || 'Direct'}</Tag>
                  <Button size="small" onClick={() => setChooser('departure')}>Change</Button>
                </Space>
              </div>
              {timeline.map((point, index) => (
                <div className="route-row" key={`${point.ident || point}-${index}`}>
                  <Text code>{point.ident || point}</Text>
                  <Text type="secondary">{point.type || 'waypoint'}</Text>
                </div>
              ))}
              <div className="route-row">
                <Text type="success">Arrival</Text>
                <Space>
                  <Tag color={selectedArrival ? 'green' : 'default'}>{selectedArrival?.procedure || 'Direct'}</Tag>
                  <Button size="small" onClick={() => setChooser('arrival')}>Change</Button>
                </Space>
              </div>
              <div className="route-row route-row--section">
                <Title level={5}>Destination</Title>
                <Text strong>{destination}</Text>
              </div>
            </div>
          )}
        </Space>
      </div>
  );
}
