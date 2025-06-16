import * as React from 'react'

import { translateWithTracker, Translated } from './ReactMeteorData/ReactMeteorData.js'
import { ICoreSystem } from '@sofie-automation/meteor-lib/dist/collections/CoreSystem'

import { ReactiveVar } from 'meteor/reactive-var'
import { isRunningInPWA } from './lib.js'
import { CoreSystem } from '../collections/index.js'

/**
 * A reactive variable that allows setting the title of the current view.
 *
 * Use to set a view title:
 *
 * ```documentTitle.set("Title of the view")```
 *
 * or for a view without a title:
 *
 * ```documentTitle.set(null)```
 */
export const documentTitle = new ReactiveVar<null | string>(null)

interface IProps {}

interface ITrackedProps {
	cs: ICoreSystem | undefined
	doc: string | null
}

/**
 * This component should be placed in the App root. It will maintain the document title
 * and will restore it to the default when it's unmounted.
 */
export const DocumentTitleProvider = translateWithTracker((_props: IProps) => {
	return {
		cs: CoreSystem.findOne(),
		doc: documentTitle.get(),
	}
})(
	class DocumentTitleProvider extends React.Component<Translated<IProps & ITrackedProps>, {}> {
		private formatDocumentTitle(docTitle: string | undefined, csName: string | undefined) {
			const { t } = this.props
			const appShortName = t('Sofie')
			const compiledTitle: string[] = []

			if (docTitle) {
				compiledTitle.push(docTitle)
			}
			if (!isRunningInPWA()) {
				compiledTitle.push(appShortName)

				if (csName) {
					compiledTitle.push(csName)
				}
			}

			document.title = compiledTitle.join(' – ')
		}

		componentDidMount(): void {
			const { doc, cs } = this.props
			this.formatDocumentTitle(doc || undefined, cs?.name)
		}

		componentDidUpdate(): void {
			const { doc, cs } = this.props
			this.formatDocumentTitle(doc || undefined, cs?.name)
		}

		componentWillUnmount(): void {
			this.formatDocumentTitle(undefined, undefined)
		}

		render(): React.ReactNode {
			return null
		}
	}
)
