import React from 'react'
import { UIStudio } from '@sofie-automation/meteor-lib/dist/api/studios'

type StudioFromContext = UIStudio | undefined

const StudioContext = React.createContext<StudioFromContext>(undefined)

export default StudioContext
