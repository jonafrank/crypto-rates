# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl1.1-compat || apk add --no-cache openssl
COPY package.json package-lock.json* yarn.lock* pnpm-lock.yaml* ./
RUN npm ci || yarn install || pnpm i
COPY tsconfig.json ./
COPY prisma ./prisma
COPY src ./src
RUN npx prisma generate || (npm run prisma:generate || true)
RUN npm run build

# Run stage
FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache openssl1.1-compat || apk add --no-cache openssl
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY package.json ./package.json
EXPOSE 3001
CMD ["npm", "start"]
