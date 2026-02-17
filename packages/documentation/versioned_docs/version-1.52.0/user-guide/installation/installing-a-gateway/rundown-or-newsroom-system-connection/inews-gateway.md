# iNEWS Gateway

The iNEWS Gateway communicates with an iNEWS system to ingest and remain in sync with a rundown.

### Installing iNEWS for Sofie

The iNEWS Gateway allows you to create rundowns from within iNEWS and sync them with the _Sofie&nbsp;Core_. The rundowns will update in real time and any changes made will be seen from within your Playout Timeline. 

The setup for the iNEWS Gateway is already in the Docker Compose file you downloaded earlier. Remove the _\#_ symbol from the start of the line labeled `image: tv2/inews-ftp-gateway:develop` and add a _\#_ to the other ingest gateway that was being used.

Although the iNEWS Gateway is available free of charge, an iNEWS license is not. Visit [Avid's website](https://www.avid.com/products/inews/how-to-buy) to find an iNEWS reseller that handles your geographic area.

