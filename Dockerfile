FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install --no-audit --no-fund

# Copy sources and build
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

EXPOSE 3000

CMD ["node", "dist/index.js", "--transport", "streamable-http", "--host", "0.0.0.0", "--port", "3000"]


