import { JobContext } from '../../jobs/index.js'
import {
	handleAdLibPieceStart,
	handleStartStickyPieceOnSourceLayer,
	handleTakePieceAsAdlibNow,
	handleStopPiecesOnSourceLayers,
	handleDisableNextPiece,
} from '../../playout/adlibJobs.js'
import { StudioJobs, StudioJobFunc } from '@sofie-automation/corelib/dist/worker/studio'
import { handleUpdateTimelineAfterIngest, handleUpdateStudioBaseline } from '../../playout/timelineJobs.js'
import {
	handleMoveNextPart,
	handleSetNextPart,
	handleSetNextSegment,
	handleQueueNextSegment,
} from '../../playout/setNextJobs.js'
import {
	handleActivateRundownPlaylist,
	handleDeactivateRundownPlaylist,
	handlePrepareRundownPlaylistForBroadcast,
	handleResetRundownPlaylist,
} from '../../playout/activePlaylistJobs.js'
import {
	handleDebugSyncPlayheadInfinitesForNextPartInstance,
	handleDebugRegenerateNextPartInstance,
	handleDebugCrash,
	handleDebugUpdateTimeline,
} from '../../playout/debug.js'
import { handleActivateHold, handleDeactivateHold } from '../../playout/holdJobs.js'
import { handleRemoveEmptyPlaylists } from '../../studio/cleanup.js'
import {
	handleRegenerateRundownPlaylist,
	handleRemoveRundownPlaylist,
	handleMoveRundownIntoPlaylist,
	handleRestoreRundownsInPlaylistToDefaultOrder,
} from '../../rundownPlaylists.js'
import { handleGeneratePlaylistSnapshot, handleRestorePlaylistSnapshot } from '../../playout/snapshot.js'
import {
	handleBlueprintFixUpConfigForStudio,
	handleBlueprintIgnoreFixUpConfigForStudio,
	handleBlueprintUpgradeForStudio,
	handleBlueprintValidateConfigForStudio,
} from '../../playout/upgrade.js'
import { handleTimelineTriggerTime, handleOnPlayoutPlaybackChanged } from '../../playout/timings/index.js'
import { handleExecuteAdlibAction } from '../../playout/adlibAction.js'
import { handleTakeNextPart } from '../../playout/take.js'
import { handleClearQuickLoopMarkers, handleSetQuickLoopMarker } from '../../playout/quickLoopMarkers.js'
import { handleActivateAdlibTesting } from '../../playout/adlibTesting.js'
import { handleExecuteBucketAdLibOrAction } from '../../playout/bucketAdlibJobs.js'
import { handleSwitchRouteSet } from '../../studio/routeSet.js'

type ExecutableFunction<T extends keyof StudioJobFunc> = (
	context: JobContext,
	data: Parameters<StudioJobFunc[T]>[0]
) => Promise<ReturnType<StudioJobFunc[T]>>

export type StudioJobHandlers = {
	[T in keyof StudioJobFunc]: ExecutableFunction<T>
}

export const studioJobHandlers: StudioJobHandlers = {
	[StudioJobs.UpdateTimeline]: handleDebugUpdateTimeline,
	[StudioJobs.UpdateTimelineAfterIngest]: handleUpdateTimelineAfterIngest,

	[StudioJobs.AdlibPieceStart]: handleAdLibPieceStart,
	[StudioJobs.TakePieceAsAdlibNow]: handleTakePieceAsAdlibNow,
	[StudioJobs.StartStickyPieceOnSourceLayer]: handleStartStickyPieceOnSourceLayer,
	[StudioJobs.StopPiecesOnSourceLayers]: handleStopPiecesOnSourceLayers,
	[StudioJobs.MoveNextPart]: handleMoveNextPart,
	[StudioJobs.ActivateHold]: handleActivateHold,
	[StudioJobs.DeactivateHold]: handleDeactivateHold,
	[StudioJobs.PrepareRundownForBroadcast]: handlePrepareRundownPlaylistForBroadcast,
	[StudioJobs.ResetRundownPlaylist]: handleResetRundownPlaylist,
	[StudioJobs.ActivateRundownPlaylist]: handleActivateRundownPlaylist,
	[StudioJobs.DeactivateRundownPlaylist]: handleDeactivateRundownPlaylist,
	[StudioJobs.SetNextPart]: handleSetNextPart,
	[StudioJobs.SetNextSegment]: handleSetNextSegment,
	[StudioJobs.QueueNextSegment]: handleQueueNextSegment,
	[StudioJobs.ExecuteAction]: handleExecuteAdlibAction,
	[StudioJobs.ExecuteBucketAdLibOrAction]: handleExecuteBucketAdLibOrAction,
	[StudioJobs.TakeNextPart]: handleTakeNextPart,
	[StudioJobs.DisableNextPiece]: handleDisableNextPiece,
	[StudioJobs.RemovePlaylist]: handleRemoveRundownPlaylist,
	[StudioJobs.RegeneratePlaylist]: handleRegenerateRundownPlaylist,

	[StudioJobs.OnPlayoutPlaybackChanged]: handleOnPlayoutPlaybackChanged,
	[StudioJobs.OnTimelineTriggerTime]: handleTimelineTriggerTime,

	[StudioJobs.UpdateStudioBaseline]: handleUpdateStudioBaseline,
	[StudioJobs.CleanupEmptyPlaylists]: handleRemoveEmptyPlaylists,

	[StudioJobs.OrderRestoreToDefault]: handleRestoreRundownsInPlaylistToDefaultOrder,
	[StudioJobs.OrderMoveRundownToPlaylist]: handleMoveRundownIntoPlaylist,

	[StudioJobs.DebugSyncInfinitesForNextPartInstance]: handleDebugSyncPlayheadInfinitesForNextPartInstance,
	[StudioJobs.DebugRegenerateNextPartInstance]: handleDebugRegenerateNextPartInstance,

	[StudioJobs.GeneratePlaylistSnapshot]: handleGeneratePlaylistSnapshot,
	[StudioJobs.RestorePlaylistSnapshot]: handleRestorePlaylistSnapshot,
	[StudioJobs.DebugCrash]: handleDebugCrash,

	[StudioJobs.BlueprintUpgradeForStudio]: handleBlueprintUpgradeForStudio,
	[StudioJobs.BlueprintValidateConfigForStudio]: handleBlueprintValidateConfigForStudio,
	[StudioJobs.BlueprintFixUpConfigForStudio]: handleBlueprintFixUpConfigForStudio,
	[StudioJobs.BlueprintIgnoreFixUpConfigForStudio]: handleBlueprintIgnoreFixUpConfigForStudio,

	[StudioJobs.ActivateAdlibTesting]: handleActivateAdlibTesting,

	[StudioJobs.SetQuickLoopMarker]: handleSetQuickLoopMarker,
	[StudioJobs.ClearQuickLoopMarkers]: handleClearQuickLoopMarkers,

	[StudioJobs.SwitchRouteSet]: handleSwitchRouteSet,
}
