import {useEffect, useRef, useState} from 'react';
import {Empty, Input, List, Spin, Typography} from 'antd';
import {EnvironmentOutlined, SearchOutlined} from '@ant-design/icons';
import {navApi} from '../api';

const {Text} = Typography;

export default function GlobalSearch({onAirportSelect}) {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (!focused || query.trim().length < 2) {
      return undefined;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const data = await navApi.searchAirports(query.trim(), 10, controller.signal);
        setResults(data.airports || []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [focused, query]);

  useEffect(() => {
    const close = (event) => {
      if (!wrapperRef.current?.contains(event.target)) setFocused(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const showDropdown = focused && query.trim().length >= 2;

  return (
    <div className="global-search" ref={wrapperRef}>
      <Input
        size="large"
        allowClear
        prefix={<SearchOutlined/>}
        value={query}
        onFocus={() => setFocused(true)}
        onChange={(event) => {
          const value = event.target.value.toUpperCase();
          setQuery(value);
          if (value.trim().length < 2) setResults([]);
        }}
        placeholder="Search airport"
      />
      {showDropdown && (
        <div className="global-search__dropdown">
          {loading ? (
            <div className="global-search__loading"><Spin/></div>
          ) : results.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No results"/>
          ) : (
            <List
              size="small"
              dataSource={results}
              renderItem={(airport) => (
                <List.Item
                  className="global-search__item"
                  onMouseDown={() => {
                    onAirportSelect(airport);
                    setFocused(false);
                  }}
                >
                  <List.Item.Meta
                    avatar={<EnvironmentOutlined/>}
                    title={<span>{airport.icao}</span>}
                    description={<Text type="secondary">{airport.name}</Text>}
                  />
                  <Text type="secondary">{airport.type?.toUpperCase()}</Text>
                </List.Item>
              )}
            />
          )}
        </div>
      )}
    </div>
  );
}
