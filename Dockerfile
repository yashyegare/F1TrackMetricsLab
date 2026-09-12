# --- Build stage ---------------------------------------------------------
# Matches the Node version this repo's own CI builds against
# (.github/workflows/ci.yml matrix uses 20 and 22; the dedicated build job
# pins 22).
FROM node:22-alpine AS build

WORKDIR /app

# Install deps first so this layer is cached unless package*.json changes.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# Now bring in the rest of the source and build the static bundle.
COPY . .
RUN npm run build

# --- Serve stage ---------------------------------------------------------
# nginx:alpine is small, and all this app needs is a static file server.
FROM nginx:1.27-alpine AS serve

# The official nginx image auto-runs envsubst on /etc/nginx/templates/*.template
# at container startup, writing the result into /etc/nginx/conf.d/ before nginx
# starts. That is how `listen ${PORT}` in nginx.conf gets the port Cloud Run
# assigns at runtime — PORT=8080 below is only the local/dev fallback.
ENV PORT=8080
COPY nginx.conf /etc/nginx/templates/default.conf.template

# Vite outputs to dist/ per vite.config.js.
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080
# Base image's default ENTRYPOINT handles envsubst + `nginx -g "daemon off;"`.
