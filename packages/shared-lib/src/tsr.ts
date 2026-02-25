import * as TSR from 'timeline-state-resolver-types'
export { TSR }

// Dynamically import package.json to avoid import attributes error
const TSR_VERSION = require('timeline-state-resolver-types/package.json').version

// Below line should work in Node.js 18+ and with bundlers that support import attributes, and replace the above
// import { version as TSR_VERSION } from 'timeline-state-resolver-types/package.json' with { type: 'json' }

export { TSR_VERSION }
