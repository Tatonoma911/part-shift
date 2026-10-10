FROM node:22-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src/core ./src/core
COPY src/net/patch.ts src/net/protocol.ts ./src/net/
COPY src/data ./src/data
COPY server ./server
COPY tsconfig.json ./
ENV NODE_ENV=production
EXPOSE 2567
CMD ["npx", "tsx", "server/index.ts"]
