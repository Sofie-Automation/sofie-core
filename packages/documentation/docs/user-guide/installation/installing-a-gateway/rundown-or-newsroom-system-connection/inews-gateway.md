# iNEWS Gateway

The iNEWS Gateway communicates with an iNEWS system to ingest and remain in sync with a rundown.

### Installing iNEWS for Sofie

The iNEWS Gateway allows you to create rundowns from within iNEWS and sync them with the _Sofie&nbsp;Core_. The rundowns will update in real time and any changes made will be seen from within your Playout Timeline.

An example setup for the iNEWS Gateway is included in the example Docker Compose file found in the [Quick install](../../installing-sofie-server-core.md), but commented out.

Remove the _\#_ symbol from the start of the lines beginning at `# inews-gateway:` and ending at the next blank line. Be careful not to change the indentation of the file.

Although the iNEWS Gateway is available free of charge, an iNEWS license is not. Visit [Avid's website](https://www.avid.com/solutions/news-production) to find an iNEWS reseller that handles your geographic area.
