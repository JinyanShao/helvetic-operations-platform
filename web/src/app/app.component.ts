import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `
    @if (!ready()) {
      <main style="min-height:100vh;display:grid;place-items:center;padding:24px;background:#f5f8f8;color:#10212c;font-family:Arial,sans-serif;">
        <div style="max-width:520px;text-align:center">
          <h1 style="margin:0 0 12px;font-size:32px;">Signing you in…</h1>
          <p style="margin:0;color:#586a72;">Helvetic Ops is completing Microsoft Entra authentication.</p>
          @if (loginError()) { <p style="margin:18px 0 0;color:#b42318;word-break:break-word;">{{ loginError() }}</p> }
        </div>
      </main>
    } @else if (auth.isAuthenticated) {
      <router-outlet />
    } @else {
      <main style="min-height:100vh;display:grid;place-items:center;padding:24px;background:#f5f8f8;color:#10212c;font-family:Archivo,sans-serif;">
        <div style="max-width:520px;text-align:center">
          <h1 style="margin:0 0 12px;font-size:32px;">Signing you in…</h1>
          <p style="margin:0;color:#586a72;">Helvetic Ops is redirecting to Microsoft Entra for authentication.</p>
          @if (loginError()) {
            <p style="margin:18px 0 0;color:#b42318;word-break:break-word;">{{ loginError() }}</p>
          }
        </div>
      </main>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent implements OnInit {
  readonly auth = inject(AuthService);
  readonly ready = signal(false);
  readonly loginError = signal('');

  async ngOnInit(): Promise<void> {
    try {
      await this.auth.completeRedirect();
      this.ready.set(true);
      if (!this.auth.isAuthenticated) {
        this.auth.login();
      }
    } catch (error) {
      this.loginError.set(error instanceof Error ? error.message : String(error));
      this.ready.set(true);
    }
  }
}
