# syntax=docker/dockerfile:experimental

# BUILD IMAGE
FROM node:22
WORKDIR /opt/core

COPY package.json /opt/core/package.json
COPY packages /opt/core/packages
COPY meteor /opt/core/meteor
COPY scripts /opt/core/scripts

RUN corepack enable

# Both projects must be installed before building: `packages`' build graph includes `meteor`, which
# resolves its dependencies out of meteor/node_modules
RUN cd packages && yarn install
RUN cd meteor && yarn install

# Build the libraries and the server. `packages`' build graph references ../meteor/tsconfig.build.json,
# so this emits meteor/dist too
RUN cd packages && NODE_OPTIONS="--max-old-space-size=4096" yarn build

# Build the webui
RUN cd packages/webui && yarn build
# Drop the dev-only assets from the webui output, they are not served in a deployment
RUN rm -Rf /opt/core/packages/webui/dist/dev

# Everything is built by this point, so the build tooling does not need to ship in the image
RUN cd packages && yarn workspaces focus --production \
	@sofie-automation/blueprints-integration \
	@sofie-automation/corelib \
	@sofie-automation/job-worker \
	@sofie-automation/meteor-lib \
	@sofie-automation/shared-lib
RUN cd meteor && yarn workspaces focus --production

# DEPLOY IMAGE
FROM node:22-alpine

RUN apk add --no-cache tzdata

# The server itself
COPY --from=0 /opt/core/meteor/package.json /opt/core/meteor/package.json
COPY --from=0 /opt/core/meteor/dist /opt/core/meteor/dist
COPY --from=0 /opt/core/meteor/node_modules /opt/core/meteor/node_modules

# The libraries the server links to through its `portal:` dependencies. They are symlinked from
# meteor/node_modules/@sofie-automation/*, so they have to stay siblings of `meteor`, and they resolve
# their own dependencies out of packages/node_modules, so that has to come along too.
COPY --from=0 /opt/core/packages/node_modules /opt/core/packages/node_modules
COPY --from=0 /opt/core/packages/blueprints-integration /opt/core/packages/blueprints-integration
COPY --from=0 /opt/core/packages/corelib /opt/core/packages/corelib
COPY --from=0 /opt/core/packages/job-worker /opt/core/packages/job-worker
COPY --from=0 /opt/core/packages/meteor-lib /opt/core/packages/meteor-lib
COPY --from=0 /opt/core/packages/shared-lib /opt/core/packages/shared-lib

COPY --from=0 /opt/core/packages/webui/dist /opt/core/webui
COPY meteor/docker-entrypoint.sh /opt

# Where the koa server serves the webui from
ENV SOFIE_WEBUI_DIR=/opt/core/webui

WORKDIR /opt/core/meteor
RUN chown -R 1000:1000 /opt/core
USER 1000
ENTRYPOINT ["/opt/docker-entrypoint.sh"]
