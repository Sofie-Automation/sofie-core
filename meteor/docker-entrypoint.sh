#!/bin/sh

# Run in production mode, unless it has been overridden
export NODE_ENV="${NODE_ENV:-production}"



# Start the server
cd /opt/core/meteor
node dist/main.js
