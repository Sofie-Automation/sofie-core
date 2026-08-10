---
sidebar_position: 10
---

# API

## Sofie User Actions REST API

Starting with version 1.50.0, there is a semantically-versioned HTTP REST API defined using the [OpenAPI specification](https://spec.openapis.org/oas/v3.0.3) that exposes some of the functionality available through the GUI in a machine-readable fashion. The API specification can be found in the `packages/openapi` folder. The latest version of this API is available in _Sofie&nbsp;Core_ using the endpoint: `/api/1.0`. There should be no assumption of backwards-compatibility for this API, but this API will be semantically-versioned, with redirects set up for minor-version changes for compatibility.

There is a also a legacy REST API available that can be used to fetch data and trigger actions. The documentation for this API is minimal, but the API endpoints are listed by _Sofie&nbsp;Core_ using the endpoint: `/api/0`

## Sofie Live Status Gateway

Starting with version 1.50.0, there is also a separate service available, called _Sofie Live Status Gateway_, running as a separate process, which will connect to the _Sofie Core_ as a Peripheral Device, listen to the changes of it's state and provide a PubSub service offering a machine-readable view into the system. The WebSocket API is defined using the [AsyncAPI specification](https://v2.asyncapi.com/docs/reference/specification/v2.5.0) and the specification can be found in the `packages/live-status-gateway/api` folder.

## DDP – Core Integration

If you're planning to build NodeJS applications that talk to _Sofie&nbsp;Core_, we recommend using the [core-integration](https://github.com/Sofie-Automation/sofie-core/tree/main/packages/server-core-integration.md) library, which exposes a number of callable methods and allows for subscribing to data the same way the [Gateways](../concepts-and-architecture.md#gateways) do it.
