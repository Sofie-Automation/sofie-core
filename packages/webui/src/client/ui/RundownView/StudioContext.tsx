import type { UIStudio } from '@sofie-automation/corelib/src/dataModel/Studio'
import React from 'react'

type StudioFromContext = UIStudio | undefined

const StudioContext = React.createContext<StudioFromContext>(undefined)

export default StudioContext
