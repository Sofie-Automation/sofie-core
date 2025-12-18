# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [2.2.0](https://github.com/nrkno/tv-automation-server-core-integration/compare/2.1.0...2.2.0) (2020-12-08)

### Features

- Add dataRundownGet and dataSegmentGet methods ([9be7a5b](https://github.com/nrkno/tv-automation-server-core-integration/commit/9be7a5bda75e577f8f04d72516b5077cc2a29a5e))

### Bug Fixes

- Add clearMediaObjectCollection method ([#32](https://github.com/nrkno/tv-automation-server-core-integration/issues/32)) ([ad947f4](https://github.com/nrkno/tv-automation-server-core-integration/commit/ad947f46597f02a5fe3415c84e05cfa457c38c44))
- change when the connectionChanged event handler is attached so that it doesn't trip on the first ddp.connect() ([#36](https://github.com/nrkno/tv-automation-server-core-integration/issues/36)) ([5ff6b8a](https://github.com/nrkno/tv-automation-server-core-integration/commit/5ff6b8a0e280ea0ca2982c19fa7bcc93eedddcc3))

## [2.1.0](https://github.com/nrkno/tv-automation-server-core-integration/compare/2.0.0...2.1.0) (2020-11-10)

### Features

- merge in and update/upgrade DDP client and id generation ([#34](https://github.com/nrkno/tv-automation-server-core-integration/issues/34)) ([9602fc2](https://github.com/nrkno/tv-automation-server-core-integration/commit/9602fc2a8acee6eb0139f47e9d698afd81b48385))

## [2.0.0](https://github.com/nrkno/tv-automation-server-core-integration/compare/1.5.1...2.0.0) (2020-09-02)

### ⚠ BREAKING CHANGES

- drop support for node 8

### Features

- drop support for node 8 ([f5b88e1](https://github.com/nrkno/tv-automation-server-core-integration/commit/f5b88e1d99bcd7d0b8cde07595575fa7ca2b64f2))
- Multiline strings ([1daca67](https://github.com/nrkno/tv-automation-server-core-integration/commit/1daca67c6f0a0b57d5a5739a438e321a6484bce6))

### Bug Fixes

- reduced amount of watchdogs calls ([c9d621a](https://github.com/nrkno/tv-automation-server-core-integration/commit/c9d621ae7aa36a5afc7caef85d310d411d06a595))

### [1.5.1](https://github.com/nrkno/tv-automation-server-core-integration/compare/1.5.0...1.5.1) (2020-05-28)

## [1.5.0](https://github.com/nrkno/tv-automation-server-core-integration/compare/1.4.0...1.5.0) (2020-05-07)

### Features

- Add INEWS device ([32ec234](https://github.com/nrkno/tv-automation-server-core-integration/commit/32ec234350d3971a02ddf9d6a50f8ad785ee8c7b))

### Bug Fixes

- remove test code from configManifest ([6449e16](https://github.com/nrkno/tv-automation-server-core-integration/commit/6449e16338b09780946aa9c563ba1b509a66295c))

## [1.4.0](https://github.com/nrkno/tv-automation-server-core-integration/compare/1.3.0...1.4.0) (2020-02-26)

### Features

- add placeholder option to config manifest entry ([00a6c31](https://github.com/nrkno/tv-automation-server-core-integration/commit/00a6c312513c4802e60a2156038577e1a9e2db8a))

## [1.3.0](https://github.com/nrkno/tv-automation-server-core-integration/compare/1.2.1...1.3.0) (2020-01-07)

### Features

- device config manifests ([15e7c7f](https://github.com/nrkno/tv-automation-server-core-integration/commit/15e7c7fce4a6e318f03404247e2cbe9e70d86625))
- update ci to run for node 8,10,12 ([24cebc3](https://github.com/nrkno/tv-automation-server-core-integration/commit/24cebc3a396afa860e98b5c86464fc87ab2ef2af))

### [1.2.1](https://github.com/nrkno/tv-automation-server-core-integration/compare/1.2.0...1.2.1) (2019-08-26)

### Bug Fixes

- an issue with getCollection ([cc870c9](https://github.com/nrkno/tv-automation-server-core-integration/commit/cc870c9))
- minimize Collection scope size ([0fa7943](https://github.com/nrkno/tv-automation-server-core-integration/commit/0fa7943))

<a name="1.2.0"></a>

# [1.2.0](https://github.com/nrkno/tv-automation-server-core-integration/compare/1.1.0...1.2.0) (2019-06-05)

### Features

- add method ([ebb741b](https://github.com/nrkno/tv-automation-server-core-integration/commit/ebb741b))

<a name="1.1.0"></a>

# [1.1.0](https://github.com/nrkno/tv-automation-server-core-integration/compare/1.0.1...1.1.0) (2019-05-03)

### Features

- updated typings from Core; devices & subDevices ([3170577](https://github.com/nrkno/tv-automation-server-core-integration/commit/3170577))

<a name="1.0.1"></a>

## [1.0.1](https://github.com/nrkno/tv-automation-server-core-integration/compare/1.0.0...1.0.1) (2019-04-30)

### Bug Fixes

- update typings from core ([8e2a837](https://github.com/nrkno/tv-automation-server-core-integration/commit/8e2a837))
- update typings from core ([#23](https://github.com/nrkno/tv-automation-server-core-integration/issues/23)) ([944fa7a](https://github.com/nrkno/tv-automation-server-core-integration/commit/944fa7a))

<a name="1.0.0"></a>

# [1.0.0](https://github.com/nrkno/tv-automation-server-core-integration/compare/0.9.0...1.0.0) (2019-04-30)

### Bug Fixes

- remove built files ([bc24f52](https://github.com/nrkno/tv-automation-server-core-integration/commit/bc24f52))
- rename properties ([e7a64f9](https://github.com/nrkno/tv-automation-server-core-integration/commit/e7a64f9))
- update some interface names ([2f4f2e9](https://github.com/nrkno/tv-automation-server-core-integration/commit/2f4f2e9))
- upgrade dependencies ([014a0b5](https://github.com/nrkno/tv-automation-server-core-integration/commit/014a0b5))

### Features

- noop, just to get the next version right ([89b3cb7](https://github.com/nrkno/tv-automation-server-core-integration/commit/89b3cb7))
- update typings with copy from Core ([b2bbb74](https://github.com/nrkno/tv-automation-server-core-integration/commit/b2bbb74))

### BREAKING CHANGES

- interface to Core has changed (the big renaming)

<a name="0.9.0"></a>

# [0.9.0](https://github.com/nrkno/tv-automation-server-core-integration/compare/0.8.0...0.9.0) (2019-04-11)

### Bug Fixes

- export DDPConnectorOptions ([6fc695c](https://github.com/nrkno/tv-automation-server-core-integration/commit/6fc695c))
- increase setMaxListeners when attaching children ([1291f67](https://github.com/nrkno/tv-automation-server-core-integration/commit/1291f67))
- ts3 + lint errors ([aa59ee8](https://github.com/nrkno/tv-automation-server-core-integration/commit/aa59ee8))
- update dependencies ([ad25978](https://github.com/nrkno/tv-automation-server-core-integration/commit/ad25978))
- update jest config ([154c384](https://github.com/nrkno/tv-automation-server-core-integration/commit/154c384))
- update to ts3 and audit fix ([08df508](https://github.com/nrkno/tv-automation-server-core-integration/commit/08df508))
- update yarn.lock, rm package-lock ([a391834](https://github.com/nrkno/tv-automation-server-core-integration/commit/a391834))

### Features

- add general data-manipulation methods ([1ee437f](https://github.com/nrkno/tv-automation-server-core-integration/commit/1ee437f))
- add Queue, to be used for sequential commands ([e132575](https://github.com/nrkno/tv-automation-server-core-integration/commit/e132575))
- add spreadsheet-device type ([cd58d07](https://github.com/nrkno/tv-automation-server-core-integration/commit/cd58d07))

<a name="0.8.0"></a>

# [0.8.0](https://github.com/nrkno/tv-automation-server-core-integration/compare/0.7.0...0.8.0) (2019-02-04)

### Bug Fixes

- readable error message ([8c2c8ca](https://github.com/nrkno/tv-automation-server-core-integration/commit/8c2c8ca))

### Features

- ddp support tls-options ([d53e42d](https://github.com/nrkno/tv-automation-server-core-integration/commit/d53e42d))

<a name="0.7.0"></a>

# [0.7.0](https://github.com/nrkno/tv-automation-server-core-integration/compare/0.6.3...0.7.0) (2019-01-11)

### Bug Fixes

- throw error on missing argument ([1ce1a90](https://github.com/nrkno/tv-automation-server-core-integration/commit/1ce1a90))

### Features

- Add Media_Manager DeviceType ([0c40194](https://github.com/nrkno/tv-automation-server-core-integration/commit/0c40194))
- updated typings from Core ([d668257](https://github.com/nrkno/tv-automation-server-core-integration/commit/d668257))

<a name="0.6.3"></a>

## [0.6.3](https://github.com/nrkno/tv-automation-server-core-integration/compare/0.6.2...0.6.3) (2018-12-11)

<a name="0.6.2"></a>

## [0.6.2](https://github.com/nrkno/tv-automation-server-core-integration/compare/0.6.1...0.6.2) (2018-10-24)

### Bug Fixes

- properly close socket connection before creating a new ([c1a4470](https://github.com/nrkno/tv-automation-server-core-integration/commit/c1a4470))

<a name="0.6.1"></a>

## [0.6.1](https://github.com/nrkno/tv-automation-server-core-integration/compare/0.6.0...0.6.1) (2018-10-22)

### Bug Fixes

- update data-store dependency ([56d80df](https://github.com/nrkno/tv-automation-server-core-integration/commit/56d80df))

<a name="0.6.0"></a>

# [0.6.0](https://github.com/nrkno/tv-automation-server-core-integration/compare/0.5.1...0.6.0) (2018-10-17)

### Bug Fixes

- added mock of ddp/Core, to run tests as unit tests, rather than integration tests ([92bfbdd](https://github.com/nrkno/tv-automation-server-core-integration/commit/92bfbdd))
- const definitions ([e225c75](https://github.com/nrkno/tv-automation-server-core-integration/commit/e225c75))
- refactoring, cleaned up emitters, added watchdog to destroy(), added tests ([af885b1](https://github.com/nrkno/tv-automation-server-core-integration/commit/af885b1))
- updated data-store dependency, du to 3.0.3 containing a bug related to folder creation ([894d2ac](https://github.com/nrkno/tv-automation-server-core-integration/commit/894d2ac))

### Features

- queued method calls implementation ([040dbb7](https://github.com/nrkno/tv-automation-server-core-integration/commit/040dbb7))

<a name="0.5.1"></a>

## [0.5.1](https://github.com/nrkno/tv-automation-server-core-integration/compare/0.5.0...0.5.1) (2018-09-04)

<a name="0.5.0"></a>

# [0.5.0](https://github.com/nrkno/tv-automation-server-core-integration/compare/0.4.1...0.5.0) (2018-08-14)

### Bug Fixes

- updated dependencies ([a5f95fb](https://github.com/nrkno/tv-automation-server-core-integration/commit/a5f95fb))

### Features

- added "ping" function, making a ping to the core. Only pinging when the watchdog isn't doing its stuff. ([75435e0](https://github.com/nrkno/tv-automation-server-core-integration/commit/75435e0))
- because ddp.connect() is async, createClient must also be asynchronous. ([8e34ae0](https://github.com/nrkno/tv-automation-server-core-integration/commit/8e34ae0))

<a name="0.4.1"></a>

## [0.4.1](https://github.com/nrkno/tv-automation-server-core-integration/compare/0.4.0...0.4.1) (2018-08-03)

### Bug Fixes

- bug in collection.find using function selector ([59847ff](https://github.com/nrkno/tv-automation-server-core-integration/commit/59847ff))

<a name="0.4.0"></a>

# [0.4.0](https://github.com/nrkno/tv-automation-server-core-integration/compare/0.3.2...0.4.0) (2018-07-04)

### Features

- Add segmentLineItemPlaybackStarted callback ([8823613](https://github.com/nrkno/tv-automation-server-core-integration/commit/8823613))

<a name="0.3.2"></a>

## [0.3.2](https://github.com/nrkno/tv-automation-server-core-integration/compare/0.3.1...0.3.2) (2018-06-26)

### Bug Fixes

- refactoring & how events are fired ([2a2966d](https://github.com/nrkno/tv-automation-server-core-integration/commit/2a2966d))
- updated ddp dependency ([5d09770](https://github.com/nrkno/tv-automation-server-core-integration/commit/5d09770))

<a name="0.3.1"></a>

## [0.3.1](https://github.com/nrkno/tv-automation-server-core-integration/compare/0.3.0...0.3.1) (2018-06-25)

### Bug Fixes

- updated data-store dep to fork, awaiting PR ([303ec5b](https://github.com/nrkno/tv-automation-server-core-integration/commit/303ec5b))

<a name="0.3.0"></a>

# [0.3.0](https://github.com/nrkno/tv-automation-server-core-integration/compare/0.2.0...0.3.0) (2018-06-25)

### Bug Fixes

- removing listeners upon destruction ([5df77c3](https://github.com/nrkno/tv-automation-server-core-integration/commit/5df77c3))

### Features

- added autoSubscribe method, that automatically renews subscriptions upon reconnection ([46c4c07](https://github.com/nrkno/tv-automation-server-core-integration/commit/46c4c07))

<a name="0.2.0"></a>

# [0.2.0](https://github.com/nrkno/tv-automation-server-core-integration/compare/0.1.2...0.2.0) (2018-06-20)

### Features

- added watchDog ([2c03b58](https://github.com/nrkno/tv-automation-server-core-integration/commit/2c03b58))

<a name="0.1.2"></a>

## [0.1.2](https://github.com/nrkno/tv-automation-server-core-integration/compare/0.1.1...0.1.2) (2018-06-18)

<a name="0.1.1"></a>

## [0.1.1](https://github.com/nrkno/tv-automation-server-core-integration/compare/0.1.0...0.1.1) (2018-06-15)

<a name="0.1.0"></a>

# 0.1.0 (2018-06-15)

### Bug Fixes

- bugfix ([0fd20e6](https://bitbucket.org/nrkno/tv-automation-server-core-integration/commits/0fd20e6))
- explicitly set request version in dependency to prevent voulnerability ([b0d0880](https://bitbucket.org/nrkno/tv-automation-server-core-integration/commits/b0d0880))
- lint errors ([294bb92](https://bitbucket.org/nrkno/tv-automation-server-core-integration/commits/294bb92))
- readme and new ssh fingerprint ([a6031c8](https://bitbucket.org/nrkno/tv-automation-server-core-integration/commits/a6031c8))
- remove ssh keys accidentally added to the repo ([d1d3942](https://bitbucket.org/nrkno/tv-automation-server-core-integration/commits/d1d3942))
- yarn update to hopefully fix npm package voulnerability ([ee95c5d](https://bitbucket.org/nrkno/tv-automation-server-core-integration/commits/ee95c5d))

### Features

- added connectionId ([f26fe54](https://bitbucket.org/nrkno/tv-automation-server-core-integration/commits/f26fe54))
- basic functionality and tests ([8feef39](https://bitbucket.org/nrkno/tv-automation-server-core-integration/commits/8feef39))
- CircleCI features ([2a1b730](https://bitbucket.org/nrkno/tv-automation-server-core-integration/commits/2a1b730))
- linting & added credentials generator ([851e6f8](https://bitbucket.org/nrkno/tv-automation-server-core-integration/commits/851e6f8))
- Rename package ([99e4fdf](https://bitbucket.org/nrkno/tv-automation-server-core-integration/commits/99e4fdf))
- support for having multiple mosdevices over same core-connection. Also added methods for mos data piping ([cf21e67](https://bitbucket.org/nrkno/tv-automation-server-core-integration/commits/cf21e67))
- timesync implementation ([9b38df3](https://bitbucket.org/nrkno/tv-automation-server-core-integration/commits/9b38df3))
