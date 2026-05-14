import * as TSR from 'timeline-state-resolver-types'
export { TSR }

import tsrPkgInfo from 'timeline-state-resolver-types/package.json' with { type: 'json' }
export const TSR_VERSION: string = tsrPkgInfo.version
