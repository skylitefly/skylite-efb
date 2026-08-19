import {useEffect, useMemo, useState} from 'react';
import {Button, Input, List, Modal, Spin, Typography, message} from 'antd';
import {SearchOutlined} from '@ant-design/icons';
import {navApi} from '../api';

const {Text} = Typography;

const DCT = 'DCT';

const airwayIdents = (detail) => {
  const idents = [];
  (detail?.airways || []).forEach((item) => {
    const ident = item?.ident;
    if (ident && !idents.includes(ident)) idents.push(ident);
  });
  return idents.sort();
};

const matchesQuery = (value, query) => {
  if (!query) return true;
  return String(value || '').toUpperCase().includes(query);
};

export default function AddRouteLegModal({open, fromIdent, nearIcao, onCancel, onAdd}) {
  return (
    <Modal
      open={open}
      title={fromIdent ? `Add from ${fromIdent}` : 'Add'}
      onCancel={onCancel}
      footer={null}
      destroyOnHidden
      width={520}
    >
      {open && fromIdent ? (
        <AddRouteLegBody fromIdent={fromIdent} nearIcao={nearIcao} onAdd={onAdd}/>
      ) : null}
    </Modal>
  );
}

function AddRouteLegBody({fromIdent, nearIcao, onAdd}) {
  const [via, setVia] = useState(DCT);
  const [toIdent, setToIdent] = useState(null);
  const [viaQuery, setViaQuery] = useState('');
  const [toQuery, setToQuery] = useState('');
  const [airways, setAirways] = useState([]);
  const [airwayLoading, setAirwayLoading] = useState(true);
  const [downstream, setDownstream] = useState([]);
  const [downstreamLoading, setDownstreamLoading] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    if (!fromIdent) return undefined;
    let cancelled = false;
    const load = async () => {
      const tryDetail = async (category) => {
        try {
          return await navApi.navdataDetail(category, fromIdent, {near: nearIcao});
        } catch {
          return null;
        }
      };
      const waypoint = await tryDetail('waypoint');
      const navaid = waypoint ? null : await tryDetail('navaid');
      if (!cancelled) {
        setAirways(airwayIdents(waypoint || navaid || {}));
        setAirwayLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [fromIdent, nearIcao]);

  useEffect(() => {
    if (via === DCT || !fromIdent) return undefined;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setDownstreamLoading(true);
      navApi.airwayDownstream(via, fromIdent)
        .then((data) => {
          if (!cancelled) setDownstream(data.waypoints || []);
        })
        .catch((error) => {
          if (!cancelled) {
            setDownstream([]);
            message.error(error.message || 'Failed to load airway waypoints');
          }
        })
        .finally(() => {
          if (!cancelled) setDownstreamLoading(false);
        });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [fromIdent, via]);

  useEffect(() => {
    if (via !== DCT || toQuery.trim().length < 2) return undefined;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearchLoading(true);
      try {
        const query = toQuery.trim();
        const [waypoints, navaids] = await Promise.all([
          navApi.navdataSearch(query, {category: 'waypoint', limit: 20, near: nearIcao, signal: controller.signal}),
          navApi.navdataSearch(query, {category: 'navaid', limit: 20, near: nearIcao, signal: controller.signal}),
        ]);
        const merged = [];
        [...(waypoints.results || []), ...(navaids.results || [])].forEach((item) => {
          if (!item?.ident || merged.some((existing) => existing.ident === item.ident && existing.category === item.category)) {
            return;
          }
          merged.push(item);
        });
        setSearchResults(merged);
      } catch (error) {
        if (error.name !== 'AbortError') setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 180);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [nearIcao, toQuery, via]);

  const viaOptions = useMemo(() => {
    const query = viaQuery.trim().toUpperCase();
    return [DCT, ...airways].filter((item) => matchesQuery(item, query));
  }, [airways, viaQuery]);

  const toOptions = useMemo(() => {
    if (via === DCT) return searchResults;
    const query = toQuery.trim().toUpperCase();
    return downstream.filter((item) => matchesQuery(item.ident, query));
  }, [downstream, searchResults, toQuery, via]);

  const toPlaceholder = via === DCT
    ? 'Search a waypoint (min 2 characters)'
    : 'Filter waypoints';

  const toEmptyText = via === DCT
    ? (toQuery.trim().length < 2 ? 'Search to see waypoints' : 'No results')
    : 'No waypoints on this airway';

  return (
    <>
      <div className="procedure-columns add-leg-columns">
        <div className="add-leg-column">
          <Text strong>Via</Text>
          <Input
            allowClear
            prefix={<SearchOutlined/>}
            value={viaQuery}
            onChange={(event) => setViaQuery(event.target.value.toUpperCase())}
            placeholder="Filter airways"
          />
          <div className="add-leg-list">
            {airwayLoading ? <Spin/> : (
              <List
                size="small"
                dataSource={viaOptions}
                locale={{emptyText: 'No airways'}}
                renderItem={(item) => (
                  <List.Item
                    className={via === item ? 'selectable-list-item is-selected' : 'selectable-list-item'}
                    onClick={() => {
                      setVia(item);
                      setToIdent(null);
                      setToQuery('');
                      setSearchResults([]);
                      if (item === DCT) {
                        setDownstream([]);
                        setDownstreamLoading(false);
                      }
                    }}
                  >
                    {item}
                  </List.Item>
                )}
              />
            )}
          </div>
        </div>
        <div className="add-leg-column">
          <Text strong>To</Text>
          <Input
            allowClear
            prefix={<SearchOutlined/>}
            value={toQuery}
            onChange={(event) => {
              const value = event.target.value.toUpperCase();
              setToQuery(value);
              if (via === DCT) {
                setToIdent(null);
                if (value.trim().length < 2) setSearchResults([]);
              }
            }}
            placeholder={toPlaceholder}
          />
          <div className="add-leg-list">
            {(via === DCT ? searchLoading : downstreamLoading) ? <Spin/> : (
              <List
                size="small"
                dataSource={toOptions}
                locale={{emptyText: toEmptyText}}
                renderItem={(item) => {
                  const ident = item.ident || item;
                  return (
                    <List.Item
                      className={toIdent === ident ? 'selectable-list-item is-selected' : 'selectable-list-item'}
                      onClick={() => setToIdent(ident)}
                    >
                      <List.Item.Meta
                        title={ident}
                        description={item.name || item.navaid_type || (item.distance_nm != null ? `${item.distance_nm} NM` : '')}
                      />
                    </List.Item>
                  );
                }}
              />
            )}
          </div>
        </div>
      </div>
      <Button
        block
        type="primary"
        disabled={!via || !toIdent}
        onClick={() => onAdd({via, toIdent})}
      >
        Add to route
      </Button>
    </>
  );
}
