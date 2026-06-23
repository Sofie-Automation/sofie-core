import React, { useState, useEffect } from 'react'

import versions from '../../versions.json';

const FALLBACK_VERSION = "26.03.0"; // Fallback version if versions.json cannot be loaded

export default function LatestVersionNumber() {
	try {
		// The first item in versions.json is always the latest archived version
		const latestVersion = versions[0];

		if (!latestVersion) {
			return <span>{FALLBACK_VERSION}</span>; // Fallback if versions.json is empty
		}

		return <span>{latestVersion}</span>;
	} catch (error) {
		return <span>{FALLBACK_VERSION}</span>;
	}
}
