require('@testing-library/jest-dom')

// used by code creating XML with the DOM API to return an XML string
global.XMLSerializer = require('@xmldom/xmldom').XMLSerializer

// Version number injected by vite packaging
global.__APP_VERSION__ = '0.0.0'
