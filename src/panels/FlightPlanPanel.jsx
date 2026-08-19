import {useMemo, useState} from 'react';
import {Button, Descriptions, Input, List, Modal, Popconfirm, Space, Typography, message} from 'antd';
import {
  DeleteOutlined,
  EditOutlined,
  FolderOpenOutlined,
  PlusOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import {fetchSimBrief} from '../api';

const {Text} = Typography;

const MAX_SAVED_FLIGHT_PLANS = 50;

const EMPTY_FLIGHT_PLAN = {
  callsign: '',
  aircraft: '',
  origin: '',
  destination: '',
  alternate: '',
  route: '',
  cruiseAltitude: '',
  source: '',
};

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

const planSummary = (plan) => {
  const origin = plan?.origin || '----';
  const destination = plan?.destination || '----';
  const route = String(plan?.route || '').trim();
  return route ? `${origin} ${route} ${destination}` : `${origin} → ${destination}`;
};

const newPlanId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `plan-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export default function FlightPlanPanel({
  plan,
  preferences,
  selectedDeparture,
  selectedArrival,
  onPlanChange,
  onPreferenceChange,
  onOpenAirport,
}) {
  const [simBriefOpen, setSimBriefOpen] = useState(false);
  const [simBriefUsername, setSimBriefUsername] = useState(preferences.simbriefUsername || '');
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [loadOpen, setLoadOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState(null);
  const [renameValue, setRenameValue] = useState('');

  const savedPlans = useMemo(
    () => (Array.isArray(preferences.savedFlightPlans) ? preferences.savedFlightPlans : []),
    [preferences.savedFlightPlans],
  );

  const persistSavedPlans = async (nextPlans, successMessage) => {
    await onPreferenceChange({savedFlightPlans: nextPlans}, {successMessage});
  };

  const importSimBrief = async () => {
    const username = (simBriefUsername || preferences.simbriefUsername || '').trim();
    if (!username) {
      setSimBriefOpen(true);
      return;
    }
    const hide = message.loading('Importing SimBrief flight plan...', 0);
    try {
      const data = await fetchSimBrief(username);
      await onPlanChange(normalizeSimBriefPlan(data));
      await onPreferenceChange({simbriefUsername: username}, {silent: true});
      setSimBriefOpen(false);
      setLoadOpen(false);
      message.success('SimBrief flight plan imported');
    } catch (error) {
      message.error(error.message || 'SimBrief import failed');
    } finally {
      hide();
    }
  };

  const currentSnapshot = () => ({
    id: newPlanId(),
    name: '',
    savedAt: new Date().toISOString(),
    plan: {
      callsign: plan?.callsign || '',
      aircraft: plan?.aircraft || '',
      origin: plan?.origin || '',
      destination: plan?.destination || '',
      alternate: plan?.alternate || '',
      route: plan?.route || '',
      cruiseAltitude: plan?.cruiseAltitude || '',
      source: plan?.source || '',
    },
    selectedDeparture: selectedDeparture || null,
    selectedArrival: selectedArrival || null,
  });

  const suggestedSaveName = () => {
    const origin = plan?.origin || '';
    const destination = plan?.destination || '';
    if (origin && destination) return `${origin}-${destination}`;
    return '';
  };

  const saveCurrentPlan = async (name, {overwriteId} = {}) => {
    const trimmed = name.trim();
    if (!trimmed) {
      message.error('Please enter a name for this flight plan');
      return false;
    }
    const existing = savedPlans.find((item) => item.name.trim().toLowerCase() === trimmed.toLowerCase());
    if (existing && existing.id !== overwriteId) {
      Modal.confirm({
        title: 'Replace saved flight plan?',
        content: `A flight plan named "${existing.name}" already exists. Save over it?`,
        okText: 'Replace',
        onOk: () => saveCurrentPlan(trimmed, {overwriteId: existing.id}),
      });
      return false;
    }
    if (!overwriteId && savedPlans.length >= MAX_SAVED_FLIGHT_PLANS) {
      message.error(`You can save up to ${MAX_SAVED_FLIGHT_PLANS} flight plans. Delete one first.`);
      return false;
    }
    const snapshot = {...currentSnapshot(), name: trimmed};
    const nextPlans = overwriteId
      ? savedPlans.map((item) => (item.id === overwriteId ? {...snapshot, id: overwriteId} : item))
      : [snapshot, ...savedPlans];
    await persistSavedPlans(nextPlans, 'Flight plan saved');
    setSaveOpen(false);
    return true;
  };

  const loadSavedPlan = async (item) => {
    await onPlanChange(item.plan, {
      selectedDeparture: item.selectedDeparture || null,
      selectedArrival: item.selectedArrival || null,
    });
    setLoadOpen(false);
    message.success(`Loaded "${item.name}"`);
  };

  const deleteSavedPlan = async (item) => {
    await persistSavedPlans(
      savedPlans.filter((planItem) => planItem.id !== item.id),
      'Flight plan deleted',
    );
  };

  const renameSavedPlan = async () => {
    const trimmed = renameValue.trim();
    if (!renameTarget || !trimmed) {
      message.error('Please enter a name');
      return;
    }
    const conflict = savedPlans.find(
      (item) => item.id !== renameTarget.id && item.name.trim().toLowerCase() === trimmed.toLowerCase(),
    );
    if (conflict) {
      message.error('A flight plan with that name already exists');
      return;
    }
    await persistSavedPlans(
      savedPlans.map((item) => (
        item.id === renameTarget.id
          ? {...item, name: trimmed, savedAt: new Date().toISOString()}
          : item
      )),
      'Flight plan renamed',
    );
    setRenameTarget(null);
  };

  return (
    <div className="panel-content">
      <div className="panel-toolbar">
        <Space>
          <Button
            icon={<SaveOutlined/>}
            onClick={() => {
              setSaveName(suggestedSaveName());
              setSaveOpen(true);
            }}
          >
            Save
          </Button>
          <Button
            icon={<FolderOpenOutlined/>}
            title="Load Flightplan"
            aria-label="Load Flightplan"
            onClick={() => setLoadOpen(true)}
          />
          <Popconfirm
            title="Create a new empty flight plan? Unsaved changes will be lost."
            okText="Create"
            onConfirm={() => onPlanChange(EMPTY_FLIGHT_PLAN)}
          >
            <Button icon={<PlusOutlined/>} title="New flight plan" aria-label="New flight plan"/>
          </Popconfirm>
        </Space>
      </div>
      <Space direction="vertical" size="middle" style={{width: '100%'}}>
        <Descriptions size="small" column={1} bordered>
          <Descriptions.Item label="Source">{plan?.source || '-'}</Descriptions.Item>
          <Descriptions.Item label="Callsign">{plan?.callsign || '-'}</Descriptions.Item>
          <Descriptions.Item label="Aircraft">{plan?.aircraft || '-'}</Descriptions.Item>
          <Descriptions.Item label="Origin">
            <Space>
              <Text>{plan?.origin || '-'}</Text>
              {plan?.origin && <Button size="small" onClick={() => onOpenAirport(plan.origin)}>Open</Button>}
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="Destination">
            <Space>
              <Text>{plan?.destination || '-'}</Text>
              {plan?.destination && <Button size="small" onClick={() => onOpenAirport(plan.destination)}>Open</Button>}
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="Alternate">{plan?.alternate || '-'}</Descriptions.Item>
          <Descriptions.Item label="Cruise">{plan?.cruiseAltitude || '-'}</Descriptions.Item>
        </Descriptions>
        <div>
          <Text type="secondary">Route</Text>
          <div className="route-string">{plan?.route || '-'}</div>
        </div>
      </Space>
      <Modal
        title="Save flight plan"
        open={saveOpen}
        onCancel={() => setSaveOpen(false)}
        onOk={() => saveCurrentPlan(saveName)}
        okText="Save"
        destroyOnHidden
      >
        <Input
          autoFocus
          value={saveName}
          onChange={(event) => setSaveName(event.target.value)}
          placeholder="Name this flight plan"
          onPressEnter={() => saveCurrentPlan(saveName)}
        />
      </Modal>
      <Modal
        title="Load Flightplan"
        open={loadOpen}
        onCancel={() => setLoadOpen(false)}
        footer={null}
        destroyOnHidden
        width={420}
      >
        <List
          locale={{emptyText: 'No saved flight plans'}}
          dataSource={savedPlans}
          renderItem={(item) => (
            <List.Item
              className="selectable-list-item"
              onClick={() => loadSavedPlan(item)}
              actions={[
                <Button
                  key="rename"
                  type="text"
                  size="small"
                  icon={<EditOutlined/>}
                  onClick={(event) => {
                    event.stopPropagation();
                    setRenameTarget(item);
                    setRenameValue(item.name);
                  }}
                />,
                <Popconfirm
                  key="delete"
                  title="Delete this flight plan?"
                  okText="Delete"
                  onConfirm={(event) => {
                    event?.stopPropagation?.();
                    deleteSavedPlan(item);
                  }}
                  onCancel={(event) => event?.stopPropagation?.()}
                >
                  <Button
                    type="text"
                    size="small"
                    danger
                    icon={<DeleteOutlined/>}
                    onClick={(event) => event.stopPropagation()}
                  />
                </Popconfirm>,
              ]}
            >
              <List.Item.Meta
                title={item.name}
                description={(
                  <Space direction="vertical" size={0}>
                    <Text type="secondary" ellipsis>{planSummary(item.plan)}</Text>
                    <Text type="secondary">
                      {item.savedAt ? new Date(item.savedAt).toLocaleString() : ''}
                    </Text>
                  </Space>
                )}
              />
            </List.Item>
          )}
        />
        <div className="load-flightplan-footer">
          <Button onClick={importSimBrief}>Import from SimBrief</Button>
        </div>
      </Modal>
      <Modal
        title="Rename flight plan"
        open={Boolean(renameTarget)}
        onCancel={() => setRenameTarget(null)}
        onOk={renameSavedPlan}
        okText="Rename"
        destroyOnHidden
      >
        <Input
          autoFocus
          value={renameValue}
          onChange={(event) => setRenameValue(event.target.value)}
          onPressEnter={renameSavedPlan}
        />
      </Modal>
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
