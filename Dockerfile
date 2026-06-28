# Builder stage
FROM node:18 AS builder
WORKDIR /app

# Install production dependencies
COPY package.json ./
RUN npm install --production

# Copy source code (excluding node_modules via .dockerignore)
COPY . ./

# Runtime stage (minimal)
FROM node:18-slim
WORKDIR /app
# Copy only needed artifacts from builder
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/server.js ./
# Copy static assets (HTML, CSS, JS)
COPY --from=builder /app/*.html ./
# Copy remaining assets (CSS, JS, etc.)
COPY --from=builder /app/ ./
EXPOSE 8080
CMD ["node", "server.js"]
