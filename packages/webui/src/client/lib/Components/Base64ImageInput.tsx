import { useCallback } from 'react'
import { UploadButton } from '../uploadButton.js'
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

	const handleSelectFile = useCallback(
		(_fileContent: string, file: File) => {
			if (!file) return

			const reader = new FileReader()
			reader.readAsDataURL(file)
			reader.onload = () => {
				handleUpdate(reader.result as string)
			}
			reader.onerror = (error) => {
				console.error('Error reading file:', error)
			}
		},
		[handleUpdate]
	)

	const handleUploadError = useCallback((error: Error) => {
		// Handle upload error
		console.error('Error uploading file:', error)
	}, [])

	return (
		<div className={classNames}>
			<UploadButton
				className="btn btn-primary"
				accept="image/*"
				onUploadContents={handleSelectFile}
				onUploadError={handleUploadError}
				disabled={disabled}
			>
				<FontAwesomeIcon icon={faUpload} />
				<span>{t('Select image')}</span>
			</UploadButton>
			{value ? <img src={value} /> : null}
		</div>
	)
}
