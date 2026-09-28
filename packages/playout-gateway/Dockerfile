# syntax=docker/dockerfile:experimental
# Build context: the repository root

# BUILD IMAGE
FROM node:22
WORKDIR /opt

COPY . .

RUN corepack enable
RUN yarn install --immutable
RUN yarn run pinst --disable
RUN yarn build:single packages/playout-gateway/tsconfig.build.json
RUN yarn workspaces focus playout-gateway --production # purge dev-dependencies

# DEPLOY IMAGE
FROM node:22-alpine
RUN apk add --no-cache tzdata

ENV NODE_ENV=production

COPY --from=0 /opt/package.json /opt/package.json
COPY --from=0 /opt/node_modules /opt/node_modules
COPY --from=0 /opt/packages/playout-gateway /opt/packages/playout-gateway
COPY --from=0 /opt/packages/server-core-integration /opt/packages/server-core-integration
COPY --from=0 /opt/packages/shared-lib /opt/packages/shared-lib

WORKDIR /opt/packages/playout-gateway
RUN chown -R 1000:1000 /opt/packages/playout-gateway
USER 1000
ENTRYPOINT ["node", "dist/index.js"]
