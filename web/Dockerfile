FROM node:26-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/helvetic-ops/browser /usr/share/nginx/html
COPY entra-config.json.template /etc/nginx/templates/entra-config.json.template
ENV NGINX_ENVSUBST_OUTPUT_DIR=/usr/share/nginx/html/config
RUN mkdir -p /usr/share/nginx/html/config
EXPOSE 80
