FROM dhi.io/node:22-debian12-dev

WORKDIR /app

COPY package*.json ./

RUN npm ci --omit=dev

COPY . .

CMD ["node", "index.js"]
