import {useEffect, useMemo, useState} from 'react';
import {Collapse, Descriptions, Empty, List, Space, Spin, Switch, Table, Tabs, Typography, message} from 'antd';
import {FileImageOutlined} from '@ant-design/icons';
import {chartsApi, navApi, weatherApi} from '../api';

const {Text, Title, Paragraph} = Typography;

const feetToMeters = (feet) => Number.isFinite(Number(feet)) ? Math.round(Number(feet) * 0.3048) : null;

const groupBy = (items, key) => items.reduce((acc, item) => {
  const value = item[key] || 'OTHER';
  acc[value] = acc[value] || [];
  acc[value].push(item);
  return acc;
}, {});

export default function AirportPanel({
  airportIcao,
  plan,
  routeData,
  selectedChart,
  georefChart,
  onAirportSelect,
  onChartSelect,
  onGeorefChartChange,
}) {
  const [loading, setLoading] = useState(false);
  const [airportData, setAirportData] = useState(null);
  const [weather, setWeather] = useState(null);
  const [charts, setCharts] = useState([]);
  const [chartsLoading, setChartsLoading] = useState(false);

  const candidateAirports = useMemo(() => {
    const codes = new Set();
    [plan?.origin, plan?.destination, routeData?.origin?.icao, routeData?.destination?.icao]
      .filter(Boolean)
      .forEach((code) => codes.add(code));
    return Array.from(codes);
  }, [plan, routeData]);

  useEffect(() => {
    if (!airportIcao) return;
    const load = async () => {
      setLoading(true);
      try {
        const data = await navApi.getAirport(airportIcao);
        setAirportData(data);
      } catch (error) {
        message.error(error.message || 'Failed to load airport');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [airportIcao]);

  useEffect(() => {
    if (!airportIcao) return;
    weatherApi.getAirportWeather(airportIcao).then(setWeather).catch(() => setWeather(null));
  }, [airportIcao]);

  useEffect(() => {
    if (!airportIcao) return;
    const loadCharts = async () => {
      setChartsLoading(true);
      try {
        const response = await chartsApi.getCharts(airportIcao);
        setCharts(response?.data?.charts || []);
      } catch {
        setCharts([]);
      } finally {
        setChartsLoading(false);
      }
    };
    loadCharts();
  }, [airportIcao]);

  if (!airportIcao) {
    return (
        <div className="panel-content">
          {candidateAirports.length ? (
            <List
              header="Airports in current plan"
              dataSource={candidateAirports}
              renderItem={(icao) => <List.Item className="selectable-list-item" onClick={() => onAirportSelect(icao)}>{icao}</List.Item>}
            />
          ) : (
            <Empty description="Search for an airport to open it" image={Empty.PRESENTED_IMAGE_SIMPLE}/>
          )}
        </div>
    );
  }

  const airport = airportData?.airport;
  const runways = airportData?.runways || [];
  const communications = airportData?.communications || [];
  const commGroups = groupBy(communications, 'communication_type');
  const longestMeters = feetToMeters(airport?.longest_runway_ft);
  const tabItems = [
    {
      key: 'info',
      label: 'Info',
      children: (
        <Descriptions size="small" column={1} bordered>
          <Descriptions.Item label="ICAO">{airport?.icao || '-'}</Descriptions.Item>
          <Descriptions.Item label="IATA">-</Descriptions.Item>
          <Descriptions.Item label="Name">{airport?.name || '-'}</Descriptions.Item>
          <Descriptions.Item label="Location">
            {airport ? `${airport.latitude?.toFixed?.(4) || airport.latitude}, ${airport.longitude?.toFixed?.(4) || airport.longitude}` : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Elevation">{airport?.elevation_ft ? `${airport.elevation_ft} ft` : '-'}</Descriptions.Item>
          <Descriptions.Item label="Longest Runway">
            {airport?.longest_runway_ft ? `${airport.longest_runway_ft} ft / ${longestMeters} m` : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Transition Altitude">{airport?.transition_altitude_ft || '-'}</Descriptions.Item>
          <Descriptions.Item label="Transition Level">{airport?.transition_level || '-'}</Descriptions.Item>
        </Descriptions>
      ),
    },
    {
      key: 'comms',
      label: 'Comms',
      children: communications.length ? (
        <Collapse
          size="small"
          items={Object.entries(commGroups).map(([type, items]) => ({
            key: type,
            label: `${type} (${items.length})`,
            children: (
              <List
                size="small"
                dataSource={items}
                renderItem={(item) => (
                  <List.Item>
                    <Text strong>{item.callsign || '-'}</Text>
                    <Text>{Number(item.frequency).toFixed(3)}</Text>
                  </List.Item>
                )}
              />
            ),
          }))}
        />
      ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No communication data"/>,
    },
    {
      key: 'runways',
      label: 'Runways',
      children: (
        <Table
          size="small"
          rowKey="id"
          dataSource={runways}
          pagination={false}
          scroll={{x: 'max-content'}}
          columns={[
            {title: 'Runway', dataIndex: 'ident'},
            {title: 'HDG', dataIndex: 'heading', render: (value) => Number(value).toFixed(0)},
            {title: 'Length', dataIndex: 'length_ft', render: (value) => `${value} ft`},
            {title: 'Elevation', dataIndex: 'elevation_ft', render: (value) => `${value} ft`},
          ]}
        />
      ),
    },
    {
      key: 'weather',
      label: 'Weather',
      children: (
        <Space direction="vertical" size="middle" style={{width: '100%'}}>
          <div>
            <Text strong>METAR</Text>
            <Paragraph copyable className="weather-text">{weather?.data?.metar || '-'}</Paragraph>
          </div>
          <div>
            <Text strong>TAF</Text>
            <Paragraph copyable className="weather-text">{weather?.data?.taf || '-'}</Paragraph>
          </div>
        </Space>
      ),
    },
    {
      key: 'charts',
      label: 'Charts',
      children: chartsLoading ? <Spin/> : (
        <List
          size="small"
          dataSource={charts}
          locale={{emptyText: 'No charts available'}}
          renderItem={(chart) => (
            <List.Item
              className={selectedChart?.id === chart.id ? 'selectable-list-item is-selected' : 'selectable-list-item'}
              onClick={() => onChartSelect(chart)}
              actions={[
                chart.is_georeferenced ? (
                  <Switch
                    key="georef"
                    size="small"
                    checked={georefChart?.id === chart.id}
                    onClick={(checked, event) => {
                      event.stopPropagation();
                      onGeorefChartChange(checked ? chart : null);
                    }}
                  />
                ) : null,
              ].filter(Boolean)}
            >
              <List.Item.Meta
                avatar={<FileImageOutlined/>}
                title={chart.name || chart.id}
                description={[chart.category, chart.index_number].filter(Boolean).join(' / ')}
              />
            </List.Item>
          )}
        />
      ),
    },
  ];

  return (
      <div className="panel-content">
        {loading ? <Spin/> : (
          <Space direction="vertical" size="middle" style={{width: '100%'}}>
            <div>
              <Title level={4} style={{marginBottom: 0}}>{airport?.icao || airportIcao}</Title>
              <Text type="secondary">{airport?.name || '-'}</Text>
            </div>
            <Tabs items={tabItems}/>
          </Space>
        )}
      </div>
  );
}
