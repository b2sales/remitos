import { Configuration, LogLevel } from '@azure/msal-browser';

const TENANT_ID = 'bccd9a6a-3fc9-4a47-b812-132619718ed0';
const CLIENT_ID = '320bab40-6c04-46f7-9eef-001edf91aaab';

export const msalConfig: Configuration = {
  auth: {
    clientId: CLIENT_ID,
    authority: `https://login.microsoftonline.com/${TENANT_ID}`,
    redirectUri: window.location.origin,
    postLogoutRedirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: 'localStorage',
    storeAuthStateInCookie: false,
  },
  system: {
    loggerOptions: {
      logLevel: LogLevel.Warning,
      piiLoggingEnabled: false,
    },
  },
};

export const loginRequest = {
  scopes: [`api://${CLIENT_ID}/access_as_user`],
};

export const apiScope = `api://${CLIENT_ID}/access_as_user`;
