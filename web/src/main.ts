import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import { provideEntraAuthentication } from './app/core/auth.providers';
import { validateEntraConfig } from './app/core/entra-config';

fetch('/config/entra-config.json', { cache: 'no-store' })
  .then(response => {
    if (!response.ok) throw new Error(`Unable to load Entra configuration (${response.status}).`);
    return response.json() as Promise<unknown>;
  })
  .then(validateEntraConfig)
  .then(config => bootstrapApplication(AppComponent, {
    providers: [provideRouter(routes), provideEntraAuthentication(config)]
  }))
  .catch(error => {
    console.error(error);
    const message = document.createElement('p');
    message.textContent = 'Authentication configuration is unavailable. See the local setup guide.';
    document.body.replaceChildren(message);
  });
