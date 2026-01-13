# syntax=docker/dockerfile:experimental
# BUILD IMAGE
FROM node:22
WORKDIR /opt

COPY package.json lerna.json yarn.lock tsconfig.json ./
COPY live-status-gateway live-status-gateway
COPY live-status-gateway-api live-status-gateway-api
COPY blueprints-integration blueprints-integration
COPY server-core-integration server-core-integration
COPY shared-lib shared-lib
COPY corelib corelib

RUN yarn install --check-files --frozen-lockfile
RUN yarn build
RUN yarn install --check-files --frozen-lockfile --production --force --ignore-scripts # purge dev-dependencies

# DEPLOY IMAGE
FROM node:22-alpine
RUN apk add --no-cache tzdata

COPY --from=0 /opt/package.json /opt/package.json
COPY --from=0 /opt/node_modules /opt/node_modules
COPY --from=0 /opt/live-status-gateway /opt/live-status-gateway
COPY --from=0 /opt/live-status-gateway-api /opt/live-status-gateway-api
COPY --from=0 /opt/blueprints-integration /opt/blueprints-integration
COPY --from=0 /opt/server-core-integration /opt/server-core-integration
COPY --from=0 /opt/shared-lib /opt/shared-lib
COPY --from=0 /opt/corelib /opt/corelib

WORKDIR /opt/live-status-gateway
RUN chown -R 1000:1000 /opt/live-status-gateway
USER 1000
ENTRYPOINT ["node", "dist/index.js"]
