# TSR Types

The TSR monorepo contains a types package called `timeline-state-resolver-types`. The intent behind this package is that you may want to generate a Timeline in a place where you don't want to import the TSR library for performance reasons. Blueprints are a good example of this since the webpack setup does not deal well with importing everything.

## What you should know about this

When the TSR is built the types for the Mappings, Options and Actions for your integration will be auto generated under `src/generated`. In addition to this you should describe the content property of the timeline objects in a file using interfaces. If you're adding a new integration also add it to the `DeviceType` enum as described in `index.ts`.
