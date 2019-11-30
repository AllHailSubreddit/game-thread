FROM node:12.12.0-alpine
WORKDIR /opt/app
ENV NODE_ENV production
COPY package*.json ./
RUN npm ci --only=production
COPY --chown=node:node check.js process.js ./
COPY --chown=node:node lib lib/
USER node
