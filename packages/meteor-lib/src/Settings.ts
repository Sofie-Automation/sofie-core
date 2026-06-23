/**
 * This is an object specifying installation-wide, User Interface settings.
 * There are default values for these settings that will be used, unless overriden
 * through Meteor.settings functionality.
 *
 * You can use METEOR_SETTING to inject the settings JSON or you can use the
 * --settings [filename] to provide a JSON file containing the settings
 */
export interface ISettings {
	/** If true, enable http header based security measures */
	enableHeaderAuth: boolean
}

/**
 * Default values for Settings
 */
export const DEFAULT_SETTINGS = Object.freeze<ISettings>({
	enableHeaderAuth: false,
})
