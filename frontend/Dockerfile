FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Cap Node heap to 384 MB so Vite doesn't silently OOM-kill on a 1 GB EC2 instance.
# Vite uses esbuild internally which is already memory-efficient; the limit
# forces aggressive GC instead of unbounded growth → build completes, just slower.
RUN NODE_OPTIONS="--max-old-space-size=384" npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
# Copy as template — BACKEND_URL is substituted at container startup
COPY nginx.conf /etc/nginx/conf.d/default.conf.template
EXPOSE 80
# envsubst replaces ${BACKEND_URL} only, leaving nginx vars ($uri, $host, etc.) untouched
CMD ["/bin/sh", "-c", "envsubst '${BACKEND_URL}' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
