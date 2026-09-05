FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist/helvetic-ops/browser /usr/share/nginx/html
COPY entra-config.json.template /etc/nginx/templates/entra-config.json.template
ENV API_UPSTREAM=http://api:8080
RUN mkdir -p /usr/share/nginx/html/config
EXPOSE 80
CMD ["/bin/sh", "-c", "envsubst '${API_UPSTREAM}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf && envsubst '${ENTRA_TENANT_ID} ${ENTRA_SPA_CLIENT_ID} ${ENTRA_API_CLIENT_ID} ${ENTRA_API_BASE_URL}' < /etc/nginx/templates/entra-config.json.template > /usr/share/nginx/html/config/entra-config.json && nginx -g 'daemon off;'"]
