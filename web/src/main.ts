import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import { createMsalInstance, provideEntraAuthentication } from './app/core/auth.providers';
import { validateEntraConfig } from './app/core/entra-config';

fetch('/config/entra-config.json', { cache: 'no-store' })
  .then(response => {
    if (!response.ok) throw new Error(`Unable to load Entra configuration (${response.status}).`);
    return response.json() as Promise<unknown>;
  })
  .then(validateEntraConfig)
  .then(async config => {
    const instance = createMsalInstance(config);
    await instance.initialize();

    return bootstrapApplication(AppComponent, {
      providers: [provideRouter(routes), provideEntraAuthentication(config, instance)]
    });
  })
  .catch(error => {
    console.error(error);
    const main = document.createElement('main');
    main.style.cssText = 'min-height:100vh;display:grid;place-items:center;padding:24px;box-sizing:border-box;background:#f5f8f8;color:#10212c;font-family:Arial,sans-serif';
    const message = document.createElement('div');
    message.style.cssText = 'max-width:720px;text-align:center';
    message.innerHTML = '<h1>Helvetic Ops 无法完成登录</h1>';
    const detail = document.createElement('p');
    detail.textContent = error instanceof Error ? error.message : String(error);
    message.append(detail);
    main.append(message);
    document.body.replaceChildren(main);
  });
