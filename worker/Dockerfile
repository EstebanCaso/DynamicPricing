FROM mcr.microsoft.com/playwright:v1.47.2-jammy
WORKDIR /app

# Install worker dependencies
COPY worker/package*.json ./
RUN npm ci --omit=dev

# Copy scripts and server source
COPY scripts ./scripts
COPY worker/server ./server

ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "server/index.js"]
