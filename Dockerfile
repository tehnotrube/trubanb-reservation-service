FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force --ignore-scripts

FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

USER node

COPY --from=deps --chown=node:node --chmod=555 /app/node_modules ./node_modules
COPY --from=builder --chown=node:node --chmod=555 /app/dist ./dist
COPY --from=builder --chown=node:node --chmod=444 /app/package.json ./package.json

EXPOSE 3000

CMD ["node", "dist/main.js"]
