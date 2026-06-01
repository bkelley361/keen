FROM node:20-slim

WORKDIR /app

# Install dependencies
COPY package.json ./
RUN npm install --production=false

# Copy source and build
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Remove dev dependencies
RUN npm prune --production

CMD ["node", "dist/index.js"]
