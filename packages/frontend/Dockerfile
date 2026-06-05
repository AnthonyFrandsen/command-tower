FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/frontend/package.json ./packages/frontend/

RUN npm ci --workspace=packages/frontend --ignore-scripts

COPY packages/frontend ./packages/frontend

RUN npm run build --workspace=packages/frontend

# ---- Runtime ----
FROM nginx:alpine
COPY --from=builder /app/packages/frontend/dist /usr/share/nginx/html
COPY nginx/default.conf /etc/nginx/conf.d/default.conf

EXPOSE 8082
CMD ["nginx", "-g", "daemon off;"]
