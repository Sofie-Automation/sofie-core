#!/usr/bin/env node
import { extractTranslations } from './translation/extract.mjs'

extractTranslations().catch(console.error)
