type AppConfig = {
  apiBaseUrl?: string;
};

const getRuntimeConfig = (): AppConfig | undefined => {
  if (typeof window === 'undefined') return undefined;
  // env.js (written at container start) sets window.__APP_CONFIG__
  return (window as unknown as { __APP_CONFIG__?: AppConfig }).__APP_CONFIG__;
};

export const API_BASE_URL =
  getRuntimeConfig()?.apiBaseUrl ??
  import.meta.env.VITE_API_URL ??
  'http://localhost:3001/api';
