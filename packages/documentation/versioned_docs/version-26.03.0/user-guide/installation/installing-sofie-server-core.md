---
sidebar_position: 35
---

# Installing Sofie Core

Our **[Quick install guide](quick-install.md)** provides a quick and easy way of deploying the various pieces of software needed for a production-quality deployment of Sofie using `docker compose`. This section provides some more insights for users choosing to install Sofie via alternative methods.

The preferred way to install Sofie Core for production is using Docker via our officially published images inside Docker Hub: [https://hub.docker.com/u/sofietv](https://hub.docker.com/u/sofietv). Note that some of the images mentioned in this documentation are community-maintained and as such are not published by the `sofietv` Docker Hub organization.

More advanced ways of deploying Sofie are possible and actively used by Sofie users, including [Podman](https://podman.io/), [Kubernetes](https://kubernetes.io/), [Salt](https://saltproject.io/), [Ansible](https://github.com/ansible/ansible) among others. Any deployment system that uses [OCI App Containers](https://opencontainers.org/) should be suitable.

Sofie and it's Blueprint system is specifically built around the concept of Infrastructure-as-Code and Configuration-as-Code and we strongly advise using that methodology in production, rather than the manual route of using the User Interface for configuration.

:::tip
While Sofie is using cloud-native technologies, it's workloads do not follow typical patterns seen in cloud software. When optimizing Sofie performance for production, make sure not to optimize for the amount of operations per second, but rather for fastest response time on a single request.
:::

## Basic structure

On a foundational level, Sofie Core is a [Meteor](https://docs.meteor.com/), [Node.js](https://nodejs.org/) web application that uses [MongoDB](https://www.mongodb.com) for its data persistence.

Both the Sofie Gateways and User Agents using the Web User Interface connect to it via DDP, a WebSocket-based, Meteor-specific protocol. This protocol is used both for RPC and shared state synchronization.
