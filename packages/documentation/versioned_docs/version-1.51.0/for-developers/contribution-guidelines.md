---
description: >-
  The Sofie team happily encourage contributions to the Sofie project, and
  kindly ask you to observe these guidelines when doing so.
sidebar_position: 2
---

# Contribution Guidelines

_Last updated september 2024_

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

However, Sofie is a big project with many differing users and use cases. **Larger changes** may be difficult to merge into an official repository if NRK and other contributors have not been made aware of their existence beforehand. Since figuring out what side-effects a new feature or a change may have for other Sofie users can be tricky, we advise opening an RFC issue (_Request for Comments_) early in your process. Good moments to open an RFC include:
* When a user need is identified and described
* When you have a rough idea about how a feature may be implemented
* When you have a sketch of how a feature could look like to the user

To facilitate timely handling of larger contributions, there’s a workflow intended to keep an open dialogue between all interested parties:

1. Contributor opens an RFC (as a _GitHub issue_) in the appropriate repository.
2. NRK evaluates the RFC, usually within a week.
3. If needed, NRK establishes contact with the RFC author, who will be invited to a workshop where the RFC is discussed. Meeting notes are published publicly on the RFC thread.
4. Discussions about the RFC continue as needed, either in workshops or in comments in the RFC thread.
5. The contributor references the RFC when a pull request is ready.

It will be very helpful if your RFC includes specific use-cases that you are facing. Providing a background on how your users are using Sofie can clear up situations in which certain phrases or processes may be ambiguous. If during your process you have already identified various solutions as favorable or unfavorable, offering this context will move the discussion further still.

Via the RFC process, we're looking to maximize involvement from various stakeholders, so you probably don't need to come up with a very detailed design of your proposed change or feature in the RFC. An end-user oriented description will be most valuable in creating a constructive dialogue, but don't shy away from also adding a more technical description, if you find that will convey your ideas better.

### Base contributions on the in-development branch

In order to facilitate merging, we ask that contributions are based on the latest (at the time of the pull request) _in-development_ branch (often named `release*`).
See **CONTRIBUTING.md** in each official repository for details on which branch to use as a base for contributions.

## Developer Guidelines

### Pull Requests

We encourage you to open PRs early! If it’s still in development, open the PR as a draft.

### Types

All official Sofie repositories use TypeScript. When you contribute code, be sure to keep it as strictly typed as possible.

### Code Style & Formatting

Most of the projects use a linter (eslint) and a formatter (prettier). Before submitting a pull request, please make sure it conforms to the linting rules by running yarn lint. yarn lint --fix can fix most of the issues.

### Documentation

We rely on two types of documentation; the [Sofie documentation](https://sofie-automation.github.io/sofie-core/) ([source code](https://github.com/Sofie-Automation/sofie-core/tree/main/packages/documentation)) and inline code documentation.

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

### Logging

When logging, we try to adher to the following guideliness:

Usage of `console.log` and `console.error` directly is discouraged (except for quick debugging locally). Instead, use one of the logger libraries (to output json logs which are easier to index).
When logging, use one of the **log level** described below:

| Level     | Description                                                                                                                                                                                                                                                                  | Examples                                                                                                                                                                                                                                    |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `silly`   | For very detailed logs (rarely used).                                                                                                                                                                                                                                        | -                                                                                                                                                                                                                                           |
| `debug`   | Logging of info that could be useful for developers when debugging certain issues in production.                                                                                                                                                                             | `"payload: {>JSON<} "`<br></br>`"Reloading data X from DB"`                                                                                                                                                                                 |
| `verbose` | Logging of common events.                                                                                                                                                                                                                                                    | `"File X updated"`                                                                                                                                                                                                                          |
| `info`    | Logging of significant / uncommon events.<br></br>_Note: If an event happens often or many times, use `verbose` instead._                                                                                                                                                    | `"Initializing TSR..."`<br></br>`"Starting nightly cronjob..."`<br></br>`"Snapshot X restored"`<br></br>`"Not allowing removal of current playing segment 'xyz', making segment unsynced instead"`<br></br>`"PeripheralDevice X connected"` |
| `warn`    | Used when something unexpected happened, but not necessarily due to an application bug.<br></br>These logs don't have to be acted upon directly, but could be useful to provide context to a dev/sysadmin while troubleshooting an issue.                                    | `"PeripheralDevice X disconnected"`<br></br>`"User Error: Cannot activate Rundown (Rundown not found)" `<br></br>`"mosRoItemDelete NOT SUPPORTED"`                                                                                          |
| `error`   | Used when something went _wrong_, preventing something from functioning.<br></br>A logged `error` should always result in a sysadmin / developer looking into the issue.<br></br>_Note: Don't use `error` for things that are out of the app's control, such as user error._ | `"Cannot read property 'length' of undefined"`<br></br>`"Failed to save Part 'X' to DB"`                                                                                                                                                    |
| `crit`    | Fatal errors (rarely used)                                                                                                                                                                                                                                                   | -                                                                                                                                                                                                                                           |
