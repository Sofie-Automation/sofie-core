# Sofie: The Modern TV News Studio Automation System (Shared Lib)

[![npm](https://img.shields.io/npm/v/@sofie-automation/shared-lib)](https://www.npmjs.com/package/@sofie-automation/shared-lib)

This library is used as part of [**Sofie Server Core**](https://github.com/Sofie-Automation/sofie-core).

This is a part of the [**Sofie** TV News Studio Automation System](https://github.com/Sofie-Automation/Sofie-TV-automation/).

Note: This library should normally not be used directly, it should be used via one of:

- [![npm](https://img.shields.io/npm/v/@sofie-automation/blueprints-integration)](https://www.npmjs.com/package/@sofie-automation/blueprints-integration)
- [![npm](https://img.shields.io/npm/v/@sofie-automation/server-core-integration)](https://www.npmjs.com/package/@sofie-automation/server-core-integration)

If you find yourself importing something from this package which isn't re-exported by one of the above, then either someone forgot to export it or you shouldn't be using it.

## Purpose

This library is a collection of shared typings used across various of the components that make up Sofie. Any typings or small utilities that are needed by multiple of the components can go in here.
Eventually this will likely be split up into multiple more targeted libraries, once there is a compelling reason to do the split.

Because of the wide use of this library, it is important that it does not get any large dependencies added. Small typings only packages such as `timeline-state-resolver-types` and `@mos-connection/model` are acceptable as they are needed for the api definitions, and are concise as only typings.
Their dependencies are also kept light using only `tslib` and optionally `type-fest`, which we use in most places already.
