# syntax=docker/dockerfile:experimental
# Build context: the repository root

# BUILD IMAGE
FROM node:22
WORKDIR /opt/core

COPY . .

RUN corepack enable
RUN yarn install --immutable
RUN yarn run pinst --disable

# Build the libraries and the server
RUN NODE_OPTIONS="--max-old-space-size=4096" yarn build

# Build the webui
RUN yarn workspace @sofie-automation/webui build
# Drop the dev-only assets from the webui output, they are not served in a deployment
RUN rm -Rf /opt/core/packages/webui/dist/dev

# Everything is built by this point, so the build tooling does not need to ship in the image.
# Focusing on the server also keeps the workspaces it depends on.
RUN yarn workspaces focus --production @sofie-automation/sofie-core

# DEPLOY IMAGE
FROM node:22-alpine

RUN apk add --no-cache tzdata

COPY --from=0 /opt/core/package.json /opt/core/package.json
COPY --from=0 /opt/core/node_modules /opt/core/node_modules

# The server itself
COPY --from=0 /opt/core/packages/sofie-core /opt/core/packages/sofie-core
# The workspaces the server depends on. They resolve their dependencies out of /opt/core/node_modules
COPY --from=0 /opt/core/packages/blueprints-integration /opt/core/packages/blueprints-integration
COPY --from=0 /opt/core/packages/corelib /opt/core/packages/corelib
COPY --from=0 /opt/core/packages/job-worker /opt/core/packages/job-worker
COPY --from=0 /opt/core/packages/meteor-lib /opt/core/packages/meteor-lib
COPY --from=0 /opt/core/packages/shared-lib /opt/core/packages/shared-lib

COPY --from=0 /opt/core/packages/webui/dist /opt/core/webui
COPY packages/sofie-core/docker-entrypoint.sh /opt

# Where the koa server serves the webui from
ENV SOFIE_WEBUI_DIR=/opt/core/webui

WORKDIR /opt/core/packages/sofie-core
RUN chown -R 1000:1000 /opt/core
USER 1000
ENTRYPOINT ["/opt/docker-entrypoint.sh"]
