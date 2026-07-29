import type { IExtendedSettings } from '@sofie-automation/meteor-lib/dist/Settings'

// @ts-expect-error no types defined
const MeteorInjectedSettings: IExtendedSettings | undefined = window.__meteor_runtime_config__

export const APP_VERSION_EXTENDED = MeteorInjectedSettings?.sofieVersionExtended
export const APP_HEADER_AUTH_ENABLED = MeteorInjectedSettings?.enableHeaderAuth
