import { Injectable, inject } from '@angular/core';
import { MsalService } from '@azure/msal-angular';
import { AccountInfo } from '@azure/msal-browser';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly msal = inject(MsalService);

  get account(): AccountInfo | null {
    return this.msal.instance.getActiveAccount() ?? this.msal.instance.getAllAccounts()[0] ?? null;
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
    return Array.isArray(roles) ? roles.filter((role): role is string => typeof role === 'string') : [];
  }

  logout(): void {
    this.msal.logoutPopup({ account: this.account ?? undefined, mainWindowRedirectUri: window.location.origin });
  }
}
