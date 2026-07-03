import {AUTH_FRONTEND_URL, OAUTH_CLIENT_ID, OAUTH_SCOPE} from './config';
import {oauthApi} from './api';

const TOKEN_KEY = 'skylite_efb_oauth_token';
const VERIFIER_KEY = 'skylite_efb_pkce_verifier';
const STATE_KEY = 'skylite_efb_oauth_state';

const randomString = (length = 64) => {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
};

const base64Url = (buffer) => btoa(String.fromCharCode(...new Uint8Array(buffer)))
  .replace(/\+/g, '-')
  .replace(/\//g, '_')
  .replace(/=+$/, '');

export const getStoredToken = () => {
  const raw = localStorage.getItem(TOKEN_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    localStorage.removeItem(TOKEN_KEY);
    return null;
  }
};

export const storeToken = (token) => {
  const existing = getStoredToken();
  const stored = {
    access_token: token.access_token,
    refresh_token: token.refresh_token || existing?.refresh_token || null,
    expires_at: Date.now() + Math.max(Number(token.expires_in || 0) - 30, 0) * 1000,
  };
  localStorage.setItem(TOKEN_KEY, JSON.stringify(stored));
  return stored;
};

export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

export const isTokenExpired = () => {
  const token = getStoredToken();
  if (!token) return true;
  return !token.expires_at || token.expires_at <= Date.now();
};

let refreshPromise = null;

export const refreshAccessToken = async () => {
  if (refreshPromise) return refreshPromise;
  const token = getStoredToken();
  if (!token || !token.refresh_token) {
    return null;
  }
  refreshPromise = (async () => {
    try {
      const newToken = await oauthApi.token({
        grant_type: 'refresh_token',
        client_id: OAUTH_CLIENT_ID,
        refresh_token: token.refresh_token,
      });
      return storeToken(newToken);
    } catch {
      const current = getStoredToken();
      if (current && current.refresh_token === token.refresh_token) {
        clearToken();
      }
      return null;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
};

export const getValidAccessToken = async () => {
  const token = getStoredToken();
  if (!token) return null;
  if (token.expires_at && token.expires_at > Date.now()) {
    return token.access_token;
  }
  const refreshed = await refreshAccessToken();
  return refreshed ? refreshed.access_token : null;
};

export const startLogin = async () => {
  if (!OAUTH_CLIENT_ID) {
    throw new Error('VITE_OAUTH_CLIENT_ID is not configured');
  }
  const verifier = randomString(48);
  const challengeBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  const state = randomString(16);
  sessionStorage.setItem(VERIFIER_KEY, verifier);
  sessionStorage.setItem(STATE_KEY, state);

  const redirectUri = `${window.location.origin}${window.location.pathname}`;
  const url = new URL('/oauth/authorize', AUTH_FRONTEND_URL);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', OAUTH_CLIENT_ID);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('scope', OAUTH_SCOPE);
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', base64Url(challengeBuffer));
  url.searchParams.set('code_challenge_method', 'S256');
  window.location.href = url.toString();
};

export const completeLoginFromCallback = async () => {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  if (!code) return null;
  const state = params.get('state');
  if (state !== sessionStorage.getItem(STATE_KEY)) {
    throw new Error('OAuth state mismatch');
  }
  const verifier = sessionStorage.getItem(VERIFIER_KEY);
  if (!verifier) {
    throw new Error('Missing PKCE verifier');
  }
  const redirectUri = `${window.location.origin}${window.location.pathname}`;
  const token = await oauthApi.token({
    grant_type: 'authorization_code',
    client_id: OAUTH_CLIENT_ID,
    code,
    redirect_uri: redirectUri,
    code_verifier: verifier,
  });
  sessionStorage.removeItem(VERIFIER_KEY);
  sessionStorage.removeItem(STATE_KEY);
  window.history.replaceState({}, document.title, window.location.pathname);
  return storeToken(token);
};
