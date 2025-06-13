import React, { useCallback, useState } from 'react'
import { UploadButton } from '../uploadButton'
import { faUpload } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useTranslation } from 'react-i18next'

interface IBase64ImageInputControlProps {
	classNames?: string
	disabled?: boolean

	value: string
	handleUpdate: (value: string) => void
}
export function Base64ImageInputControl({
	classNames,
	value,
	disabled,
	handleUpdate,
}: Readonly<IBase64ImageInputControlProps>): JSX.Element {
	const { t } = useTranslation()

	const [uploadFileKey, setUploadFileKey] = useState(() => Date.now())

	const handleSelectFile = useCallback(
		(event: React.ChangeEvent<HTMLInputElement>) => {
			// Clear the field
			setUploadFileKey(Date.now())

			const file = event.target.files?.[0]
			if (!file) return

			const reader = new FileReader()
			reader.onload = (readEvent) => {
				// On file upload

				const uploadResult = readEvent.target?.result
				if (typeof uploadResult !== 'string' || !uploadResult) return

				handleUpdate(uploadResult.toString())
			}
			reader.readAsDataURL(file)
		},
		[handleUpdate]
	)

	return (
		<div className={classNames}>
			<UploadButton
				className="btn btn-primary"
				accept="image/*"
				onChange={handleSelectFile}
				key={uploadFileKey}
				disabled={disabled}
			>
				<FontAwesomeIcon icon={faUpload} />
				<span>{t('Select image')}</span>
			</UploadButton>
			{value ? <img src={value} /> : null}
		</div>
	)
}
