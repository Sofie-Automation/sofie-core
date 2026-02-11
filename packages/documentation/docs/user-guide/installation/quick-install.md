---
sidebar_position: 20
---

# Quick install

## Installing for testing \(or production\)

### **Prerequisites**

* **Linux**: Install [Docker](https://docs.docker.com/install/linux/docker-ce/ubuntu/) and [docker-compose](https://www.digitalocean.com/community/tutorials/how-to-install-docker-compose-on-ubuntu-18-04).
* **Windows**: Install [WSL](https://learn.microsoft.com/en-us/windows/wsl/install) and use an *Ubuntu* terminal to install Docker and docker-compose.

### Installation

This docker-compose file automates the basic setup of the [Sofie-Core application](../../for-developers/libraries.md#main-application), the backend database and different Gateway options.

```yaml
# This is NOT recommended to be used for a production deployment.
# It aims to quickly get an evaluation version of Sofie running and serve as a basis for how to set up a production deployment.
services:
  db:
    hostname: mongo
    image: mongo:6.0
    restart: always
    entrypoint: ['/usr/bin/mongod', '--replSet', 'rs0', '--bind_ip_all']
    # the healthcheck avoids the need to initiate the replica set
    healthcheck:
      test: test $$(mongosh --quiet --eval "try {rs.initiate()} catch(e) {rs.status().ok}") -eq 1
      interval: 10s
      start_period: 30s
    ports:
      - '27017:27017'
    volumes:
      - db-data:/data/db
    networks:
      - sofie

  # Fix Ownership Snapshots mount
  # Because docker volumes are owned by root by default
  # And our images follow best-practise and don't run as root
  change-vol-ownerships:
    image: node:22-alpine
    user: 'root'
    volumes:
      - sofie-store:/mnt/sofie-store
    entrypoint: ['sh', '-c', 'chown -R node:node /mnt/sofie-store']

  core:
    hostname: core
    image: sofietv/tv-automation-server-core:release52
    restart: always
    ports:
      - '3000:3000' # Same port as meteor uses by default
    environment:
      PORT: '3000'
      MONGO_URL: 'mongodb://db:27017/meteor'
      MONGO_OPLOG_URL: 'mongodb://db:27017/local'
      ROOT_URL: 'http://localhost:3000'
      SOFIE_STORE_PATH: '/mnt/sofie-store'
    networks:
      - sofie
    volumes:
      - sofie-store:/mnt/sofie-store
    depends_on:
      change-vol-ownerships:
        condition: service_completed_successfully
      db:
        condition: service_healthy

  playout-gateway:
    image: sofietv/tv-automation-playout-gateway:release52
    restart: always
    environment:
      DEVICE_ID: playoutGateway0
      CORE_HOST: core
      CORE_PORT: '3000'
    networks:
      - sofie
      - lan_access
    depends_on:
      - core

  # Choose one of the following images, depending on which type of ingest gateway is wanted.

  # spreadsheet-gateway:
  #   image: superflytv/sofie-spreadsheet-gateway:latest
  #   restart: always
  #   environment:
  #     DEVICE_ID: spreadsheetGateway0
  #     CORE_HOST: core
  #     CORE_PORT: '3000'
  #   networks:
  #     - sofie
  #   depends_on:
  #     - core

  # mos-gateway:
  #   image: sofietv/tv-automation-mos-gateway:release52
  #   restart: always
  #   ports:
  #     - "10540:10540" # MOS Lower port
  #     - "10541:10541" # MOS Upper port
  #     # - "10542:10542" # MOS query port - not used
  #   environment:
  #     DEVICE_ID: mosGateway0
  #     CORE_HOST: core
  #     CORE_PORT: '3000'
  #   networks:
  #     - sofie
  #   depends_on:
  #     - core

  # inews-gateway:
  #   image: tv2media/inews-ftp-gateway:1.37.0-in-testing.20
  #   restart: always
  #   command: yarn start -host core -port 3000 -id inewsGateway0
  #   networks:
  #     - sofie
  #   depends_on:
  #     - core

  # rundown-editor:
  #   image: ghcr.io/superflytv/sofie-automation-rundown-editor:v2.2.4
  #   restart: always
  #   ports:
  #   	- '3010:3010'
  #   environment:
  #     PORT: '3010'
  #   networks:
  #     - sofie
  #   depends_on:
  #     - core

networks:
  sofie:
  lan_access:
    driver: bridge

volumes:
  db-data:
  sofie-store:
```

Create a `Sofie` folder, copy the above content, and save it as `docker-compose.yaml` within the `Sofie` folder.

Visit [Rundowns & Newsroom Systems](installing-a-gateway/rundown-or-newsroom-system-connection/intro.md) to see which _Ingest Gateway_ can be used in your specific production environment. If you don't have an NRCS that you would like to integrate with, you can use the [Rundown Editor](rundown-editor) as a simple Rundown creation utility. Navigate to the _ingest-gateway_ section of `docker-compose.yaml` and select which type of _ingest-gateway_ you'd like installed by uncommenting it. Save your changes.

Open a terminal, execute `cd Sofie` and `sudo docker-compose up` \(or just `docker-compose up` on Windows\). This will download MongoDB and Sofie components' container images and start them up. The installation will be done when your terminal window will be filled with messages coming from `playout-gateway_1` and `core_1`.

Once the installation is done, Sofie should be running on [http://localhost:3000](http://localhost:3000). Next, you need to make sure that the Playout Gateway and Ingest Gateway are connected to the default Studio that has been automatically created. Open the Sofie User Interface with [Configuration Access level](../features/access-levels#browser-based) by opening [http://localhost:3000/?admin=1](http://localhost:3000/?admin=1) in your Web Browser and navigate to _Settings_&nbsp;🡒 _Studios_&nbsp;🡒 _Default Studio_&nbsp;🡒 _Peripheral Devices_. In the _Parent Devices_ section, create a new Device using the **+** button, rename the device to _Playout Gateway_ and select _Playout gateway_ from the _Peripheral Device_ drop-down menu. Repeat this process for your _Ingest Gateway_ or _Sofie Rundown Editor_.

:::note
Starting with Sofie version 1.52.0, `sofietv` container images will run as UID 1000.
:::

### Tips for running in production

There are some things not covered in this guide needed to run _Sofie_ in a production environment:

- Logging: Collect, store and track error messages. [Kibana](https://www.elastic.co/kibana) and [logstash](https://www.elastic.co/logstash) is one way to do it.
- NGINX: It is customary to put a load-balancer in front of _Sofie&nbsp;Core_.
- Memory and CPU usage monitoring.

## Installing for Development

Installation instructions for installing Sofie-Core or the various gateways are available in the README file in their respective GitHub repos.

Common prerequisites are [Node.js](https://nodejs.org/) and [Yarn](https://yarnpkg.com/).
Links to the repos are listed at [Applications & Libraries](../../for-developers/libraries.md).

[_Sofie&nbsp;Core_ GitHub Page for Developers](https://github.com/Sofie-Automation/sofie-core)
