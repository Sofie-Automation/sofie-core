# iNEWS Gateway

The iNEWS Gateway communicates with an iNEWS system to ingest and remain in sync with a rundown.

### Installing iNEWS for Sofie

The iNEWS Gateway allows you to create rundowns from within iNEWS and sync them with the _Sofie&nbsp;Core_. The rundowns will update in real time and any changes made will be seen from within your Playout Timeline.

An example setup for the iNEWS Gateway is included in the example Docker Compose file found in the [Quick install](../../installing-sofie-server-core.md) with the `inews-gateway` profile.

You can activate the profile by setting `COMPOSE_PROFILES=inews-gateway` as an environment variable or by writing that to a file called `.env` in the same folder as the docker-compose file. For more information, see the [docker documentation on Compose profiles](https://docs.docker.com/compose/how-tos/profiles/).

If you are not using the example docker-compose, please follow the [instructions listed on the GitHub page](https://github.com/tv2/inews-ftp-gateway).

Although the iNEWS Gateway is available free of charge, an iNEWS license is not. Visit [Avid's website](https://www.avid.com/solutions/news-production) to find an iNEWS reseller that handles your geographic area.
