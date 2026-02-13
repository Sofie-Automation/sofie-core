---
sidebar_position: 11
---

# System Health

## Legacy healthcheck

There is a legacy `/health` endpoint used by NRK systems. Its use is being phased out and will eventually be replaced by the new prometheus endpoint.

## Prometheus

From version 1.49, there is a prometheus `/metrics` endpoint exposed from Sofie. The metrics exposed from here will increase over time as we find more data to collect.

Because Sofie is comprised of multiple worker-threads, each metric has a `threadName` label indicitating which it is from. In many cases this field will not matter, but it is useful for the default process metrics, and if your installation has multiple studios defined.

Each thread exposes some default nodejs process metrics. These are defined by the [`prom-client`](https://github.com/siimon/prom-client#default-metrics) library we are using, and are best described there.

The current Sofie metrics exposed are:

| name                                       | type    | description                                                        |
| ------------------------------------------ | ------- | ------------------------------------------------------------------ |
| sofie_meteor_ddp_connections_total         | Gauge   | Number of open ddp connections                                     |
| sofie_meteor_publication_subscribers_total | Gauge   | Number of subscribers on a Meteor publication (ignoring arguments) |
| sofie_meteor_jobqueue_queue_total          | Counter | Number of jobs put into each worker job queues                     |
| sofie_meteor_jobqueue_success              | Counter | Number of successful jobs from each worker                         |
| sofie_meteor_jobqueue_queue_errors         | Counter | Number of failed jobs from each worker                             |
