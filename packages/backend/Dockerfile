FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/backend/package.json ./packages/backend/

RUN npm ci --workspace=packages/backend --ignore-scripts

COPY packages/backend ./packages/backend

RUN npm run build --workspace=packages/backend

# ---- Runtime ----
# Use slim (Debian/glibc) instead of Alpine so the claude CLI binary
# (compiled against glibc) executes correctly.
FROM node:22-slim
WORKDIR /app

# claude CLI refuses --dangerously-skip-permissions when running as root,
# so create a non-root user to own the app and run the process.
RUN groupadd --gid 1001 appuser && \
    useradd --uid 1001 --gid appuser --shell /bin/bash --create-home appuser

RUN npm install -g @anthropic-ai/claude-code

COPY --from=builder /app/packages/backend/dist ./dist
COPY --from=builder /app/packages/backend/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules

RUN chown -R appuser:appuser /app
USER appuser

ENV NODE_ENV=production
EXPOSE 3001

CMD ["node", "dist/index.js"]
