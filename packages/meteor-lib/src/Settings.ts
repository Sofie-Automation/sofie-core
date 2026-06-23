/**
 * This is an object specifying installation-wide, User Interface settings.
 * There are default values for these settings that will be used, unless overriden
 * through Meteor.settings functionality.
 *
 * You can use METEOR_SETTING to inject the settings JSON or you can use the
 * --settings [filename] to provide a JSON file containing the settings
 */
export interface ISettings {
	/** Default time scale zooming for the UI. Default: 1  */
	defaultTimeScale: number
	/** If true, enable http header based security measures */
	enableHeaderAuth: boolean
	/** How many segments of history to show when scrolling back in time (0 = show current segment only) */
	followOnAirSegmentsHistory: number
	/** Enable the use of poison key if present and use the key specified. **/
	poisonKey: string | null
	/** If set, enables a check to ensure that the system time doesn't differ too much from the speficied NTP server time. */
	enableNTPTimeChecker: null | {
		host: string
		port?: number
		maxAllowedDiff: number
	}

	/**
	 * CSS class applied to the body of the page. Used to include custom implementations that differ from the main Fork.
	 * I.e. custom CSS etc. Leave undefined if no custom implementation is needed
	 * */
	customizationClassName?: string

	/**
	 * Which keyboard key is used as "Confirm" in modal dialogs etc.
	 * In some installations, the rightmost Enter key (on the numpad) is dedicated for playout,
	 * in such cases this must be set to 'Enter' to exclude it.
	 */
	confirmKeyCode: 'Enter' | 'AnyEnter'
}

/**
 * Default values for Settings
 */
export const DEFAULT_SETTINGS = Object.freeze<ISettings>({
	defaultTimeScale: 1,
	enableHeaderAuth: false,
	poisonKey: 'Escape',
	followOnAirSegmentsHistory: 0,
	enableNTPTimeChecker: null,
	confirmKeyCode: 'Enter',
})
