
FROM dhi.io/node:25

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --omit=dev

COPY . .

CMD ["node", "index.js"]
