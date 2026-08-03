import { InjectionToken } from '@angular/core';

export interface EntraConfig {
  tenantId: string;
  spaClientId: string;
  apiClientId: string;
  apiBaseUrl: string;
}

export const ENTRA_CONFIG = new InjectionToken<EntraConfig>('ENTRA_CONFIG');

export function validateEntraConfig(value: unknown): EntraConfig {
  if (!isRecord(value)) throw new Error('Entra runtime configuration must be a JSON object.');

  const tenantId = requiredString(value, 'tenantId');
  const spaClientId = requiredString(value, 'spaClientId');
  const apiClientId = requiredString(value, 'apiClientId');
  const apiBaseUrl = new URL(requiredString(value, 'apiBaseUrl'), window.location.origin);

  const isLocalHttp = apiBaseUrl.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(apiBaseUrl.hostname);
  if (apiBaseUrl.protocol !== 'https:' && !isLocalHttp) {
    throw new Error('apiBaseUrl must use HTTPS except during local development.');
  }

  return {
    tenantId,
    spaClientId,
    apiClientId,
    apiBaseUrl: apiBaseUrl.href.replace(/\/$/, '')
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function requiredString(value: Record<string, unknown>, key: string): string {
  const candidate = value[key];
  if (typeof candidate !== 'string' || candidate.trim() === '' || candidate.includes('<')) {
    throw new Error(`Entra runtime configuration '${key}' is missing.`);
  }
  return candidate.trim();
}
