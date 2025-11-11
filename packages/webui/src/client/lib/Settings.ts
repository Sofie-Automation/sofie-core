import _ from 'underscore'
import { ISettings, DEFAULT_SETTINGS } from '@sofie-automation/meteor-lib/dist/Settings'

/**
 * This is an object specifying installation-wide, User Interface settings.
 * There are default values for these settings that will be used, unless overridden
 * through Meteor.settings functionality.
 *
 * You can use METEOR_SETTING to inject the settings JSON or you can use the
 * --settings [filename] to provide a JSON file containing the settings
 */
export let Settings: ISettings = _.clone(DEFAULT_SETTINGS)

// @ts-expect-error no types defined
const MeteorInjectedSettings: any = window.__meteor_runtime_config__

if (MeteorInjectedSettings?.PUBLIC_SETTINGS) {
	Settings = _.extend(Settings, MeteorInjectedSettings.PUBLIC_SETTINGS)
}

export const APP_VERSION_EXTENDED: string | undefined = MeteorInjectedSettings?.sofieVersionExtended
