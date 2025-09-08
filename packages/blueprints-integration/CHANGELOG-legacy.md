# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [2.5.0](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/compare/2.4.0...2.5.0) (2020-12-08)

### Features

- api for blueprints to manage ab player sessions with partInstance awareness ([#82](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/issues/82)) [publish] ([666b18c](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/666b18c52d250ff4f6af8f51a5d8ce2f48e117e6))

## [2.4.0](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/compare/2.3.1...2.4.0) (2020-11-10)

### Features

- add property description to Rundown ([1c5c81e](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/1c5c81e638e6ad3dafe74900b4b8d266c6c7ece5))
- update policies ([#80](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/issues/80)) ([5f600de](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/5f600dea6cd4b286b06d49d541ba802cd0abd78c))

### [2.3.1](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/compare/2.3.0...2.3.1) (2020-09-30)

## [2.3.0](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/compare/2.2.1...2.3.0) (2020-09-30)

### Features

- add TimelineEventContext for use in onTimelineGenerate, to allow the current and next part to be provided (if they are set) [publish] ([e8ed966](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/e8ed9664aee1c3b9562ae85e07fa1259e6ca19a3))
- Allow adlib actions to call take ([e5b1008](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/e5b10087a2e726005062e337bfa829436ecf89a9))
- move playout properties from Part to PartInstance [publish] ([6edbee3](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/6edbee33520ab44a75ab2ca70e0b81f6f51614c6))
- replace some key-value interfaces with unknown [publish] ([7346f2f](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/7346f2fa61104ba03aa550f8ed780d3c4e5452f7))
- Tally tags ([#74](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/issues/74)) ([a0fc99b](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/a0fc99b9e299e67f6c4b252cd97db907384dc04d))

### [2.2.1](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/compare/2.2.0...2.2.1) (2020-09-28)

## [2.2.0](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/compare/2.1.0...2.2.0) (2020-09-28)

### Features

- Add JSON entry type ([0a27dee](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/0a27dee5887521f513eeea35b217baa30de05d79))
- add parseConfig callback to blueprint manifests ([133e238](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/133e238ab77fe1a06453e49aa25781697e68750c))
- expose more functions to adlib-actions ([#68](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/issues/68)) ([0e4f14d](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/0e4f14d0ca43516bc9c821c7692aa9b7acaacd8d))
- Multiline strings ([83498fb](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/83498fb0cb6aa1addb0cf3163ce79424eb2c940e))
- remove runtime arguments api [publish] ([d49f7dd](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/d49f7dd943612eb73868fea1728efa00339eb07e))
- use PieceInstance.\_id in timeline piece group ids ([88f8e83](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/88f8e83cba6a98dc44e723244c1fce078e3d3b2f))

### Bug Fixes

- change any to unknown for better types ([80239dc](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/80239dc6a677f396069074e01f9edc960526ee20))
- return configs as unknown ([07a0431](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/07a0431a939cd25916f799aa2c8851178e0b514d))

## [2.1.0](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/compare/2.0.0...2.1.0) (2020-08-17)

### Features

- add ExtendedIngestRundown type, to allow blueprint to use properties from Core, that are not present in IngestRundown ([290d35e](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/290d35eb2947b378c799dce4ab303181819b7369))

### Bug Fixes

- remove externalId from BlueprintResultRundownPlaylist, since Core shouldn't use that anyway (the playlist.externalId is tied to the rundown that initiated the call to getRundownPlaylistInfo) ([0b94097](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/0b94097d9d24dccb381026a1e96a65938c2110d3))

## [2.0.0](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/compare/1.12.0...2.0.0) (2020-06-16)

### ⚠ BREAKING CHANGES

- drop node 8 support

### Features

- a proposal to allow adlib piece-like metadata on an adlib action to provide UI information like thumbnails, sourceDuration, etc. ([64cbef6](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/64cbef6c2f8293d50ad62dfc34e04054240f0bb8))
- add custom mongo filtering to action.findLastPieceOnLayer [publish](<[7d18cb0](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/7d18cb0595dbc2895cbdde1484d358f49c758a4b)>)
- add dynamicallyInserted to IBlueprintPartDB [publish](<[eeca279](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/eeca279a57e7b0d5a14c6cc0b131d02feb047df4)>)
- add rank to adlib actions ([b5bbc4a](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/b5bbc4aa9a6a5f19cc3801f436eb735551307b9d))
- change segmentId to partId like in AdLibs [publish](<[b7f5329](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/b7f53295056ef3e060454f38ea125b627d8d45b3)>)
- drop node 8 support ([b67be0e](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/b67be0ea645cd80a694dca9c0b2a8815b635c6ff))
- first draft of adlib-actions api [publish](<[95a475c](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/95a475cfb2cc32a444ba781080d6449c748d6103)>)
- more properties related to queuedForLater asRun messages ([371a7c2](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/371a7c2dddf4ac5f0237a34470dd248bdcc80f80))
- support for asRunLog events for when rundown data has changed ([0a1986c](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/0a1986cdf61251bc6da57e15214cd0e65ffa8aea))
- support for asRunLog messages that can be queued to be sent later, and picked up to be updated ([70ce9fc](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/70ce9fc9c05ba5076e87353099854fe04c7bedd1))
- update ActionExecutionContext ([a71dfd6](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/a71dfd6fbd3cf6edb11c66c5bfa516fe5c87886b))

### Bug Fixes

- tweaks during tests [publish](<[364d344](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/364d34457fd3e02fe5c8e0eaef11e9f5cb83dc4b)>)
- use only queueForLaterReason ([ae364c1](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/ae364c10d4d3a91db4184558a89e0d8347cd2542))

## [1.12.0](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/compare/1.11.0...1.12.0) (2020-05-28)

### Features

- Add Select type to config manifest ([1f0f58e](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/1f0f58e1aaf01d08de42ab4cb6cd33dd78a3b549))
- Add transition properties to adlibs ([9c1457e](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/9c1457ef3a1f6f8f63d39793e23902a451c76047))
- mos plugin data ingest ([5a77cb7](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/5a77cb7c36661bf87b2144eeccb567bc94ae4d59))
- option to preserve keyframes in lookahead, and give events the current time [publish](<[38735c5](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/38735c592a98188616a1cbc6e3d3d647bdf9fae1)>)
- Table column ranks ([2214d26](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/2214d267b0f264f3f0c15330d48612385bb08050))

## [1.11.0](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/compare/1.10.0...1.11.0) (2020-05-06)

### Features

- add lookaheadMaxSearchDepth property to mappings ([d92f60f](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/d92f60f64080bc605781a02819c8abd018cb79f2))
- add metaData field to timeline object keyframes ([2227640](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/2227640986dd9830781c5ba780ff239f6fdb924e))
- add stickyOriginalOnly property ([0d1725b](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/0d1725b7df5aa2977cbc2ebed575358c0666203d))
- expectedPlayoutItems ([42b45b1](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/42b45b15c35d1c7388fd63f2915c2a01df7d596d))
- introduce isDefaultCollapsed and isFlattened ([c5f2507](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/c5f25077603bb323a9336d0ad2b0bb3028c15e45))
- Make sourceDuration optional ([a70a8a2](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/a70a8a2a09bf592d25b562ce8e3998b8324a721c))
- Out-of-order playback timing and playlist looping ([#59](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/issues/59)) [publish](<[c7ad522](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/c7ad522a2d46d69dfc3bf2b1f79caa8173f4d049)>)
- Property to force adlibs to be inserted queued ([6111ea1](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/6111ea1361192a43dd37e393e8a05ff7361a9b4e))
- use experimental TSR version [publish](<[f8d5cc7](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/f8d5cc7ad7f13e68636e4fddf804f79717e69688)>)
- **hidden:** allow hiding the segment in the UI ([82de87d](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/82de87d1ff9797d9483c8349859ae0689755b2c5))
- **identifier:** add an optional identifier to the segment ([2e879e9](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/2e879e9c459d7f95a02b964d854cf047893cf52e))

### Bug Fixes

- DeviceOptionsAny ([88748d3](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/88748d3f90a4d7edaad19e2f78460fe85307fbfa))
- merge marker ([2d1978d](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/2d1978dee5c7e44c63e9ab5d6159ae1ea6bdb9b4))
- missing export ([894fe36](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/894fe361fb33fad093250db6dd18e5122ce02600))
- non-adlib pieces need to set toBeQueued ([fdf5a38](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/fdf5a38389beed024c8d690da7a7146de015476f))
- try different git url ([c1a511e](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/c1a511e8ac2b1fcc78ee2e850127383f8c2ba332))
- update TSR-types dep ([d8c3eb8](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/d8c3eb83d763de7c7476022dd1c4b3299ecc9ddb))
- use TSR types for ExpectedPlayoutItems [publish](<[45e602f](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/45e602fe0af68678499199082099e3e7546094f1)>)

## [1.10.0](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/compare/1.9.0...1.10.0) (2020-03-24)

### Features

- **ci:** option to ignore security audits ([428708d](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/428708ded180c7097cc2e15a4dbdb0b5ce15bca0))
- **identifier:** add an optional identifier to the segment ([b84feca](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/b84feca4744c4cb13d1825b6f45bc66cb2a6b82b))
- **identifier:** optional part identifier ([1746de5](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/1746de54f900172d8546076277d7f45e09a1e007))
- remove LookaheadMode.RETAIN (breaking change) [publish](<[1b999a3](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/1b999a3d5b8efc84e0f7268292a100657ff0fae1)>)
- ResolvedPieceInstance (breaking change) ([22bea64](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/22bea6463e3d9ec1d34958e30ce134bdf41bd943))
- restructure NotesContext ([40ec784](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/40ec7841d7488065154a329fb9225767a1fae4ab))

### Bug Fixes

- OnGenerateTimelineObj references pieceInstanceId not pieceId [publish](<[c1eeeb1](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/c1eeeb138a064f95b118740ccd76f3ad9b5b5465)>)
- update for changes required by metadata [publish](<[bc70e01](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/bc70e0113915565e3877d9e7d137847fa4db0c33)>)

## [1.9.0](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/compare/1.8.0...1.9.0) (2020-02-21)

### Features

- gap parts ([#56](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/issues/56)) ([2e84199](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/2e841995d0bec7a9e79ba909133990e1738bbf8c))

## [1.8.0](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/compare/1.7.0...1.8.0) (2020-02-19)

### Features

- add isHidden property to segment [publish](<[a12f6c7](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/a12f6c7667e91e2872521f5b99ba9d69a9ea5715)>)
- add toBeQueued to pieces [publish](<[002a2b5](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/002a2b50e9902654cc23eb5383bba3c763abdd76)>)
- publish prereleases of branches ([2415a7f](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/2415a7f141380f99a3caf43794dcf5cfc93f3d71))

## [1.7.0](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/compare/1.6.0...1.7.0) (2020-01-07)

### Features

- option to treat piece as a static asset and skip some checks ([a7fc8c8](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/a7fc8c8254009a14c8e1650675d18c0402395f1b))

## [1.6.0](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/compare/1.5.0...1.6.0) (2019-12-13)

### Features

- add blueprintId field to manifests ([63d046a](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/63d046aafdbf9be9e4c8f6823ed270689aa39c14))
- implement invalidReason ([#49](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/issues/49)) ([8db5e4e](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/8db5e4e0fa4068b2716630666650fd55aa599b99))

## [1.5.0](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/compare/1.4.2...1.5.0) (2019-12-06)

### Features

- support floated parts and floated adLibs ([f073d98](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/f073d9858c9346062406fbe61fd2b3d8033bbb3f))

### [1.4.2](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/compare/1.4.1...1.4.2) (2019-12-03)

### [1.4.1](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/compare/1.4.0...1.4.1) (2019-12-03)

## [1.4.0](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/compare/1.3.0...1.4.0) (2019-12-02)

### Features

- re-export tsr-types ([9594844](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/9594844cdafaf5b84c3464845a3d3f1e46e03543))

## [1.3.0](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/compare/1.2.1...1.3.0) (2019-11-22)

### Features

- add piece transitions properties, with simple typings ([eda59aa](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/eda59aa2dc19776e0389ffed05bb57b875d184fd))

### [1.2.1](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/compare/1.2.0...1.2.1) (2019-11-14)

### Bug Fixes

- update typings after TSR update ([925614d](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/925614d460c548d5119f2d924eefda787df48a8d))

## [1.2.0](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/compare/1.1.0...1.2.0) (2019-10-29)

### Features

- add prettier ([344eef3](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/344eef3d8507ed7b0cb5cbeead8e32c930eebf0e))
- tighten up typings on migration context interfaces ([c1927fc](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/c1927fccb9623151ec6abd4de04db69b081b39d9))
- update ci to run for node 8,10,12 ([8ddedd3](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/8ddedd3963966e8bb07eba24b3c04caab00c40a0))

### Bug Fixes

- SplitsContent typings are split into more interfaces, and timelineObjects removed from the boxConfigs ([9753a44](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/9753a4427bec5aa61d492318fa934ac2f82d6210))

## [1.1.0](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/compare/1.0.1...1.1.0) (2019-10-11)

### Bug Fixes

- improve getRundownPlaylistInfo ([f2dd56e](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/f2dd56e))
- move getRundownPlaylistInfo result into an interface ([50ff6c3](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/50ff6c3))

### Features

- config-manifest table type ([99574b7](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/99574b7))
- support hinting/asking about RundownPlaylists ([98d5ad7](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/98d5ad7))

### [1.0.1](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/compare/1.0.0...1.0.1) (2019-10-02)

### Bug Fixes

- onTimelineGenerate incorrect context type ([51c1a26](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/51c1a26))
- onTimelineGenerate incorrect context type ([#46](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/issues/46)) ([1250a78](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/1250a78))

## [1.0.0](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/compare/0.24.1...1.0.0) (2019-09-30)

### Bug Fixes

- expose blueprintId on IBlueprintShowStyleBase for show style selection ([ace4ecc](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/ace4ecc))
- move metaData field to TimelineObjectCoreExt instead of being defined within the blueprint typings ([3c96a2c](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/3c96a2c))

### Features

- allow for blueprint-specified tags on adLib pieces ([e5963a5](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/e5963a5))
- allow specifying box geometry in SplitsContent ([f11a49f](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/f11a49f))
- expose externalPayload on NoraContent ([94560a0](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/94560a0))
- expose nora renderer url to UI ([71182cd](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/71182cd))
- remove studio config & migrations from show style blueprints ([1017cc2](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/1017cc2))

### [0.24.1](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/compare/0.24.0...0.24.1) (2019-08-06)

### Bug Fixes

- downgrade gh-pages ([01343fb](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/01343fb))

### Features

- expose infinite ids of pieces to onTimelineGenerate ([401f30d](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/401f30d))
- persistant state to onTimelineGenerate ([713c048](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/713c048))

## [0.24.0](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/compare/0.23.0...0.24.0) (2019-06-18)

### Bug Fixes

- linter errors ([f445f42](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/f445f42))

### Features

- persisted Part EndState ([c714d7e](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/c714d7e))

## [0.23.0](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/compare/0.22.0...0.23.0) (2019-05-22)

### Features

- Add external message retry until. ([d19616b](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/d19616b))

## [0.22.0](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/compare/0.21.0...0.22.0) (2019-05-21)

### Bug Fixes

- Update dependencies ([7732177](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/7732177))

### Features

- Replace Piece.start with a limited TimelineEnable object ([8d153e2](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/8d153e2))
- Update typings for timeline-v2 ([6bdc139](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/6bdc139))
- Use enable.duration instead of expectedDuration for Pieces ([c8bef7f](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/c8bef7f))

<a name="0.21.0"></a>

# [0.21.0](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/compare/0.20.0...0.21.0) (2019-04-24)

### Features

- Add external message retry until. ([5247951](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/5247951))

<a name="0.20.0"></a>

# [0.20.0](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/compare/0.19.0...0.20.0) (2019-04-24)

### Bug Fixes

- build ([41d53b0](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/41d53b0))
- correct name of adlib pieces ([1895941](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/1895941))
- Fix some extra/missing fields ([2358b2e](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/2358b2e))
- Getting cached ingest data during AsRunLog may return undefined ([08da3b5](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/08da3b5))
- missing exports ([a594bbc](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/a594bbc))
- renaming of files ([693cb22](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/693cb22))
- tests ([edbd934](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/edbd934))

### Features

- Refacor sli and adlib types ([e6fc888](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/e6fc888))
- Refactor typings for simpler ingest gateway interface ([5edd6e5](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/5edd6e5))
- rename everything according to new naming schedule ([54268c5](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/54268c5))
- split some types into simpler ones ([0a7fb06](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/0a7fb06))
- update context types ([9e0ec01](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/9e0ec01))

# [0.19.0](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/compare/0.18.1...0.19.0) (2019-04-11)

### Features

- add editable property to BaseContent/VTContent ([5694206](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/5694206))

## [0.18.1](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/compare/0.18.0...0.18.1) (2019-04-10)

### Bug Fixes

- improve the getHashId interface, to account for non-unique input ([29029d2](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/29029d2))

# [0.18.0](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/compare/0.17.0...0.18.0) (2019-04-08)

### Bug Fixes

- Add id to IBlueprintShowStyleBase type ([a6d8c32](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/a6d8c32))
- Add type for a set of blueprints ([0fd5cea](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/0fd5cea))
- various changes to studio blueprints ([78f3672](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/78f3672))

### Features

- Give studio blueprint access to list of mappings ([97eeb17](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/97eeb17))
- prototype system and studio blueprints ([6e8ed67](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/6e8ed67))

# [0.17.0](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/compare/0.16.0...0.17.0) (2019-04-01)

### Features

- invalid part & AdLib ([97cdd2d](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/97cdd2d))

# [0.16.0](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/compare/0.15.0...0.16.0) (2019-03-27)

### Features

- Add transitionDuration to Part ([f7337bf](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/f7337bf))

# [0.15.0](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/compare/0.14.1...0.15.0) (2019-03-25)

### Features

- Add support for enum config types ([429ae1c](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/429ae1c))

## [0.14.1](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/compare/0.14.0...0.14.1) (2019-03-19)

# [0.14.0](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/compare/0.13.1...0.14.0) (2019-03-14)

### Features

- Add displayDuration properties to Parts, and allow for setting the displayDurationGroup ones in post-process blueprint ([439c84d](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/439c84d))

<a name="0.12.0"></a>

# [0.12.0](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/compare/0.11.0...0.12.0) (2019-01-21)

### Bug Fixes

- Add tsr-types as a dev dependency to fix build issues ([159cb59](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/159cb59))
- Change tsr-types to a peer dependency, to allow other versions of tsr-types to be used in projects ([e76029b](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/e76029b))

### Features

- add header ([f51ee9b](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/f51ee9b))
- change mediaFlowId into mediaFlowIds ([fcaad98](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/fcaad98))

<a name="0.11.0"></a>

# [0.11.0](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/compare/0.10.0...0.11.0) (2019-01-16)

### Features

- **migrations:** Add show style runtime arguments to migrations ([b9d055b](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/b9d055b))

<a name="0.10.0"></a>

# [0.10.0](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/compare/0.9.0...0.10.0) (2019-01-11)

### Bug Fixes

- Tidy todos ([1744867](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/1744867))

### Features

- Add classes arrays to Part ([0911caf](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/0911caf))
- add ConfigRef function, to be able to reference config values, instead of using the values directly (can be used for usernames & passwords in metadata message flow) ([efa467e](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/efa467e))

<a name="0.9.0"></a>

# [0.9.0](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/compare/0.8.0...0.9.0) (2019-01-08)

### Bug Fixes

- add AsRunLogEventContent ([11a2cf0](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/11a2cf0))

### Features

- add mediaFlowId to VTContent ([8e505b4](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/8e505b4))
- asRunEventContext: add getPiece & getPiece ([bc1e58c](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/bc1e58c))

<a name="0.8.0"></a>

# [0.8.0](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/compare/0.7.0...0.8.0) (2018-12-11)

### Bug Fixes

- add missing enum export ([2e74bc0](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/2e74bc0))

### Features

- add asRunEvent methods ([92772c4](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/92772c4))

<a name="0.7.0"></a>

# [0.7.0](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/compare/0.6.2...0.7.0) (2018-12-10)

### Bug Fixes

- AsRunLogEvent: add \_id ([27f8db0](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/27f8db0))

### Features

- **migrations:** Expose method to get the full variant id ([1e59893](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/1e59893))

<a name="0.6.2"></a>

## [0.6.2](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/compare/0.6.1...0.6.2) (2018-12-03)

### Bug Fixes

- PartContext typings ([f98765c](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/f98765c))

<a name="0.6.1"></a>

## [0.6.1](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/compare/0.6.0...0.6.1) (2018-11-30)

### Bug Fixes

- fixed IMessageBlueprintPart and removed Pure interfaces because they are stupid. ([0fb1f3e](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/0fb1f3e))

<a name="0.6.0"></a>

# [0.6.0](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/compare/0.5.7...0.6.0) (2018-11-30)

### Bug Fixes

- bug in iterateDeeplyAsync ([7b2e5b5](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/7b2e5b5))
- case sensitive import paths ([ca94cdb](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/ca94cdb))
- **migrations:** Blueprints specify variant id, to make it possible to update one later on ([d4ad8a4](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/d4ad8a4))
- linter error ([16cec3a](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/16cec3a))
- onTakes should have PartContextPure ([14eb7b2](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/14eb7b2))
- update tsr-types ([41a4583](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/41a4583))

### Features

- **migrations:** Add playout-device migration methods to studio migration context ([6e1ecb0](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/6e1ecb0))
- fixed API for eventCallbacks, and split interfaces into "Pure" (which doesn't contain the UI-centric NotesContext) and normal ([ddfa0ab](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/ddfa0ab))
- renamed & reworked API ([fc51f11](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/fc51f11))

<a name="0.5.7"></a>

## [0.5.7](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/compare/0.5.6...0.5.7) (2018-11-28)

### Bug Fixes

- missing dependencies ([6be0633](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/6be0633))

<a name="0.5.6"></a>

## [0.5.6](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/compare/0.5.5...0.5.6) (2018-11-26)

<a name="0.5.5"></a>

## [0.5.5](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/compare/0.5.4...0.5.5) (2018-11-23)

### Bug Fixes

- migration interface typing tweaks ([e2f9666](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/e2f9666))

<a name="0.5.4"></a>

## [0.5.4](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/compare/0.5.3...0.5.4) (2018-11-23)

### Bug Fixes

- add missing ConfigItemValue types ([2ab6e33](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/2ab6e33))

<a name="0.5.3"></a>

## [0.5.3](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/compare/0.5.2...0.5.3) (2018-11-22)

### Bug Fixes

- config default value type ([11caa0e](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/11caa0e))
- proper enum exports & fixed tests ([ac7e82a](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/ac7e82a))

<a name="0.5.2"></a>

## [0.5.2](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/compare/0.5.1...0.5.2) (2018-11-22)

### Bug Fixes

- mos-connection typings: add full classes for data types. (They are needed downstream in Core..) ([eb57f04](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/eb57f04))

<a name="0.5.1"></a>

## [0.5.1](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/compare/0.5.0...0.5.1) (2018-11-22)

### Bug Fixes

- export mos typings ([0edff3f](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/0edff3f))

<a name="0.5.0"></a>

# [0.5.0](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/compare/0.4.1...0.5.0) (2018-11-22)

### Bug Fixes

- migration interfaces touchups ([aa8257b](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/aa8257b))
- removed dependency mos-connection and replaced with internal copy ([c2963ba](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/c2963ba))
- removed dependency of superfly-timeline and replaced with types from TSR-types ([480408e](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/480408e))
- tighten type of configItem ([57ff2c1](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/57ff2c1))
- type ref ([ed000c6](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/ed000c6))
- update dependencies ([e26fd9b](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/e26fd9b))
- update TSR-types dependency ([b6bfcab](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/b6bfcab))
- update typedoc dep ([0c0c508](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/0c0c508))

### Features

- **migrations:** Add context to migration validate and migrate functions. ([93b555e](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/93b555e))
- **migrations:** Add types for blueprint based migrations ([0d0d99b](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/0d0d99b))

<a name="0.4.1"></a>

## [0.4.1](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/compare/0.4.0...0.4.1) (2018-11-21)

### Bug Fixes

- **rundown:** Correct types of transisition duration properties on Part ([b0aec50](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/b0aec50))

<a name="0.4.0"></a>

# [0.4.0](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/compare/0.3.1...0.4.0) (2018-11-20)

### Bug Fixes

- Change types of transition timings on segmentline ([0a7ba6b](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/0a7ba6b))
- reverting splitting configManifest ([cf9a68b](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/cf9a68b))

### Features

- split configs into studio-configs & show-configs ([2d95741](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/2d95741))

<a name="0.3.1"></a>

## [0.3.1](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/compare/0.3.0...0.3.1) (2018-11-19)

### Bug Fixes

- **config:** Missing export in index.ts ([5e70d2d](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/5e70d2d))

<a name="0.3.0"></a>

# [0.3.0](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/compare/0.2.0...0.3.0) (2018-11-19)

### Features

- Add config manifests ([4bfd30a](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/4bfd30a))
- Add minimum core version field ([3817ce3](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/3817ce3))

<a name="0.2.0"></a>

# [0.2.0](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/compare/0.1.5...0.2.0) (2018-11-15)

### Features

- Add blueprint runtime arguments ([1676711](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/1676711))

<a name="0.1.5"></a>

## [0.1.5](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/compare/0.1.4...0.1.5) (2018-11-08)

### Bug Fixes

- attempt to fix npm package not including dist files ([744b2b6](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/744b2b6))

<a name="0.1.4"></a>

## [0.1.4](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/compare/v0.1.3...v0.1.4) (2018-11-08)

### Bug Fixes

- prevent infinite release loop ([a2dd894](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/a2dd894))

<a name="0.1.3"></a>

## [0.1.3](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/compare/v0.1.2...v0.1.3) (2018-11-08)

<a name="0.1.2"></a>

## [0.1.2](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/compare/v0.1.1...v0.1.2) (2018-11-08)

<a name="0.1.1"></a>

## [0.1.1](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/compare/v0.1.0...v0.1.1) (2018-11-08)

<a name="0.1.0"></a>

# 0.1.0 (2018-11-08)

### Bug Fixes

- add index.ts ([200af13](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/200af13))
- Add missing iterateDeeplyAsync ([4ab0127](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/4ab0127))
- added devDependencies ([8d9ad46](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/8d9ad46))
- build ([8f825af](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/8f825af))
- enum used before declaration ([6dce53e](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/6dce53e))
- Loosen typings to reduce polluting core with unnecessary types ([e1ec803](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/e1ec803))
- Remove getHash as it leaves a require in the built blob ([dba6e77](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/dba6e77))
- Update to release supertimeline ([b25e920](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/b25e920))

### Features

- added scripts and tests stub. also preparing for CI ([bedfeb3](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/bedfeb3))
- Simplify some typings ([9a2c2eb](https://github.com/nrkno/tv-automation-sofie-blueprints-integration/commit/9a2c2eb))
