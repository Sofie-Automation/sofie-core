---
title: NPM Package Publishing
sidebar_position: 999
---

While many parts of Sofie reside in the main `sofie-core` mono-repo, there are a few NPM libraries in that repo which want to be published to NPM to allow being consumed elsewhere.

Many features and PRs will need to make changes to these libraries, which means that you will often need to publish testing versions that you can use before your PR is merged, or when you need to publish your own Sofie releases to backport that feature onto an older release.

To make this easy, the Github actions workflows have been structured so that you can utilise them with minimal effort for publishing to your own npm organization.  
The `Publish libraries` workflow is the single workflow used to perform this publishing, for both stable and prerelease versions. You can manually trigger this workflow at any time in the Github UI or via CLI tools to trigger a prerelease build of the libraries.

When running in your fork, this workflow will only run if the `NPM_PACKAGE_PREFIX` variable has been defined (Note: this is a variable not a secret).

Recommended repository variables/secrets

- `NPM_PACKAGE_PREFIX` — repository variable; your npm organisation (required for forks to publish).
- `NPM_PACKAGE_SCOPE` — repository variable; optional, adds `sofie-` prefix to package names.
- `NPM_TOKEN` — repository secret; optional if using trusted publishing, otherwise required for the workflow to publish.

For the publishing, we recommend enabling [trusted publishing](https://docs.npmjs.com/trusted-publishers), but in case you are unable to do this (or to allow for the first publish), if you provide a `NPM_TOKEN` secret, that will be used for the publishing instead.

The [`timeline-state-resolver`](https://github.com/Sofie-Automation/sofie-timeline-state-resolver) repository has been setup in the same way, as this is another library that you will often need to publish your own versions for.
