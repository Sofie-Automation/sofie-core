import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { XMLSerializer } from '@xmldom/xmldom'

// @testing-library/react only cleans up automatically when test globals are enabled
afterEach(() => {
	cleanup()
})

// used by code creating XML with the DOM API to return an XML string
;(globalThis as any).XMLSerializer = XMLSerializer

// Version number injected by vite packaging
;(globalThis as any).__APP_VERSION__ = '0.0.0'
