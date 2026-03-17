import { ReactNode, useEffect, useState } from 'react';
import {
  MsalProvider,
  AuthenticatedTemplate,
  UnauthenticatedTemplate,
  useMsal,
} from '@azure/msal-react';
import {
  PublicClientApplication,
  EventType,
  type AuthenticationResult,
} from '@azure/msal-browser';
import { msalConfig, loginRequest } from '@/config/auth';
import LoginPage from '@/pages/LoginPage';
import { Box, CircularProgress } from '@mui/material';

const msalInstance = new PublicClientApplication(msalConfig);

function AuthGuard({ children }: { children: ReactNode }) {
  const { instance, inProgress } = useMsal();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    instance
      .handleRedirectPromise()
      .then(() => setIsReady(true))
      .catch(() => setIsReady(true));
  }, [instance]);

  if (!isReady || inProgress !== 'none') {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <>
      <AuthenticatedTemplate>{children}</AuthenticatedTemplate>
      <UnauthenticatedTemplate>
        <LoginPage onLogin={() => instance.loginRedirect(loginRequest)} />
      </UnauthenticatedTemplate>
    </>
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const callbackId = msalInstance.addEventCallback((event) => {
      if (
        event.eventType === EventType.LOGIN_SUCCESS &&
        event.payload
      ) {
        const result = event.payload as AuthenticationResult;
        msalInstance.setActiveAccount(result.account);
      }
    });
    return () => {
      if (callbackId) msalInstance.removeEventCallback(callbackId);
    };
  }, []);

  return (
    <MsalProvider instance={msalInstance}>
      <AuthGuard>{children}</AuthGuard>
    </MsalProvider>
  );
}

export { msalInstance };
