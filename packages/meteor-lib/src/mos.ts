import { getMosTypes } from '@mos-connection/helper'

export * as MOS from '@mos-connection/helper'

export const MOS_DATA_IS_STRICT = true
export const mosTypes = getMosTypes(MOS_DATA_IS_STRICT)
