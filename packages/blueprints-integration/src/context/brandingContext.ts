import type { ReadonlyDeep } from 'type-fest'
import type { IBlueprintBrandingInfo } from '../showStyle.js'

/** Which of the selected PartInstances a Branding change should be applied to */
export type BrandingChangeTarget = 'current' | 'next' | 'both'

export interface IBrandingReadMethods {
	/**
	 * The Branding selected for the current PartInstance.
	 * `null` when no Branding is selected, when there is no current PartInstance, or when the selected Branding no longer exists in the ShowStyle
	 */
	getCurrentBranding(): ReadonlyDeep<IBlueprintBrandingInfo> | null

	/**
	 * The Branding selected for the next PartInstance.
	 * `null` when no Branding is selected, when there is no next PartInstance, or when the selected Branding no longer exists in the ShowStyle
	 */
	getNextBranding(): ReadonlyDeep<IBlueprintBrandingInfo> | null
}

export interface IBrandingMutateMethods extends IBrandingReadMethods {
	/**
	 * Change the Branding selected for the current and/or next PartInstance.
	 * A PartInstance is given its Branding when it is created, inheriting it from the current PartInstance (or the next, when
	 * there is no current), and keeps it until it is changed here.
	 * As the next PartInstance has usually been created already, changing only the 'current' does not affect it. Use 'both'
	 * to change the Branding from now on.
	 * Note: this does nothing for a target which has no PartInstance selected.
	 * @param target Which of the selected PartInstances to apply this to
	 * @param brandingId Id of the Branding to select, or `null` to select no Branding
	 */
	setBranding(target: BrandingChangeTarget, brandingId: string | null): Promise<void>
}
