import { addMigrationSteps } from './databaseMigration'
import { Settings } from '../Settings'
import { Studios } from '../collections'

// Release 40 (Skipped)

interface ISettingsOld {
	/** The framerate (frames per second) used to convert internal timing information (in milliseconds)
	 * into timecodes and timecode-like strings and interpret timecode user input
	 * Default: 25
	 */
	frameRate: number
	/* Should the segment in the Rundown view automatically rewind after it stops being live? Default: false */
	autoRewindLeavingSegment: boolean
	/** Disable blur border in RundownView */
	disableBlurBorder: boolean
	/** Default time scale zooming for the UI. Default: 1  */
	defaultTimeScale: number
	// Allow grabbing the entire timeline
	allowGrabbingTimeline: boolean
	/** If true, enables security measures, access control and user accounts. */
	enableUserAccounts: boolean
	/** Allow resets while a rundown is on-air */
	allowRundownResetOnAir: boolean
	/** Default duration to use to render parts when no duration is provided */
	defaultDisplayDuration: number
	/** How many segments of history to show when scrolling back in time (0 = show current segment only) */
	followOnAirSegmentsHistory: number
	/** Clean up stuff that are older than this [ms] */
	maximumDataAge: number

	/** If set, enables a check to ensure that the system time doesn't differ too much from the speficied NTP server time. */
	enableNTPTimeChecker: null | {
		host: string
		port?: number
		maxAllowedDiff: number
	}
}
const OldSettings = Settings as Partial<ISettingsOld>
const oldFrameRate = OldSettings.frameRate ?? 25

export const addSteps = addMigrationSteps('1.40.0', [
	{
		id: `Studio.settings.frameRate`,
		canBeRunAutomatically: true,
		validate: async () => {
			const count = await Studios.countDocuments({
				'settings.frameRate': {
					$exists: false,
				},
			})
			if (count > 0) return `${count} studios need to be updated`
			return false
		},
		migrate: async () => {
			await Studios.updateAsync(
				{
					'settings.frameRate': {
						$exists: false,
					},
				},
				{
					$set: {
						'settings.frameRate': oldFrameRate,
					},
				},
				{ multi: true }
			)
		},
	},
	{
		id: `Studio.settings.allowRundownResetOnAir`,
		canBeRunAutomatically: true,
		validate: async () => {
			if (OldSettings.allowRundownResetOnAir !== undefined) {
				const count = await Studios.countDocuments({
					'settings.allowRundownResetOnAir': {
						$exists: false,
					},
				})
				if (count > 0) return `${count} studios need to be updated`
			}
			return false
		},
		migrate: async () => {
			if (OldSettings.allowRundownResetOnAir !== undefined) {
				await Studios.updateAsync(
					{
						'settings.allowRundownResetOnAir': {
							$exists: false,
						},
					},
					{
						$set: {
							'settings.allowRundownResetOnAir': OldSettings.allowRundownResetOnAir,
						},
					},
					{ multi: true }
				)
			}
		},
	},
])
