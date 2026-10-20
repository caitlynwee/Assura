FROM node:22-alpine
WORKDIR /app

# Install dependencies as a separate cached layer.
# Rebuild this layer only when package.json changes.
COPY package*.json ./
RUN npm ci

# Copy root-level config files (next.config, tsconfig, etc.).
# Source code (src/) and public/ are volume-mounted at runtime for hot reload.
COPY next.config.ts tsconfig.json eslint.config.mjs ./
COPY drizzle ./drizzle
COPY src ./src

EXPOSE 3000

# HOSTNAME tells Next.js to listen on all interfaces inside the container.
ENV HOSTNAME=0.0.0.0

CMD ["npm", "run", "dev"]
