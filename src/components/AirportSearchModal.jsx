import {useEffect, useState} from 'react';
import {Input, List, Modal, Spin, Typography} from 'antd';
import {EnvironmentOutlined, SearchOutlined} from '@ant-design/icons';
import {navApi} from '../api';

const {Text} = Typography;

export default function AirportSearchModal({open, title = 'Select Airport', onCancel, onSelect}) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);

  useEffect(() => {
    if (!open || query.trim().length < 2) {
      return undefined;
    }
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const data = await navApi.searchAirports(query.trim(), 20);
        setResults(data.airports || []);
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => window.clearTimeout(timer);
  }, [open, query]);

  return (
    <Modal open={open} title={title} onCancel={onCancel} footer={null} destroyOnHidden>
      <Input
        autoFocus
        allowClear
        prefix={<SearchOutlined/>}
        value={query}
        onChange={(event) => {
          const value = event.target.value.toUpperCase();
          setQuery(value);
          if (value.trim().length < 2) setResults([]);
        }}
        placeholder="ICAO or airport name"
      />
      <div style={{marginTop: 12, minHeight: 240}}>
        {loading ? <Spin/> : (
          <List
            dataSource={results}
            renderItem={(airport) => (
              <List.Item className="selectable-list-item" onClick={() => onSelect(airport)}>
                <List.Item.Meta
                  avatar={<EnvironmentOutlined/>}
                  title={airport.icao}
                  description={<Text type="secondary">{airport.name}</Text>}
                />
              </List.Item>
            )}
          />
        )}
      </div>
    </Modal>
  );
}
