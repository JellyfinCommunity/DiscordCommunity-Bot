
FROM dhi.io/node:20


WORKDIR /app


COPY package*.json ./


RUN npm ci --omit=dev


COPY . .

CMD ["node", "index.js"]
