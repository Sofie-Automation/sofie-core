---
sidebar_position: 7
---
# Language

_Sofie_ uses the [i18n internationalisation framework](https://www.i18next.com/) that allows you to present user-facing views in multiple languages. 

## Language selection

The UI will automatically detect user browser's default matching and select the best match, falling back to English. You can also force the UI language to any language by navigating to a page with `?lng=xx` query string, for example:

`http://localhost:3000/?lng=en`

This choice is persisted in browser's local storage, and the same language will be used until a new forced language is chosen using this method.

_Sofie_ currently supports three languages:
* English _(default)_ `en`
* Norwegian bokmål `nb`
* Norwegian nynorsk `nn`

## Further Reading

* [List of language tags](https://en.wikipedia.org/wiki/IETF_language_tag)