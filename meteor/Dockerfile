# syntax=docker/dockerfile:experimental

# BUILD WEBUI
FROM node:22
COPY packages /opt/core/packages
WORKDIR /opt/core/packages

RUN rm -R *-gateway documentation openapi
RUN corepack enable
RUN yarn install && yarn build

# Install production dependencies for the worker
# HACK: 
# RUN yarn workspaces focus --production @sofie-automation/job-worker @sofie-automation/corelib

# BUILD IMAGE
FROM node:22
RUN curl "https://install.meteor.com/?release=3.1.2" | sh

# Temporary change the NODE_ENV env variable, so that all libraries are installed:
ENV NODE_ENV_TMP $NODE_ENV
ENV NODE_ENV anythingButProduction

# Prepare the packages
COPY package.json /opt/core/package.json
COPY --from=0 /opt/core/packages /opt/core/packages

# Add the meteor source
COPY meteor /opt/core/meteor
COPY scripts /opt/core/scripts
WORKDIR /opt/core/meteor

# remove the dev only assets from the webui output
RUN rm -Rf /opt/core/packages/webui/dist/dev
# move the webui to the correct place
RUN rm -Rf /opt/core/meteor/public
RUN cp -R /opt/core/packages/webui/dist /opt/core/meteor/public
RUN rm -R /opt/core/packages/webui

# Force meteor to setup the runtime
RUN meteor --version --allow-superuser
RUN corepack enable
RUN yarn install

# Restore the NODE_ENV variable:
ENV NODE_ENV $NODE_ENV_TMP
RUN --mount=type=cache,target=/opt/core/meteor/.meteor/local NODE_OPTIONS="--max-old-space-size=4096" METEOR_DEBUG_BUILD=1 meteor build --allow-superuser --directory /opt/
WORKDIR /opt/bundle/programs/server/
RUN npm install

# meteor does something weird with these files
RUN mv /opt/bundle/programs/web.browser/assets /opt/bundle/programs/web.browser/app/assets || true

# DEPLOY IMAGE
FROM node:22-alpine

RUN apk add --no-cache tzdata

COPY --from=1 /opt/bundle /opt/core
COPY meteor/docker-entrypoint.sh /opt

WORKDIR /opt/core/
RUN chown -R 1000:1000 /opt/core
USER 1000
ENTRYPOINT ["/opt/docker-entrypoint.sh"]
