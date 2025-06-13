import React, { memo, useEffect, useState } from 'react'
import { CreateAdlibTestingRundownOption } from '@sofie-automation/meteor-lib/dist/api/showStyles'
import { MeteorCall } from '../../lib/meteorApi'
import { UserAction, doUserAction } from '../../lib/clientUserAction'
import { useTranslation } from 'react-i18next'

export const CreateAdlibTestingRundownPanel = memo(function CreateAdlibTestingRundownPanel(): JSX.Element | null {
	const { t } = useTranslation()

	const [options, setOptions] = useState<CreateAdlibTestingRundownOption[]>([])

	useEffect(() => {
		let isDisposed = false

		// Future: It would be nice for this to be more responsive in updates, but as this requires configuration changes to change, not updating shouldn't be an issue
		MeteorCall.showstyles
			.getCreateAdlibTestingRundownOptions()
			.then((newOptions) => {
				if (isDisposed) return
				setOptions(newOptions)
			})
			.catch((e) => {
				console.error(`Failed to get create adlib testing rundown options: ${e}`)
			})

		return () => {
			isDisposed = true
		}
	}, [])

	const doCreateAdlibTestingRundown = (e: React.MouseEvent, option: CreateAdlibTestingRundownOption) => {
		doUserAction(t, e, UserAction.CREATE_ADLIB_TESTING_RUNDOWN, (e, ts) =>
			MeteorCall.userAction.createAdlibTestingRundownForShowStyleVariant(
				e,
				ts,
				option.studioId,
				option.showStyleVariantId
			)
		)
	}

	if (options.length === 0) return null

	return (
		<div className="mtl gutter create-testing-rundown">
			<h2>{t('Create Adlib Testing Rundown')}</h2>
			<p>
				{options.map((option) => (
					<button
						key={JSON.stringify(option)}
						className="btn btn-primary"
						onClick={(e) => doCreateAdlibTestingRundown(e, option)}
					>
						{option.label}
					</button>
				))}
			</p>
		</div>
	)
})
