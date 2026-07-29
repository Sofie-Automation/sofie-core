#!/bin/sh

# Run in production mode, unless it has been overridden
export NODE_ENV="${NODE_ENV:-production}"



# Start meteor
cd /opt/core
node dist/main.js
