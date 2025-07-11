import moment from 'moment'
import i18n, { TFunctionResult } from 'i18next'
import { TFunction } from 'react-i18next'
import Backend from 'i18next-http-backend'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'
import { WithManagedTracker } from '../lib/reactiveData/reactiveDataHelper.js'
import { MeteorPubSub } from '@sofie-automation/meteor-lib/dist/api/pubsub'
import { Translation, TranslationsBundle } from '@sofie-automation/meteor-lib/dist/collections/TranslationsBundles'
import { I18NextData } from '@sofie-automation/blueprints-integration'
import { MeteorCall } from '../lib/meteorApi.js'
import { ClientAPI } from '@sofie-automation/meteor-lib/dist/api/client'
import { interpollateTranslation } from '@sofie-automation/corelib/dist/TranslatableMessage'
import { TranslationsBundleId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { TranslationsBundles } from '../collections/index.js'
import { catchError } from '../lib/lib.js'
import { relativeToSiteRootUrl } from '../url.js'
import { UserError } from '@sofie-automation/corelib/dist/error'

const i18nOptions = {
	fallbackLng: {
		nn: ['nb', 'en'],
		default: ['en'],
	},

	// have a common namespace used around the full app
	ns: ['translations'],
	defaultNS: 'translations',

	debug: false,
	joinArrays: '\n',

	whitelist: ['en', 'nb', 'nn', 'sv'],

	keySeparator: '→',
	nsSeparator: '⇒',
	pluralSeparator: '⥤',
	contextSeparator: '⥤',

	interpolation: {
		escapeValue: false, // not needed for react!!
	},

	react: {
		wait: true,
		useSuspense: false,
	},

	backend: {
		loadPath: relativeToSiteRootUrl('/locales/{{lng}}/{{ns}}.json'),
	},

	detection: {
		order: ['querystring', 'cookie', 'localStorage', 'sessionStorage', 'navigator'],
	},
}

function toI18NextData(translations: Translation[]): I18NextData {
	const data: I18NextData = {}
	for (const { original, translation } of translations) {
		data[original] = translation
	}

	return data
}

async function getAndCacheTranslationBundle(bundleId: TranslationsBundleId) {
	return new Promise<TranslationsBundle>((resolve, reject) => {
		MeteorCall.system.getTranslationBundle(bundleId).then(
			(response) => {
				if (ClientAPI.isClientResponseSuccess(response)) {
					localStorage.setItem(`i18n.translationBundles.${bundleId}`, JSON.stringify(response.result))
					resolve(response.result)
				} else {
					reject(UserError.fromUnknown(response.error))
				}
			},
			(reason) => {
				reject(reason instanceof Error ? reason : new Error(reason))
			}
		)
	})
}

class I18nContainer extends WithManagedTracker {
	i18nInstance: typeof i18n

	constructor() {
		super()

		this.i18nInstance = i18n.use(Backend).use(LanguageDetector).use(initReactI18next)

		this.i18nInstance
			.init(i18nOptions)
			.then((t: TFunction) => {
				this.i18nTranslator = t
				moment.locale(i18n.language)
				document.documentElement.lang = i18n.language

				const webManifestLink = document.head.querySelector('link[rel="manifest"]')
				if (webManifestLink) {
					const sourceHref = webManifestLink.getAttribute('data-href')
					webManifestLink.setAttribute('href', sourceHref + `?lng=${i18n.language}`)
				}
			})
			.catch(catchError('i18nInstance.init'))

		this.subscribe(MeteorPubSub.translationsBundles)
		this.autorun(() => {
			const bundlesInfo = TranslationsBundles.find().fetch() as Omit<TranslationsBundle, 'data'>[]

			Promise.allSettled(
				bundlesInfo.map(async (bundleMetadata) =>
					new Promise<TranslationsBundle>((resolve) => {
						const bundleString = localStorage.getItem(`i18n.translationBundles.${bundleMetadata._id}`)
						if (bundleString) {
							// check hash
							try {
								const bundleObj = JSON.parse(bundleString) as TranslationsBundle
								if (bundleObj.hash === bundleMetadata.hash) {
									resolve(bundleObj) // the cached bundle is up-to-date
									return
								}
							} finally {
								// the cache seems to be corrupt, we re-fetch from backend
								resolve(getAndCacheTranslationBundle(bundleMetadata._id))
							}
						} else {
							resolve(getAndCacheTranslationBundle(bundleMetadata._id))
						}
					})
						.then((bundle) => {
							const i18NextData = toI18NextData(bundle.data)

							this.i18nInstance.addResourceBundle(
								bundle.language,
								bundle.namespace || i18nOptions.defaultNS,
								i18NextData,
								true,
								true
							)
						})
						.catch(catchError(`Failed to fetch translations bundle "${bundleMetadata._id}"`))
				)
			).catch(catchError(`One of the translation bundles failed to load`))
		})
	}

	// return key until real translator comes online
	i18nTranslator(key: unknown, ...args: any[]): string {
		console.debug('i18nTranslator placeholder called', { key, args })
		return interpollateTranslation(key, ...args)
	}
}

const container = new I18nContainer()
const i18nTranslator: TFunction = (key: any, options?): TFunctionResult => container.i18nTranslator(key, options)

export { i18nTranslator }

/*
 Notes:
 * How to use i18n in React:
	export const MyReactClass = withTranslation()(class MyReactClass extends React.Component<IProps & WithTranslation, IState> {
		render () {
			const {t} = this.props
			t('My name is {{name}}', {name: 'foobar'})
		}
	})

 * How to use in script:
	import { i18nTranslator } from '../i18n.js'
	const t = i18nTranslator
	return t('My name is {{name}}', {name: 'foobar'})
 */
