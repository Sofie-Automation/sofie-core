import { JobContext } from '../../jobs'
import {
	handleAdLibPieceStart,
	handleStartStickyPieceOnSourceLayer,
	handleTakePieceAsAdlibNow,
	handleStopPiecesOnSourceLayers,
	handleDisableNextPiece,
} from '../../playout/adlibJobs'
import { StudioJobs, StudioJobFunc } from '@sofie-automation/corelib/dist/worker/studio'
import { handleUpdateTimelineAfterIngest, handleUpdateStudioBaseline } from '../../playout/timelineJobs'
import {
	handleMoveNextPart,
	handleSetNextPart,
	handleSetNextSegment,
	handleQueueNextSegment,
} from '../../playout/setNextJobs'
import {
	handleActivateRundownPlaylist,
	handleDeactivateRundownPlaylist,
	handlePrepareRundownPlaylistForBroadcast,
	handleResetRundownPlaylist,
} from '../../playout/activePlaylistJobs'
import {
	handleDebugSyncPlayheadInfinitesForNextPartInstance,
	handleDebugRegenerateNextPartInstance,
	handleDebugCrash,
	handleDebugUpdateTimeline,
} from '../../playout/debug'
import { handleActivateHold, handleDeactivateHold } from '../../playout/holdJobs'
import { handleRemoveEmptyPlaylists } from '../../studio/cleanup'
import {
	handleRegenerateRundownPlaylist,
	handleRemoveRundownPlaylist,
	handleMoveRundownIntoPlaylist,
	handleRestoreRundownsInPlaylistToDefaultOrder,
} from '../../rundownPlaylists'
import { handleGeneratePlaylistSnapshot, handleRestorePlaylistSnapshot } from '../../playout/snapshot'
import {
	handleBlueprintFixUpConfigForStudio,
	handleBlueprintIgnoreFixUpConfigForStudio,
	handleBlueprintUpgradeForStudio,
	handleBlueprintValidateConfigForStudio,
} from '../../playout/upgrade'
import { handleTimelineTriggerTime, handleOnPlayoutPlaybackChanged } from '../../playout/timings'
import { handleExecuteAdlibAction } from '../../playout/adlibAction'
import { handleTakeNextPart } from '../../playout/take'
import { handleClearQuickLoopMarkers, handleSetQuickLoopMarker } from '../../playout/quickLoopMarkers'
import { handleActivateAdlibTesting } from '../../playout/adlibTesting'
import { handleExecuteBucketAdLibOrAction } from '../../playout/bucketAdlibJobs'
import { handleSwitchRouteSet } from '../../studio/routeSet'

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
