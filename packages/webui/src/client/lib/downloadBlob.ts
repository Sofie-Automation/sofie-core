/**
 * Make the browser download a blob with a given filename
 *
 * @export
 * @param {Blob} blob the Blob object to be saved by the browser
 * @param {string} fileName the default file name to be given to the Blob
 */
export function downloadBlob(blob: Blob, fileName: string): void {
	const aDownload = window.document.createElement('a')

	aDownload.href = window.URL.createObjectURL(blob)

	aDownload.download = fileName

	document.body.appendChild(aDownload)
	aDownload.click()
	document.body.removeChild(aDownload)
}
