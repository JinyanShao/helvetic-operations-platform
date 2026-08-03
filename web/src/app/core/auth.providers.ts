import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import {
  MSAL_GUARD_CONFIG,
  MSAL_INSTANCE,
  MSAL_INTERCEPTOR_CONFIG,
  MsalBroadcastService,
  MsalGuard,
  MsalGuardConfiguration,
  MsalInterceptor,
  MsalInterceptorConfiguration,
  MsalService
} from '@azure/msal-angular';
import { BrowserCacheLocation, InteractionType, PublicClientApplication } from '@azure/msal-browser';
import { ENTRA_CONFIG, EntraConfig } from './entra-config';
import { API_BASE_URL } from '../api/generated/work-orders-api';

export function provideEntraAuthentication(config: EntraConfig): EnvironmentProviders {
  const apiScope = `api://${config.apiClientId}/access_as_user`;
  const guardConfig: MsalGuardConfiguration = {
    interactionType: InteractionType.Popup,
    authRequest: { scopes: [apiScope] }
  };
  const interceptorConfig: MsalInterceptorConfiguration = {
    interactionType: InteractionType.Popup,
    protectedResourceMap: new Map([[`${config.apiBaseUrl}/*`, [apiScope]]]),
    strictMatching: true
  };

  return makeEnvironmentProviders([
    { provide: ENTRA_CONFIG, useValue: config },
    { provide: API_BASE_URL, useValue: config.apiBaseUrl },
    {
      provide: MSAL_INSTANCE,
      useValue: new PublicClientApplication({
        auth: {
          clientId: config.spaClientId,
          authority: `https://login.microsoftonline.com/${config.tenantId}`,
          redirectUri: window.location.origin,
          postLogoutRedirectUri: window.location.origin
        },
        cache: { cacheLocation: BrowserCacheLocation.SessionStorage }
      })
    },
    { provide: MSAL_GUARD_CONFIG, useValue: guardConfig },
    { provide: MSAL_INTERCEPTOR_CONFIG, useValue: interceptorConfig },
    { provide: HTTP_INTERCEPTORS, useClass: MsalInterceptor, multi: true },
    provideHttpClient(withInterceptorsFromDi()),
    MsalService,
    MsalGuard,
    MsalBroadcastService
  ]);
}
