# Sofie: The Modern TV News Studio Automation System (MOS-Gateway)

An application for piping data between [**Sofie Server Core**](https://github.com/Sofie-Automation/sofie-core) and MOS devices using the [MOS Protocol](http://mosprotocol.com/) v2.8.4.

This application is a part of the [**Sofie** TV News Studio Automation System](https://github.com/Sofie-Automation/Sofie-TV-automation/).

## Usage

```
// Development:
yarn dev -host 127.0.0.1 -port 3000 -log "log.log"
// Production:
yarn start
```

**CLI arguments:**

| Argument | Description            | Environment variable |
| -------- | ---------------------- | -------------------- |
| -host    | Hostname or IP of Core | CORE_HOST            |
| -port    | Port of Core           | CORE_PORT            |
| -log     | Path to output log     | CORE_LOG             |

## Installation for dev

yarn

yarn build
