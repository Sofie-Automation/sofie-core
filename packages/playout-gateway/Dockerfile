# syntax=docker/dockerfile:experimental
# BUILD IMAGE
FROM node:22
WORKDIR /opt

COPY . .

RUN corepack enable
RUN yarn install --immutable
RUN yarn run pinst --disable
RUN yarn lerna run --scope \*\*/playout-gateway --include-dependencies --stream build
RUN yarn workspaces focus playout-gateway --production # purge dev-dependencies

# DEPLOY IMAGE
FROM node:22-alpine
RUN apk add --no-cache tzdata

COPY --from=0 /opt/package.json /opt/package.json
COPY --from=0 /opt/node_modules /opt/node_modules
COPY --from=0 /opt/playout-gateway /opt/playout-gateway
COPY --from=0 /opt/server-core-integration /opt/server-core-integration
COPY --from=0 /opt/shared-lib /opt/shared-lib

WORKDIR /opt/playout-gateway
RUN chown -R 1000:1000 /opt/playout-gateway
USER 1000
ENTRYPOINT ["node", "dist/index.js"]
