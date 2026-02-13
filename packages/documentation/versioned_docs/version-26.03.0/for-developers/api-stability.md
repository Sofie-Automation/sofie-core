---
title: API Stability
sidebar_position: 11
---

Sofie has various APIs for talking between components, and for external systems to interact with.

We classify each api into one of two categories:

## Stable

This is a collection of APIs which we intend to avoid introducing any breaking change to unless necessary. This is so external systems can rely on this API without needing to be updated in lockstep with Sofie, and hopefully will make sense to developers who are not familiar with Sofie's inner workings.

In version 1.50, a new REST API was introduced. This can be found at `/api/v1.0`, and is designed to allow an external system to interact with Sofie using simplified abstractions of Sofie internals.

The _Live Status Gateway_ is also part of this stable API, intended to allow for reactively retrieving data from Sofie. Internally it is translating the internal APIs into a stable version.

:::note
You can find the _Live Status Gateway_ in the `packages` folder of the [Sofie Core](https://github.com/Sofie-Automation/sofie-core) repository.
:::

## Internal

This covers everything we expose over DDP, the `/api/0` endpoint and any other http endpoints.

These are intended for use between components of Sofie, which should be updated together. The DDP api does have breaking changes in most releases. We use the `server-core-integration` library to manage these typings, and to ensure that compatible versions are used together.
