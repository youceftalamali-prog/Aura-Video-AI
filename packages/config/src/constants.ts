export const APP_CONSTANTS = {
  NAME: 'Aura Video AI',
  VERSION: '0.1.0',
  API_PREFIX: '/api/v1',
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  ACCESS_TOKEN_COOKIE: 'aura_access_token',
  REFRESH_TOKEN_COOKIE: 'aura_refresh_token',
  SESSION_COOKIE: 'aura_session',
} as const;

export const CREDIT_COSTS = {
  VIDEO_HD: 10,
  VIDEO_4K: 25,
  TEMPLATE_PREMIUM: 5,
} as const;

export const STORAGE_PATHS = {
  PRODUCTS: 'products',
  ASSETS: 'assets',
  VIDEOS: 'videos',
  THUMBNAILS: 'thumbnails',
  AVATARS: 'avatars',
} as const;
