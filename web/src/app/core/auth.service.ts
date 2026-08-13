import { Injectable, inject } from '@angular/core';
import { MsalService } from '@azure/msal-angular';
import { AccountInfo } from '@azure/msal-browser';
import { firstValueFrom } from 'rxjs';
import { ENTRA_CONFIG } from './entra-config';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly msal = inject(MsalService);
  private readonly config = inject(ENTRA_CONFIG);
  private accessTokenRoles: string[] = [];

  get account(): AccountInfo | null {
    return this.msal.instance.getActiveAccount() ?? this.msal.instance.getAllAccounts()[0] ?? null;
  }

  get isAuthenticated(): boolean {
    return this.account !== null;
  }

  get displayName(): string {
    return this.account?.name ?? this.account?.username ?? 'Signed-in operator';
  }

  get initials(): string {
    const parts = this.displayName.split(/\s+/).filter(Boolean);
    return parts.slice(0, 2).map(part => part[0]?.toUpperCase()).join('') || 'OP';
  }

  get roles(): string[] {
    const roles = this.account?.idTokenClaims?.['roles'];
    if (this.accessTokenRoles.length) return this.accessTokenRoles;
    return Array.isArray(roles) ? roles.filter((role): role is string => typeof role === 'string') : [];
  }

  async completeRedirect(): Promise<void> {
    const result = await firstValueFrom(this.msal.handleRedirectObservable());
    const account = result?.account ?? this.msal.instance.getActiveAccount() ?? this.msal.instance.getAllAccounts()[0] ?? null;
    if (account) this.msal.instance.setActiveAccount(account);
    await this.loadAccessTokenRoles(account);

    if (window.location.hash.includes('code=') || window.location.hash.includes('error=')) {
      window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`);
    }
  }

  login(): void {
    this.msal.loginRedirect({
      scopes: [`api://${this.config.apiClientId}/access_as_user`]
    }).subscribe({
      error: error => console.error('Microsoft Entra redirect sign-in failed.', error)
    });
  }

  logout(): void {
    void this.msal.logoutRedirect({ account: this.account ?? undefined, postLogoutRedirectUri: window.location.origin });
  }

  private async loadAccessTokenRoles(account: AccountInfo | null): Promise<void> {
    if (!account) {
      this.accessTokenRoles = [];
      return;
    }

    try {
      const apiScope = `api://${this.config.apiClientId}/access_as_user`;
      const result = await this.msal.instance.acquireTokenSilent({ account, scopes: [apiScope] });
      const payload = parseJwtPayload(result.accessToken);
      const roles = payload?.['roles'];
      this.accessTokenRoles = Array.isArray(roles) ? roles.filter((role): role is string => typeof role === 'string') : [];
    } catch {
      this.accessTokenRoles = [];
    }
  }
}

function parseJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length < 2) return null;

  try {
    const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    return JSON.parse(atob(padded)) as Record<string, unknown>;
  } catch {
    return null;
  }
}
