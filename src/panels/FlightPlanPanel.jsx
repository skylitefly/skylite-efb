import {useState} from 'react';
import {Button, Descriptions, Dropdown, Empty, Input, message, Modal, Space, Typography} from 'antd';
import {CloudDownloadOutlined} from '@ant-design/icons';
import {fetchSimBrief, fetchWhazzup} from '../api';

const {Text} = Typography;

const normalizeSimBriefPlan = (data) => ({
  callsign: data?.general?.icao_airline ? `${data.general.icao_airline}${data.general.flight_number || ''}` : '',
  aircraft: data?.aircraft?.icaocode || data?.aircraft?.name || '',
  origin: data?.origin?.icao_code || '',
  destination: data?.destination?.icao_code || '',
  alternate: data?.alternate?.icao_code || '',
  route: data?.general?.route || data?.route || '',
  cruiseAltitude: data?.general?.initial_altitude || '',
  source: 'SimBrief',
});

const normalizeWhazzupPlan = (pilot) => {
  const flightPlan = pilot?.flight_plan || {};
  return {
    callsign: pilot?.callsign || '',
    aircraft: flightPlan.aircraft || '',
    origin: flightPlan.departure || '',
    destination: flightPlan.arrival || '',
    alternate: flightPlan.alternate || '',
    route: flightPlan.route || '',
    cruiseAltitude: flightPlan.altitude || '',
    source: 'Whazzup',
  };
};

export default function FlightPlanPanel({
  plan,
  user,
  preferences,
  onPlanChange,
  onPreferenceChange,
  onOpenAirport,
}) {
  const [simBriefOpen, setSimBriefOpen] = useState(false);
  const [simBriefUsername, setSimBriefUsername] = useState(preferences.simbriefUsername || '');

  const importSimBrief = async () => {
    const username = (simBriefUsername || preferences.simbriefUsername || '').trim();
    if (!username) {
      setSimBriefOpen(true);
      return;
    }
    const hide = message.loading('Importing SimBrief flight plan...', 0);
    try {
      const data = await fetchSimBrief(username);
      const nextPlan = normalizeSimBriefPlan(data);
      await onPlanChange(nextPlan);
      await onPreferenceChange({simbriefUsername: username});
      setSimBriefOpen(false);
      message.success('SimBrief flight plan imported');
    } catch (error) {
      message.error(error.message || 'SimBrief import failed');
    } finally {
      hide();
    }
  };

  const importWhazzup = async () => {
    const hide = message.loading('Reading whazzup flight plan...', 0);
    try {
      const data = await fetchWhazzup();
      const pilots = Array.isArray(data?.pilot) ? data.pilot : [];
      const own = pilots.find((pilot) => String(pilot.cid || pilot.callsign || '') === String(user?.preferred_username || user?.username || user?.sub || ''));
      if (!own?.flight_plan) {
        message.error('No submitted flight plan was found for your online user');
        return;
      }
      await onPlanChange(normalizeWhazzupPlan(own));
      message.success('Whazzup flight plan imported');
    } catch (error) {
      message.error(error.message || 'Whazzup import failed');
    } finally {
      hide();
    }
  };

  const actions = (
    <Dropdown
      menu={{
        items: [
          {key: 'simbrief', label: 'Import from SimBrief', onClick: importSimBrief},
          {key: 'whazzup', label: 'Import from Whazzup', onClick: importWhazzup},
        ],
      }}
    >
      <Button type="primary" icon={<CloudDownloadOutlined/>}>Import</Button>
    </Dropdown>
  );

  return (
      <div className="panel-content">
        <div className="panel-toolbar">{actions}</div>
        {!plan ? (
          <Empty
            description="No flight plan loaded"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          >
            {actions}
          </Empty>
        ) : (
          <Space direction="vertical" size="middle" style={{width: '100%'}}>
            <Descriptions size="small" column={1} bordered>
              <Descriptions.Item label="Source">{plan.source || '-'}</Descriptions.Item>
              <Descriptions.Item label="Callsign">{plan.callsign || '-'}</Descriptions.Item>
              <Descriptions.Item label="Aircraft">{plan.aircraft || '-'}</Descriptions.Item>
              <Descriptions.Item label="Origin">
                <Space>
                  <Text>{plan.origin || '-'}</Text>
                  {plan.origin && <Button size="small" onClick={() => onOpenAirport(plan.origin)}>Open</Button>}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="Destination">
                <Space>
                  <Text>{plan.destination || '-'}</Text>
                  {plan.destination && <Button size="small" onClick={() => onOpenAirport(plan.destination)}>Open</Button>}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="Alternate">{plan.alternate || '-'}</Descriptions.Item>
              <Descriptions.Item label="Cruise">{plan.cruiseAltitude || '-'}</Descriptions.Item>
            </Descriptions>
            <div>
              <Text type="secondary">Route</Text>
              <div className="route-string">{plan.route || '-'}</div>
            </div>
          </Space>
        )}
        <Modal
          title="SimBrief username"
          open={simBriefOpen}
          onCancel={() => setSimBriefOpen(false)}
          onOk={importSimBrief}
        >
          <Input
            value={simBriefUsername}
            onChange={(event) => setSimBriefUsername(event.target.value)}
            placeholder="SimBrief username"
          />
        </Modal>
      </div>
  );
}
