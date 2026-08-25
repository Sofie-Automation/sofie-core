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
	 * A PartInstance keeps its Branding for its whole life, and each PartInstance set as next inherits the Branding of the current PartInstance,
	 * so setting this for the 'current' will be propagated to the PartInstances which follow it.
	 * Note: this does nothing for a target which has no PartInstance selected.
	 * @param target Which of the selected PartInstances to apply this to
	 * @param brandingId Id of the Branding to select, or `null` to select no Branding
	 */
	setBranding(target: BrandingChangeTarget, brandingId: string | null): Promise<void>
}
