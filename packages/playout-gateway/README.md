# Sofie: The Modern TV News Studio Automation System (Playout Gateway)

An application for piping data between the [Sofie Server Core](https://github.com/Sofie-Automation/sofie-core) and play-out devices (such as CasparCG Server, ATEM, Lawo, etc..)

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
| -id      | Device ID to use       | DEVICE_ID            |

## Installation for dev

- yarn
- yarn build
- yarn test
