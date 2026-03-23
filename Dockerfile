# Lightweight Node image
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy source
COPY . .

# Expose default port
EXPOSE 3000

# Start server
CMD ["node", "index.js"]