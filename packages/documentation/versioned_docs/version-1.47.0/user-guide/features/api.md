# API

## REST API

There is a preliminary REST API available that can be used to fetch data and trigger actions.

The documentation is minimal at the moment, but the API endpoints are listed by _Sofie&nbsp;Core_ using the endpoint: `/api/0`

## DDP – Core Integration

If you're planning to build NodeJS applications that talk to _Sofie&nbsp;Core_, we recommend using the [core-integration](https://github.com/nrkno/sofie-core/tree/master/packages/server-core-integration.md) library, which exposes a number of callable methods and allows for subscribing to data the same way the [Gateways](../concepts-and-architecture.md#gateways) do it.
