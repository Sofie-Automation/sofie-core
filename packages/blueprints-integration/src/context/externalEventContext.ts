import type { IEventContext } from './index.js'
import type { IShowStyleUserContext } from './showStyleContext.js'
import type { IPartAndPieceActionContext } from './partsAndPieceActionContext.js'
import type { IExecuteTSRActionsContext, ITriggerIngestChangeContext } from './executeTsrActionContext.js'
import type { IRouteSetMethods } from './routeSetContext.js'
import type { IDataStoreMethods } from './adlibActionContext.js'
import type { IPlayoutActionContext } from './playoutActionContext.js'

/** Context provided to the blueprint's `onExternalEvent` handler. */
export interface IExternalEventContext
	extends
		IShowStyleUserContext,
		IEventContext,
		IDataStoreMethods,
		IPartAndPieceActionContext,
		IExecuteTSRActionsContext,
		ITriggerIngestChangeContext,
		IRouteSetMethods,
		IPlayoutActionContext {}
