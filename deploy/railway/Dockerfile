FROM node:24.18.0-alpine@sha256:a0b9bf06e4e6193cf7a0f58816cc935ff8c2a908f81e6f1a95432d679c54fbfd

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY *.js *.json *.html *.css *.svg VERSION ./
COPY data ./data
COPY client ./client
COPY server ./server
COPY assets ./assets

ENV NODE_ENV=production HOST=0.0.0.0
USER node
CMD ["node", "server.js"]
