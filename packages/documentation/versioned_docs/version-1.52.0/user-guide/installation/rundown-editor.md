---
sidebar_position: 8
---

# Sofie Rundown Editor

Sofie Rundown Editor is a tool for creating and editing rundowns in a _demo_ environment of Sofie, without the use of an iNews, Spreadsheet or MOS Gateway

### Connecting Sofie Rundown Editor

After starting the Rundown Editor via the `docker-compose.yaml` specified in [Quick Start](./installing-sofie-server-core), this app requires a special bit of configuration to connect to Sofie. You need to open the Rundown Editor web interface at [http://localhost:3010/](http://localhost:3010/), go to _Settings_ and set _Core Connection Settings_ to:

| Property | Value  |
| -------- | ------ |
| Address  | `core` |
| Port     | `3000` |

The header should change to _Core Status: Connected to core:3000_.
