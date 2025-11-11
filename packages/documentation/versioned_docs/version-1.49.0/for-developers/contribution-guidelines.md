---
description: >-
  The Sofie team happily encourage contributions to the Sofie project, and
  kindly ask you to observe these guidelines when doing so.
sidebar_position: 2
---

# Contribution Guidelines

## About the Sofie TV Studio Automation Project

The Sofie project includes a number of open source applications and libraries developed and maintained by the Norwegian public service broadcaster, [NRK](https://www.nrk.no/about/). Sofie has been used to produce live shows at NRK since September 2018.

A list of the "Sofie repositories" [can be found here](libraries.md). NRK owns the copyright of the contents of the official Sofie repositories, including the source code, related files, as well as the Sofie logo.

The Sofie team at NRK is responsible for development and maintenance. We also do thorough testing of each release to avoid regressions in functionality and ensure interoperability with the various hardware and software involved.

The Sofie team welcomes open source contributions and will actively work towards enabling contributions to become mergeable into the Sofie repositories. However, as main stakeholder and maintainer we reserve the right to refuse any contributions.

## About Contributions

Thank you for considering contributing to the Sofie project!

Before you start, there are a few things you should know:

### “Discussions Before Pull Requests”

**Minor changes** (most bug fixes and small features) can be submitted directly as pull requests to the appropriate official repo.

However, Sofie is a big project with many differing users and use cases. **Larger changes** might be more difficult to merge into an official repository if NRK has not been made aware of their existence beforehand. To facilitate a timely handling of larger contributions, there’s a workflow intended to keep an open dialogue between all interested parties:

1. Contributor opens an RFC (as a _GitHub issue_) in the appropriate repository.
2. NRK evaluates the RFC, usually within a week.
3. (If needed) NRK establishes contact with the RFC author, who will be invited to a workshop where the RFC is discussed. Meeting notes are published publicly on the RFC thread.
4. The contributor references the RFC when a pull request is ready.

### Base contributions on the in-development branch (or the master branch)

In order to facilitate merging, we ask that contributions are based on the latest (at the time of the pull request) _in-development_ branch (often named `release*`), alternatively the stable (eg. `master`) branch. NRK will take responsibility for rebasing stable contributions to the latest in-development branch if needed.
See **CONTRIBUTING.md** in each official repository for details on which branch to use as a base for contributions.

## Developer Guidelines

### Pull Requests

We encourage you to open PRs early! If it’s still in development, open the PR as a draft.

### Types

All official Sofie repositories use TypeScript. When you contribute code, be sure to keep it as strictly typed as possible.

### Code Style & Formatting

Most of the projects use a linter (eslint) and a formatter (prettier). Before submitting a pull request, please make sure it conforms to the linting rules by running yarn lint. yarn lint --fix can fix most of the issues.

### Documentation

We rely on two types of documentation; the [Sofie documentation](https://nrkno.github.io/sofie-core/) ([source code](https://github.com/nrkno/sofie-core/tree/master/packages/documentation)) and inline code documentation.

We don't aim to have the "absolute perfect documentation possible", BUT we do try to improve and add documentation to have a good-enough-to-be-comprehensible standard. We think that:

- _What_ something does is not as important – we can read the code for that.
- _Why_ something does something, **is** important. Implied usage, side-effects, descriptions of the context etcetera...

When you contribute, we ask you to also update any documentation where needed.

### Updating Dependencies​

When updating dependencies in a library, it is preferred to do so via `yarn upgrade-interactive --latest` whenever possible. This is so that the versions in `package.json` are also updated as we have no guarantee that the library will work with versions lower than that used in the `yarn.lock` file, even if it is compatible with the semver range in `package.json`. After this, a `yarn upgrade` can be used to update any child dependencies

Be careful when bumping across major versions.

Also, each of the libraries has a minimum nodejs version specified in their package.json. Care must be taken when updating dependencies to ensure its compatibility is retained.

### Resolutions​

We sometimes use the `yarn resolutions` property in `package.json` to fix security vulnerabilities in dependencies of libraries that haven't released a fix yet. If adding a new one, try to make it as specific as possible to ensure it doesn't have unintended side effects.

When updating other dependencies, it is a good idea to make sure that the resolutions defined still apply and are correct.
