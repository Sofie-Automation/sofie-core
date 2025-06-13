import type { TimelineObjectAbSessionInfo } from '@sofie-automation/shared-lib/dist/core/model/Timeline'
import type { ICommonContext } from './context/index.js'
import type { OnGenerateTimelineObj, TSR } from './timeline.js'
import type { AbPlayerId } from '@sofie-automation/shared-lib/dist/core/model/StudioRouteSet'

export type { AbPlayerId }

export interface PieceAbSessionInfo extends TimelineObjectAbSessionInfo {
	/**
	 * If true, this assignment will be given low priority
	 */
	optional?: boolean
}

/**
 * A token to identify sessions that need an assignment, but won't be able to provide a unique id.
 * Instead, when this token is encountered, the id of the pieceInstance will be used instead of the name of the session.
 * Note: This doesnt play nice with transitions, so if they are required, then auto cannot be used
 */
export const AB_MEDIA_PLAYER_AUTO = '__auto__'

/**
 * Description of a player in an AB pool
 */
export interface ABPlayerDefinition {
	playerId: AbPlayerId
}

/**
 * A rule describing how to update the `layer` of a TimelineObject for AB playback
 */
export interface ABTimelineLayerChangeRule {
	/** What AB pools can this rule be used for */
	acceptedPoolNames: string[]
	/** A function to generate the new layer name for a chosen playerId */
	newLayerName: (playerId: AbPlayerId) => string
	/** Whether this rule can be used for lookaheadObjects */
	allowsLookahead: boolean
}

/**
 * A set of rules describing how to update the `layer` of a TimelineObject for AB playback
 */
export type ABTimelineLayerChangeRules = {
	[fromLayer: string]: ABTimelineLayerChangeRule | undefined
}

/**
 * Configuration of the AB playback functionality provided by Sofie
 */
export interface ABResolverConfiguration {
	/** Options for the resolver */
	resolverOptions: ABResolverOptions
	/** The AB pools that should be processed, and the playerIds in each pool */
	pools: Record<string, ABPlayerDefinition[]>
	/** A set of rules describing how to update the `layer` of a TimelineObject for AB playback */
	timelineObjectLayerChangeRules?: ABTimelineLayerChangeRules
	/**
	 * A callback for blueprints to be able to apply the assignment to an object in blueprint specific ways.
	 * This is run after both the keyframe and `timelineObjectLayerChangeRules` strategies have been run.
	 * Return true to indicate that a change was successfully made to the object
	 */
	customApplyToObject?: (
		context: ICommonContext,
		poolName: string,
		playerId: AbPlayerId,
		timelineObject: OnGenerateTimelineObj<TSR.TSRTimelineContent>
	) => boolean
}

export interface ABResolverOptions {
	/**
	 * Ideal gap between playbacks for the player to be considered a good match
	 */
	idealGapBefore: number
	/**
	 * Duration to consider as now, to ensure playout-gateway has enough time to receive and re-resolve
	 */
	nowWindow: number
}
