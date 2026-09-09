# node-rdkafka is a native addon (compiled against librdkafka via node-gyp), so the
# builder stage needs a full C/C++ toolchain — the runtime stage does NOT: it copies
# the already-compiled node_modules from here instead of re-running npm install
# (which would need the same toolchain again) and only needs the shared libs the
# compiled addon links against at runtime (see below). `bash` is required too —
# librdkafka's vendored `configure` script is a bash script, and Alpine's default
# /bin/sh (busybox ash) can't run it ("env: can't execute 'bash'").
FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache python3 make g++ linux-headers openssl-dev zlib-dev libc6-compat bash
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build
RUN npm prune --omit=dev

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Runtime-only shared libs the compiled node-rdkafka addon needs (no compiler here).
RUN apk add --no-cache libstdc++ openssl
COPY package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

EXPOSE 4001
CMD ["node", "dist/server.js"]
