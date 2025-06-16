import { AB_MEDIA_PLAYER_AUTO } from '@sofie-automation/blueprints-integration'
import { PartId, PieceInstanceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { ABSessionInfo } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { OnGenerateTimelineObjExt } from '@sofie-automation/corelib/dist/dataModel/Timeline'
import { getRandomString, omit } from '@sofie-automation/corelib/dist/lib'
import { protectString, unpartialString, unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { TimelineObjectAbSessionInfo } from '@sofie-automation/shared-lib/dist/core/model/Timeline'
import { ReadonlyDeep } from 'type-fest'

interface ABSessionInfoExt extends ABSessionInfo {
	/** Whether to store this session on the playlist (ie, whether it is still valid) */
	keep?: boolean
}

/**
 * A helper class for generating unique and persistent AB-playback sessionIds
 */
export class AbSessionHelper {
	readonly #partInstances: ReadonlyDeep<Array<DBPartInstance>>

	readonly #knownSessions: ABSessionInfoExt[]

	constructor(partInstances: ReadonlyDeep<Array<DBPartInstance>>, knownSessions: ABSessionInfo[]) {
		this.#partInstances = partInstances
		this.#knownSessions = knownSessions
	}

	public get allKnownSessions(): ABSessionInfo[] {
		return this.#knownSessions.map((s) => omit(s, 'keep'))
	}

	public get knownSessions(): ABSessionInfo[] {
		return this.#knownSessions.filter((s) => s.keep).map((s) => omit(s, 'keep'))
	}

	/** Internal, for overriding in tests */
	getNewSessionId(): string {
		return getRandomString()
	}

	/**
	 * Get the full session id for an ab playback session with a globally unique sessionName
	 */
	getUniqueSessionId(session: TimelineObjectAbSessionInfo): string {
		const sessionName = `${session.poolName}_${session.sessionName}`

		const uniqueNameSession = this.#knownSessions.find((s) => s.isUniqueName && s.name === sessionName)
		if (uniqueNameSession) {
			uniqueNameSession.keep = true
			return uniqueNameSession.id
		}

		// Otherwise define a new session
		const sessionId = this.getNewSessionId()
		const newSession: ABSessionInfoExt = {
			id: sessionId,
			name: sessionName,
			isUniqueName: true,
			keep: true,
		}
		this.#knownSessions.push(newSession)
		return sessionId
	}

	/**
	 * Get the full session id for an ab playback session.
	 * Note: If sessionNameIsGloballyUnique is set, then the sessionName every reference will be treated as the same session,
	 * otherwise sessionName should be unique within the segment unless pieces want to share a session
	 */
	getPieceABSessionId(pieceInstance: ReadonlyDeep<PieceInstance>, session: TimelineObjectAbSessionInfo): string {
		if (session.sessionNameIsGloballyUnique) return this.getUniqueSessionId(session)

		return this.getPieceABSessionIdFromSessionName(
			pieceInstance,
			this.#validateSessionName(pieceInstance._id, session)
		)
	}

	/**
	 * Get the full session id for an ab playback session.
	 * Note: sessionName should be unique within the segment unless pieces want to share a session
	 * Future: This should be private, but is exposed as a deprecated method to blueprints
	 */
	getPieceABSessionIdFromSessionName(pieceInstance: ReadonlyDeep<PieceInstance>, sessionName: string): string {
		const partInstanceIndex = this.#partInstances.findIndex((p) => p._id === pieceInstance.partInstanceId)
		const partInstance = partInstanceIndex >= 0 ? this.#partInstances[partInstanceIndex] : undefined
		if (!partInstance) throw new Error('Unknown partInstanceId in call to getPieceABSessionId')

		const infiniteId = pieceInstance.infinite?.infiniteInstanceId
		const preserveSession = (session: ABSessionInfoExt): string => {
			session.keep = true
			session.infiniteInstanceId = unpartialString(infiniteId)
			delete session.lookaheadForPartId
			return session.id
		}

		// Sessions to consider are those with the same name
		const sessionsToConsider = this.#knownSessions.filter((s) => !s.isUniqueName && s.name === sessionName)

		// If this is an infinite continuation, then reuse that
		if (infiniteId) {
			const infiniteSession = sessionsToConsider.find((s) => s.infiniteInstanceId === infiniteId)
			if (infiniteSession) {
				return preserveSession(infiniteSession)
			}
		}

		// We only want to consider sessions already tagged to this partInstance
		const existingSession = sessionsToConsider.find((s) =>
			s.partInstanceIds?.includes(pieceInstance.partInstanceId)
		)
		if (existingSession) {
			return preserveSession(existingSession)
		}

		// Check if we can continue sessions from the part before, or if we should create new ones
		const canReuseFromPartInstanceBefore =
			partInstanceIndex > 0 && this.#partInstances[partInstanceIndex - 1].part._rank < partInstance.part._rank

		if (canReuseFromPartInstanceBefore) {
			// Try and find a session from the part before that we can use
			const previousPartInstanceId = this.#partInstances[partInstanceIndex - 1]._id
			const continuedSession = sessionsToConsider.find((s) => s.partInstanceIds?.includes(previousPartInstanceId))
			if (continuedSession) {
				continuedSession.partInstanceIds = [
					...(continuedSession.partInstanceIds || []),
					pieceInstance.partInstanceId,
				]
				return preserveSession(continuedSession)
			}
		}

		// Find an existing lookahead session to convert
		const partId = partInstance.part._id
		const lookaheadSession = sessionsToConsider.find((s) => s.lookaheadForPartId === partId)
		if (lookaheadSession) {
			lookaheadSession.partInstanceIds = [pieceInstance.partInstanceId]
			return preserveSession(lookaheadSession)
		}

		// Otherwise define a new session
		const sessionId = this.getNewSessionId()
		const newSession: ABSessionInfoExt = {
			id: sessionId,
			name: sessionName,
			isUniqueName: false,
			infiniteInstanceId: unpartialString(infiniteId),
			partInstanceIds: !infiniteId ? [pieceInstance.partInstanceId] : [],
			keep: true,
		}
		this.#knownSessions.push(newSession)
		return sessionId
	}

	/**
	 * Get the full session id for a timelineobject that belongs to an ab playback session
	 * The same session should also be used in calls for the owning piece
	 */
	getTimelineObjectAbSessionId(
		tlObj: OnGenerateTimelineObjExt,
		session: TimelineObjectAbSessionInfo
	): string | undefined {
		if (session.sessionNameIsGloballyUnique) return this.getUniqueSessionId(session)

		return this.getTimelineObjectAbSessionIdFromSessionName(
			tlObj,
			this.#validateSessionName(tlObj.pieceInstanceId || session.sessionName, session)
		)
	}

	/**
	 * Get the full session id for a timelineobject that belongs to an ab playback session
	 * sessionName should also be used in calls to getPieceABSessionId for the owning piece
	 * Future: This should be private, but is exposed as a deprecated method to blueprints
	 */
	getTimelineObjectAbSessionIdFromSessionName(
		tlObj: OnGenerateTimelineObjExt,
		sessionName: string
	): string | undefined {
		// Sessions to consider are those with the same name
		const sessionsToConsider = this.#knownSessions.filter((s) => !s.isUniqueName && s.name === sessionName)

		// Find an infinite
		const searchId = tlObj.infinitePieceInstanceId
		if (searchId) {
			const infiniteSession = sessionsToConsider.find((s) => s.infiniteInstanceId === searchId)
			if (infiniteSession) {
				infiniteSession.keep = true
				return infiniteSession.id
			}
		}

		// Find an normal partInstance
		const partInstanceId = tlObj.partInstanceId
		if (partInstanceId) {
			const partInstanceSession = sessionsToConsider.find((s) => s.partInstanceIds?.includes(partInstanceId))
			if (partInstanceSession) {
				partInstanceSession.keep = true
				return partInstanceSession.id
			}
		}

		// If it is lookahead, then we run differently
		let partId = protectString<PartId>(unprotectString(partInstanceId))
		if (tlObj.isLookahead && partInstanceId && partId) {
			// If partId is a known partInstanceId, then convert it to a partId
			const partInstance = this.#partInstances.find((p) => p._id === partInstanceId)
			if (partInstance) partId = partInstance.part._id

			const lookaheadSession = sessionsToConsider.find((s) => s.lookaheadForPartId === partId)
			if (lookaheadSession) {
				lookaheadSession.keep = true
				if (partInstance) {
					lookaheadSession.partInstanceIds = [partInstanceId]
				}
				return lookaheadSession.id
			} else {
				const sessionId = this.getNewSessionId()
				this.#knownSessions.push({
					id: sessionId,
					name: sessionName,
					isUniqueName: false,
					lookaheadForPartId: partId,
					partInstanceIds: partInstance ? [partInstanceId] : undefined,
					keep: true,
				})
				return sessionId
			}
		}

		return undefined
	}

	/**
	 * Make the sessionName unique for the pool, and ensure it isn't set to AUTO
	 */
	#validateSessionName(pieceInstanceId: PieceInstanceId | string, session: TimelineObjectAbSessionInfo): string {
		const newName = session.sessionName === AB_MEDIA_PLAYER_AUTO ? pieceInstanceId : session.sessionName
		return `${session.poolName}_${newName}`
	}
}
