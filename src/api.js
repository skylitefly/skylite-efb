import {API_BASE_URL, NAVIGATION_API_BASE_URL, WEATHER_API_BASE_URL, WHAZZUP_URL} from './config';

const jsonRequest = async (baseUrl, path, options = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body ? {'Content-Type': 'application/json'} : {}),
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(data?.error_description || data?.error || data?.detail || `HTTP ${response.status}`);
  }
  return data;
};

export const navApi = {
  searchAirports: (query, limit = 12, signal) =>
    jsonRequest(NAVIGATION_API_BASE_URL, `/api/airports?query=${encodeURIComponent(query)}&limit=${limit}`, {signal}),
  getAirport: (icao) => jsonRequest(NAVIGATION_API_BASE_URL, `/api/airports/${encodeURIComponent(icao)}`),
  getAirportProcedures: (icao, type = 'all') =>
    jsonRequest(NAVIGATION_API_BASE_URL, `/api/airports/${encodeURIComponent(icao)}/procedures?type=${encodeURIComponent(type)}`),
  planRoute: (params) => {
    const search = new URLSearchParams(params);
    return jsonRequest(NAVIGATION_API_BASE_URL, `/api/routes/plan?${search.toString()}`);
  },
  parseRoute: (payload) =>
    jsonRequest(NAVIGATION_API_BASE_URL, '/api/routes/parse', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  navdataSearch: (query, {category = 'all', limit = 20, near, signal} = {}) => {
    const search = new URLSearchParams({query, category, limit: String(limit)});
    if (near) search.set('near', near);
    return jsonRequest(NAVIGATION_API_BASE_URL, `/api/navdata/search?${search.toString()}`, {signal});
  },
  navdataDetail: (category, key, {near} = {}) => {
    const search = new URLSearchParams();
    if (near) search.set('near', near);
    const suffix = search.toString() ? `?${search.toString()}` : '';
    return jsonRequest(
      NAVIGATION_API_BASE_URL,
      `/api/navdata/${encodeURIComponent(category)}/${encodeURIComponent(key)}${suffix}`,
    );
  },
  airwayDownstream: (airway, from) =>
    jsonRequest(
      NAVIGATION_API_BASE_URL,
      `/api/navdata/airway/${encodeURIComponent(airway)}/downstream?from=${encodeURIComponent(from)}`,
    ),
};

export const weatherApi = {
  getAirportWeather: (icao) => jsonRequest(WEATHER_API_BASE_URL, `/api/icao/${encodeURIComponent(icao)}/`),
};

export const chartsApi = {
  getCharts: (icao, provider = 'jeppesen') =>
    jsonRequest(API_BASE_URL, `/api/charts/${encodeURIComponent(icao)}/?version=STD&rules=IFR&provider=${provider}`),
};

export const oauthApi = {
  token: (payload) =>
    jsonRequest(API_BASE_URL, '/api/oauth/token/', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  userInfo: (accessToken) =>
    jsonRequest(API_BASE_URL, '/api/oauth/userinfo/', {
      headers: {Authorization: `Bearer ${accessToken}`},
    }),
  preferences: (accessToken) =>
    jsonRequest(API_BASE_URL, '/api/oauth/preferences/', {
      headers: {Authorization: `Bearer ${accessToken}`},
    }),
  patchPreferences: (accessToken, preferences) =>
    jsonRequest(API_BASE_URL, '/api/oauth/preferences/', {
      method: 'PATCH',
      headers: {Authorization: `Bearer ${accessToken}`},
      body: JSON.stringify({preferences}),
    }),
};

export const fetchWhazzup = () => {
  const separator = WHAZZUP_URL.includes('?') ? '&' : '?';
  return jsonRequest('', `${WHAZZUP_URL}${separator}_=${Date.now()}`);
};

export const fetchSimBrief = (username) =>
  jsonRequest('', `https://www.simbrief.com/api/xml.fetcher.php?username=${encodeURIComponent(username)}&json=1`);
