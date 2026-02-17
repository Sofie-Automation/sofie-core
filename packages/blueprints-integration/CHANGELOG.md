# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [26.3.0-1](https://github.com/Sofie-Automation/sofie-core/compare/v26.3.0-0...v26.3.0-1) (2026-02-11)

**Note:** Version bump only for package @sofie-automation/blueprints-integration





# [26.3.0-0](https://github.com/Sofie-Automation/sofie-core/compare/v1.52.0...v26.3.0-0) (2026-02-04)


### Bug Fixes

* add plannedStartedPlayback and plannedStoppedPlayback to IBlueprintPartInstanceTimings interface ([#1515](https://github.com/Sofie-Automation/sofie-core/issues/1515)) ([9e8ee71](https://github.com/Sofie-Automation/sofie-core/commit/9e8ee71863a8b00be521a2325b2375f03a32956c))
* missing export ([7956f7b](https://github.com/Sofie-Automation/sofie-core/commit/7956f7bba509d892389bb3c564312da730c0495b))
* remove unimplemented return type of blueprint executeAction ([5e74d4f](https://github.com/Sofie-Automation/sofie-core/commit/5e74d4ff2b5322683d6bb2bff1bc228ec9709ec8))


### Features

* add BlueprintAssetIcon component ([e05afd6](https://github.com/Sofie-Automation/sofie-core/commit/e05afd68386fbdcc7e21c23ef60f3f138048df78))
* add getUpcomingParts method to OnSetAsNextContext ([#1577](https://github.com/Sofie-Automation/sofie-core/issues/1577)) ([aba5ed4](https://github.com/Sofie-Automation/sofie-core/commit/aba5ed42b51e7132c2d1c50878b260aa268989b3))
* Add getUpcomingParts to action context ([#1524](https://github.com/Sofie-Automation/sofie-core/issues/1524)) ([0d1552d](https://github.com/Sofie-Automation/sofie-core/commit/0d1552dca9fc3f3dbaa94a8edb7f0f25c369f7dc))
* Add support for Gateway configuration from the studio API ([#1539](https://github.com/Sofie-Automation/sofie-core/issues/1539)) ([963542a](https://github.com/Sofie-Automation/sofie-core/commit/963542aa060f7db768d47a1d7e4e1f25367bb321))
* allow adlib-actions to be marked as invalid ([#1609](https://github.com/Sofie-Automation/sofie-core/issues/1609)) ([6271ffd](https://github.com/Sofie-Automation/sofie-core/commit/6271ffd8bef5abe5691fa7b726209fc7d3758341))
* allow part to be queued from onTake ([#1497](https://github.com/Sofie-Automation/sofie-core/issues/1497)) ([1a6619f](https://github.com/Sofie-Automation/sofie-core/commit/1a6619f42d1c7621faf10238edbcde646ef2eb33))
* Allow restricting dragging to current part ([e9f66e7](https://github.com/Sofie-Automation/sofie-core/commit/e9f66e7e21e577822eb432f85f62c80770d5a5f2))
* **blueprints-integration:** Add isRehearsal property to action contexts ([8d923a5](https://github.com/Sofie-Automation/sofie-core/commit/8d923a5e627ea50764eefa8cd2c345373c86453f))
* cleanup media manager support ([#1509](https://github.com/Sofie-Automation/sofie-core/issues/1509)) ([76dfbd2](https://github.com/Sofie-Automation/sofie-core/commit/76dfbd2fa8cd18bda5713484c40e5bfe5c838529))
* **EAV-603:** add `manuallySelected` to OnSetAsNextContext ([ec1114e](https://github.com/Sofie-Automation/sofie-core/commit/ec1114e99c77bd395cf69912e92527d91afcc845))
* edit mode for drag operations ([4347c6a](https://github.com/Sofie-Automation/sofie-core/commit/4347c6ad0762ed5081c377aa92841bebfb5800c6))
* expose getSegment in blueprint context ([e727028](https://github.com/Sofie-Automation/sofie-core/commit/e7270281ccd3cde2ac6490f34055f039cf24404a))
* expose persistent playout store to more methods ([ab7c6bc](https://github.com/Sofie-Automation/sofie-core/commit/ab7c6bc116b768dd030c9160a90554db37880762))
* GW config types in Blueprints ([c8e669f](https://github.com/Sofie-Automation/sofie-core/commit/c8e669f333010cc88930d1684bd2d2795104cc88))
* implement Bucket Panel Icon ([fbcc6e8](https://github.com/Sofie-Automation/sofie-core/commit/fbcc6e8eeb780b24f7595b5386e729ea9d1dda9a))
* mos status flow rework ([#1356](https://github.com/Sofie-Automation/sofie-core/issues/1356)) ([672f2bd](https://github.com/Sofie-Automation/sofie-core/commit/672f2bd2873ae306db9dfcbbc3064fdcc9ea1cd0))
* move GW config types to generated in shared lib ([f54d9ca](https://github.com/Sofie-Automation/sofie-core/commit/f54d9ca63bc00a05915aac45e0be5b595c980567))
* optional studioLabelShort for presenters view ([cf62762](https://github.com/Sofie-Automation/sofie-core/commit/cf6276289b3bc47df3635b34ca75994ccc37713b))
* PieceGeneric type - optional nameShort and nameTruncated ([c7d87a7](https://github.com/Sofie-Automation/sofie-core/commit/c7d87a7b463a4dbb546e967f87620badedfd0046))
* replace `wasActive` in onRundownActivate with context ([#1514](https://github.com/Sofie-Automation/sofie-core/issues/1514)) ([007a9da](https://github.com/Sofie-Automation/sofie-core/commit/007a9da74583702b347c613e5aed8514422d5c3d))
* retime piece user action ([385e884](https://github.com/Sofie-Automation/sofie-core/commit/385e884e8f3f9d1165fcfa06af649d5af951b516))
* Set sub-device peripheralDeviceId from deviceOptions parentDeviceName ([#1505](https://github.com/Sofie-Automation/sofie-core/issues/1505)) ([4d34cec](https://github.com/Sofie-Automation/sofie-core/commit/4d34cecac83929d999b088423f98fd9b787c0c31))
* support custom types from tsr plugins ([#1585](https://github.com/Sofie-Automation/sofie-core/issues/1585)) ([3bae757](https://github.com/Sofie-Automation/sofie-core/commit/3bae7576ede0e2f71cf9882e6f2c1ac5589d9b63))
* time of day pieces ([#1406](https://github.com/Sofie-Automation/sofie-core/issues/1406)) ([2500780](https://github.com/Sofie-Automation/sofie-core/commit/25007807845e03e92c17e623c159611f89703672))
* update meteor to 3.3.2 ([#1529](https://github.com/Sofie-Automation/sofie-core/issues/1529)) ([9bd232e](https://github.com/Sofie-Automation/sofie-core/commit/9bd232e8f0561a46db8cc6143c5353d7fa531206))





# [1.52.0](https://github.com/Sofie-Automation/sofie-core/compare/v1.52.0-in-testing.1...v1.52.0) (2025-06-30)

**Note:** Version bump only for package @sofie-automation/blueprints-integration





# [1.52.0-in-testing.1](https://github.com/Sofie-Automation/sofie-core/compare/v1.51.7...v1.52.0-in-testing.1) (2025-06-05)


### Bug Fixes

* add `getCurrentTime` to `SyncIngestUpdateToPartInstanceContext` ([bb35893](https://github.com/Sofie-Automation/sofie-core/commit/bb358938937433af7157d7f821400badf6f10c2b))



# [1.52.0-in-testing.0](https://github.com/Sofie-Automation/sofie-core/compare/v1.51.6...v1.52.0-in-testing.0) (2025-02-04)


### Bug Fixes

* review comments ([752a30a](https://github.com/Sofie-Automation/sofie-core/commit/752a30a69ea4a864239a438b278c3b53d06a12a2))


### Features

* add in-out words to the VT type ([7bec461](https://github.com/Sofie-Automation/sofie-core/commit/7bec4619836cb92ab85331afe130d0ed54ca976e))
* add RemoteSpeak source layer type ([a9b98e7](https://github.com/Sofie-Automation/sofie-core/commit/a9b98e7a544f5dab90c6cc17713abbdc5b930744))
* add segment timing countdownType ([9aaa2dd](https://github.com/Sofie-Automation/sofie-core/commit/9aaa2dd48e841177f32a8d16a2e6c37706c6c2ae))
* allow adlib-actions to remove pieces from the current partInstance ([902e7ff](https://github.com/Sofie-Automation/sofie-core/commit/902e7fffe6cc23c48f7bd86e23595d83f74d84fa))
* allow drag from mos-plugin to part ([d51ba2f](https://github.com/Sofie-Automation/sofie-core/commit/d51ba2fe8b8effa6037f379534b357d5320cc3c7))
* config package manager from blueprints ([685364d](https://github.com/Sofie-Automation/sofie-core/commit/685364d5fd4af690a55292ba99ff8ecff386f893))
* configure Core system/studio settings via blueprints ([ef14c8f](https://github.com/Sofie-Automation/sofie-core/commit/ef14c8f4f139be273ce8a8a3c21e6cc0f580d297))
* configure peripheral device settings from blueprints ([878214b](https://github.com/Sofie-Automation/sofie-core/commit/878214bf983ed12fe82822b47b9c629727d4c20d))
* customizable package status messages ([2ac7cb1](https://github.com/Sofie-Automation/sofie-core/commit/2ac7cb1eb95edc8f901168066396110b2cd71faa))
* exclude pieces from part keepalive ([74bea6c](https://github.com/Sofie-Automation/sofie-core/commit/74bea6cf3a978410bc5e79b325a6fe8b0b190ba9))
* list routesets from blueprints adlib action ([c228251](https://github.com/Sofie-Automation/sofie-core/commit/c22825130793c843f7290d3ee844b805bf2788f1))
* meteor 3.0.4 ([8670727](https://github.com/Sofie-Automation/sofie-core/commit/8670727bba5ac9cffe0e5d36b4bd45d6664482be))
* modify datastore in `onRundownActivate` SOFIE-3310 ([#1240](https://github.com/Sofie-Automation/sofie-core/issues/1240)) ([8a0759f](https://github.com/Sofie-Automation/sofie-core/commit/8a0759f610497e37493e8a798aa0dd13f4f57119))
* move next part should respect quickloop bounds ([8f0153e](https://github.com/Sofie-Automation/sofie-core/commit/8f0153e294a4f4842e333cc3c4e2bacbf6c4c236))
* processIngestData & userEditOperations ([e69a4fc](https://github.com/Sofie-Automation/sofie-core/commit/e69a4fc2f4e3d1e6c6b287e34a3b2f55080ce0c4))
* quickloop improvements ([f1f77fa](https://github.com/Sofie-Automation/sofie-core/commit/f1f77fa11b50fe93afc50631988d7c2aa6306f13))
* routeset config defined in blueprints ([e839b97](https://github.com/Sofie-Automation/sofie-core/commit/e839b97c0205df38e5bc7ab816a9c79406a7d767))
* update meteor to 3.1 and node to 22 ([61b6854](https://github.com/Sofie-Automation/sofie-core/commit/61b6854261a03f04e81416b9d37ee995e3a10108))





# [1.52.0-in-testing.0](https://github.com/nrkno/sofie-core/compare/v1.51.6...v1.52.0-in-testing.0) (2025-02-04)

### Bug Fixes

- review comments ([752a30a](https://github.com/nrkno/sofie-core/commit/752a30a69ea4a864239a438b278c3b53d06a12a2))

### Features

- add in-out words to the VT type ([7bec461](https://github.com/nrkno/sofie-core/commit/7bec4619836cb92ab85331afe130d0ed54ca976e))
- add RemoteSpeak source layer type ([a9b98e7](https://github.com/nrkno/sofie-core/commit/a9b98e7a544f5dab90c6cc17713abbdc5b930744))
- add segment timing countdownType ([9aaa2dd](https://github.com/nrkno/sofie-core/commit/9aaa2dd48e841177f32a8d16a2e6c37706c6c2ae))
- allow adlib-actions to remove pieces from the current partInstance ([902e7ff](https://github.com/nrkno/sofie-core/commit/902e7fffe6cc23c48f7bd86e23595d83f74d84fa))
- allow drag from mos-plugin to part ([d51ba2f](https://github.com/nrkno/sofie-core/commit/d51ba2fe8b8effa6037f379534b357d5320cc3c7))
- config package manager from blueprints ([685364d](https://github.com/nrkno/sofie-core/commit/685364d5fd4af690a55292ba99ff8ecff386f893))
- configure Core system/studio settings via blueprints ([ef14c8f](https://github.com/nrkno/sofie-core/commit/ef14c8f4f139be273ce8a8a3c21e6cc0f580d297))
- configure peripheral device settings from blueprints ([878214b](https://github.com/nrkno/sofie-core/commit/878214bf983ed12fe82822b47b9c629727d4c20d))
- customizable package status messages ([2ac7cb1](https://github.com/nrkno/sofie-core/commit/2ac7cb1eb95edc8f901168066396110b2cd71faa))
- exclude pieces from part keepalive ([74bea6c](https://github.com/nrkno/sofie-core/commit/74bea6cf3a978410bc5e79b325a6fe8b0b190ba9))
- list routesets from blueprints adlib action ([c228251](https://github.com/nrkno/sofie-core/commit/c22825130793c843f7290d3ee844b805bf2788f1))
- meteor 3.0.4 ([8670727](https://github.com/nrkno/sofie-core/commit/8670727bba5ac9cffe0e5d36b4bd45d6664482be))
- modify datastore in `onRundownActivate` SOFIE-3310 ([#1240](https://github.com/nrkno/sofie-core/issues/1240)) ([8a0759f](https://github.com/nrkno/sofie-core/commit/8a0759f610497e37493e8a798aa0dd13f4f57119))
- move next part should respect quickloop bounds ([8f0153e](https://github.com/nrkno/sofie-core/commit/8f0153e294a4f4842e333cc3c4e2bacbf6c4c236))
- processIngestData & userEditOperations ([e69a4fc](https://github.com/nrkno/sofie-core/commit/e69a4fc2f4e3d1e6c6b287e34a3b2f55080ce0c4))
- quickloop improvements ([f1f77fa](https://github.com/nrkno/sofie-core/commit/f1f77fa11b50fe93afc50631988d7c2aa6306f13))
- routeset config defined in blueprints ([e839b97](https://github.com/nrkno/sofie-core/commit/e839b97c0205df38e5bc7ab816a9c79406a7d767))
- update meteor to 3.1 and node to 22 ([61b6854](https://github.com/nrkno/sofie-core/commit/61b6854261a03f04e81416b9d37ee995e3a10108))

## [1.51.7](https://github.com/nrkno/sofie-core/compare/v1.51.6...v1.51.7) (2025-05-06)

**Note:** Version bump only for package @sofie-automation/blueprints-integration

## [1.51.6](https://github.com/nrkno/sofie-core/compare/v1.51.5...v1.51.6) (2025-01-14)

**Note:** Version bump only for package @sofie-automation/blueprints-integration

## [1.51.5](https://github.com/nrkno/sofie-core/compare/v1.51.4...v1.51.5) (2025-01-07)

**Note:** Version bump only for package @sofie-automation/blueprints-integration

## [1.51.4](https://github.com/nrkno/sofie-core/compare/v1.51.3...v1.51.4) (2024-12-04)

**Note:** Version bump only for package @sofie-automation/blueprints-integration

## [1.51.3](https://github.com/nrkno/sofie-core/compare/v1.51.2...v1.51.3) (2024-11-21)

**Note:** Version bump only for package @sofie-automation/blueprints-integration

## [1.51.2](https://github.com/nrkno/sofie-core/compare/v1.51.1...v1.51.2) (2024-11-21)

**Note:** Version bump only for package @sofie-automation/blueprints-integration

## [1.51.1](https://github.com/nrkno/sofie-core/compare/v1.51.1-2...v1.51.1) (2024-11-13)

**Note:** Version bump only for package @sofie-automation/blueprints-integration

## [1.51.1-2](https://github.com/nrkno/sofie-core/compare/v1.51.1-1...v1.51.1-2) (2024-10-24)

**Note:** Version bump only for package @sofie-automation/blueprints-integration

## [1.51.1-2](https://github.com/nrkno/sofie-core/compare/v1.51.1-1...v1.51.1-2) (2024-10-24)

**Note:** Version bump only for package @sofie-automation/blueprints-integration

## [1.51.1-1](https://github.com/nrkno/sofie-core/compare/v1.51.1-0...v1.51.1-1) (2024-10-18)

**Note:** Version bump only for package @sofie-automation/blueprints-integration

## [1.51.1-0](https://github.com/nrkno/sofie-core/compare/v1.51.0...v1.51.1-0) (2024-10-18)

**Note:** Version bump only for package @sofie-automation/blueprints-integration

## [1.51.1-0](https://github.com/nrkno/sofie-core/compare/v1.51.0...v1.51.1-0) (2024-10-18)

**Note:** Version bump only for package @sofie-automation/blueprints-integration

# [1.51.0](https://github.com/nrkno/sofie-core/compare/v1.51.0-in-testing.3...v1.51.0) (2024-10-07)

**Note:** Version bump only for package @sofie-automation/blueprints-integration

# [1.51.0](https://github.com/nrkno/sofie-core/compare/v1.51.0-in-testing.3...v1.51.0) (2024-10-07)

**Note:** Version bump only for package @sofie-automation/blueprints-integration

# [1.51.0-in-testing.3](https://github.com/nrkno/sofie-core/compare/v1.51.0-in-testing.2...v1.51.0-in-testing.3) (2024-09-25)

**Note:** Version bump only for package @sofie-automation/blueprints-integration

# [1.51.0-in-testing.2](https://github.com/nrkno/sofie-core/compare/v1.51.0-in-testing.1...v1.51.0-in-testing.2) (2024-09-24)

**Note:** Version bump only for package @sofie-automation/blueprints-integration

# [1.51.0-in-testing.1](https://github.com/nrkno/sofie-core/compare/v1.51.0-in-testing.0...v1.51.0-in-testing.1) (2024-09-06)

### Features

- stringify piece NoraContent payload SOFIE-3398 ([#1248](https://github.com/nrkno/sofie-core/issues/1248)) ([0613f74](https://github.com/nrkno/sofie-core/commit/0613f740c1e2f740d7d9c39bc72178e301f5f72f))

# [1.51.0-in-testing.1](https://github.com/nrkno/sofie-core/compare/v1.51.0-in-testing.0...v1.51.0-in-testing.1) (2024-09-06)

### Features

- stringify piece NoraContent payload SOFIE-3398 ([#1248](https://github.com/nrkno/sofie-core/issues/1248)) ([0613f74](https://github.com/nrkno/sofie-core/commit/0613f740c1e2f740d7d9c39bc72178e301f5f72f))

# [1.51.0-in-testing.0](https://github.com/nrkno/sofie-core/compare/v1.50.4...v1.51.0-in-testing.0) (2024-08-19)

## [1.50.5-LSG-updates](https://github.com/nrkno/sofie-core/compare/v1.50.4-LSG-updates...v1.50.5-LSG-updates) (2024-08-08)

## [1.50.4-LSG-updates](https://github.com/nrkno/sofie-core/compare/v1.50.3-LSG-updates...v1.50.4-LSG-updates) (2024-07-30)

### Bug Fixes

- Add missing metadata types ([71eb739](https://github.com/nrkno/sofie-core/commit/71eb739bc87f64db50f06ab4647cb6972e58c7fa))
- Add missing piece metadata types ([#1133](https://github.com/nrkno/sofie-core/issues/1133)) ([70c5739](https://github.com/nrkno/sofie-core/commit/70c5739c5e9848e57c21bde78ee16d4c78da8e1a))
- blueprint-integration missed typing in [#1077](https://github.com/nrkno/sofie-core/issues/1077) ([bd5e36f](https://github.com/nrkno/sofie-core/commit/bd5e36f9c0b390999ef465a5e1554b8faa2c456f))

### Features

- A/B player Ids as strings ([#1054](https://github.com/nrkno/sofie-core/issues/1054)) ([d9dee47](https://github.com/nrkno/sofie-core/commit/d9dee473068c4d96d15a6ef799ace830cf1fe1c0))
- action triggers styleClassNames SOFIE-3138 ([#1192](https://github.com/nrkno/sofie-core/issues/1192)) ([fa306dc](https://github.com/nrkno/sofie-core/commit/fa306dc16d5f6ee31418e282180d4c704f5d9feb))
- action triggers styleClassNames SOFIE-3138 ([#1192](https://github.com/nrkno/sofie-core/issues/1192)) ([49274d6](https://github.com/nrkno/sofie-core/commit/49274d64bdc0532f294be34b0a4413d848321e40))
- add onTake and onSetAsNext blueprint callbacks SOFIE-2897 SOFIE-2808 ([#1117](https://github.com/nrkno/sofie-core/issues/1117)) ([0bd621c](https://github.com/nrkno/sofie-core/commit/0bd621c13b08cb20c923ea573baca9db003c7df1))
- blueprint config fixup step SOFIE-2258 ([#1050](https://github.com/nrkno/sofie-core/issues/1050)) ([ea6c343](https://github.com/nrkno/sofie-core/commit/ea6c3435079172c682dd1e23d7813ae33fcdee78))
- cleanup deprecations ([#996](https://github.com/nrkno/sofie-core/issues/996)) ([f04f18f](https://github.com/nrkno/sofie-core/commit/f04f18f8e94b706dd1a3da1525feb9787f6eb85f))
- create adlib testing rundowns SOFIE-2963 ([#1211](https://github.com/nrkno/sofie-core/issues/1211)) ([a831989](https://github.com/nrkno/sofie-core/commit/a8319898c73d7233a2a665fd0bf5b9d6da83d713))
- **Device Triggers:** add support for setting shift register operations ([aa19fcc](https://github.com/nrkno/sofie-core/commit/aa19fcc3b5bfad05158677701b838673578a4dcb))
- **Device Triggers:** add support for setting shift register operations SOFIE-3136 ([c5a6292](https://github.com/nrkno/sofie-core/commit/c5a6292a85821d67653eebef75bbd929ff0cd44d))
- **EAV-31:** add blueprintsData on adlib actions ([114c064](https://github.com/nrkno/sofie-core/commit/114c06466ff1f35660454b66d1e35b3d339b9a80))
- Editable fields as JSON ([ddfb66a](https://github.com/nrkno/sofie-core/commit/ddfb66a1ef8afbd507535037d12752742c7dfeda))
- implement `loop` content property for Graphics ([2cf38ba](https://github.com/nrkno/sofie-core/commit/2cf38baadd5e7ba16d624b9ad75cfff9d48297a6))
- introduce `privateData` and `publicData` ([d94f1aa](https://github.com/nrkno/sofie-core/commit/d94f1aa82cec779c7eebddae42e1c4fab91ac494))
- remove supertimeline from Parts and Pieces resolving SOFIE-2373 ([#983](https://github.com/nrkno/sofie-core/issues/983)) ([55e02cb](https://github.com/nrkno/sofie-core/commit/55e02cb1a0b6d237ae9bcd02ebf54e06cf08fb26))
- rename internal 'scratchpad' naming to 'adlib testing' SOFIE-3015 ([afb2f43](https://github.com/nrkno/sofie-core/commit/afb2f43c8f199ff5da4ea6c3ccc3bd1e97a80f4f))
- rundown scratchpad SOFIE-2432 ([5e16632](https://github.com/nrkno/sofie-core/commit/5e16632908b8dd62e4470a9ba6089a56aa571b9f))
- support packageinfo update flow for buckets and studio baseline SOFIE-2655 ([#1051](https://github.com/nrkno/sofie-core/issues/1051)) ([df7ed0c](https://github.com/nrkno/sofie-core/commit/df7ed0c653b897774f01a33c9e60a5e22fac99e4))
- typed publications in gateways/peripheraldevices SOFIE-1183 ([#1056](https://github.com/nrkno/sofie-core/issues/1056)) ([0c3c1bf](https://github.com/nrkno/sofie-core/commit/0c3c1bfd2bb779034976dc34e49aa6e664ea874b))
- update meteor to 2.12 SOFIE-2368 ([#931](https://github.com/nrkno/sofie-core/issues/931)) ([d7dfb71](https://github.com/nrkno/sofie-core/commit/d7dfb71d19405267cab5e2abc39794a80acb30b1))

# [1.51.0-in-testing.0](https://github.com/nrkno/sofie-core/compare/v1.50.4...v1.51.0-in-testing.0) (2024-08-19)

## [1.50.5-LSG-updates](https://github.com/nrkno/sofie-core/compare/v1.50.4-LSG-updates...v1.50.5-LSG-updates) (2024-08-08)

## [1.50.4-LSG-updates](https://github.com/nrkno/sofie-core/compare/v1.50.3-LSG-updates...v1.50.4-LSG-updates) (2024-07-30)

### Bug Fixes

- Add missing metadata types ([71eb739](https://github.com/nrkno/sofie-core/commit/71eb739bc87f64db50f06ab4647cb6972e58c7fa))
- Add missing piece metadata types ([#1133](https://github.com/nrkno/sofie-core/issues/1133)) ([70c5739](https://github.com/nrkno/sofie-core/commit/70c5739c5e9848e57c21bde78ee16d4c78da8e1a))
- blueprint-integration missed typing in [#1077](https://github.com/nrkno/sofie-core/issues/1077) ([bd5e36f](https://github.com/nrkno/sofie-core/commit/bd5e36f9c0b390999ef465a5e1554b8faa2c456f))

### Features

- A/B player Ids as strings ([#1054](https://github.com/nrkno/sofie-core/issues/1054)) ([d9dee47](https://github.com/nrkno/sofie-core/commit/d9dee473068c4d96d15a6ef799ace830cf1fe1c0))
- action triggers styleClassNames SOFIE-3138 ([#1192](https://github.com/nrkno/sofie-core/issues/1192)) ([fa306dc](https://github.com/nrkno/sofie-core/commit/fa306dc16d5f6ee31418e282180d4c704f5d9feb))
- action triggers styleClassNames SOFIE-3138 ([#1192](https://github.com/nrkno/sofie-core/issues/1192)) ([49274d6](https://github.com/nrkno/sofie-core/commit/49274d64bdc0532f294be34b0a4413d848321e40))
- add onTake and onSetAsNext blueprint callbacks SOFIE-2897 SOFIE-2808 ([#1117](https://github.com/nrkno/sofie-core/issues/1117)) ([0bd621c](https://github.com/nrkno/sofie-core/commit/0bd621c13b08cb20c923ea573baca9db003c7df1))
- blueprint config fixup step SOFIE-2258 ([#1050](https://github.com/nrkno/sofie-core/issues/1050)) ([ea6c343](https://github.com/nrkno/sofie-core/commit/ea6c3435079172c682dd1e23d7813ae33fcdee78))
- cleanup deprecations ([#996](https://github.com/nrkno/sofie-core/issues/996)) ([f04f18f](https://github.com/nrkno/sofie-core/commit/f04f18f8e94b706dd1a3da1525feb9787f6eb85f))
- create adlib testing rundowns SOFIE-2963 ([#1211](https://github.com/nrkno/sofie-core/issues/1211)) ([a831989](https://github.com/nrkno/sofie-core/commit/a8319898c73d7233a2a665fd0bf5b9d6da83d713))
- **Device Triggers:** add support for setting shift register operations ([aa19fcc](https://github.com/nrkno/sofie-core/commit/aa19fcc3b5bfad05158677701b838673578a4dcb))
- **Device Triggers:** add support for setting shift register operations SOFIE-3136 ([c5a6292](https://github.com/nrkno/sofie-core/commit/c5a6292a85821d67653eebef75bbd929ff0cd44d))
- **EAV-31:** add blueprintsData on adlib actions ([114c064](https://github.com/nrkno/sofie-core/commit/114c06466ff1f35660454b66d1e35b3d339b9a80))
- Editable fields as JSON ([ddfb66a](https://github.com/nrkno/sofie-core/commit/ddfb66a1ef8afbd507535037d12752742c7dfeda))
- implement `loop` content property for Graphics ([2cf38ba](https://github.com/nrkno/sofie-core/commit/2cf38baadd5e7ba16d624b9ad75cfff9d48297a6))
- introduce `privateData` and `publicData` ([d94f1aa](https://github.com/nrkno/sofie-core/commit/d94f1aa82cec779c7eebddae42e1c4fab91ac494))
- remove supertimeline from Parts and Pieces resolving SOFIE-2373 ([#983](https://github.com/nrkno/sofie-core/issues/983)) ([55e02cb](https://github.com/nrkno/sofie-core/commit/55e02cb1a0b6d237ae9bcd02ebf54e06cf08fb26))
- rename internal 'scratchpad' naming to 'adlib testing' SOFIE-3015 ([afb2f43](https://github.com/nrkno/sofie-core/commit/afb2f43c8f199ff5da4ea6c3ccc3bd1e97a80f4f))
- rundown scratchpad SOFIE-2432 ([5e16632](https://github.com/nrkno/sofie-core/commit/5e16632908b8dd62e4470a9ba6089a56aa571b9f))
- support packageinfo update flow for buckets and studio baseline SOFIE-2655 ([#1051](https://github.com/nrkno/sofie-core/issues/1051)) ([df7ed0c](https://github.com/nrkno/sofie-core/commit/df7ed0c653b897774f01a33c9e60a5e22fac99e4))
- typed publications in gateways/peripheraldevices SOFIE-1183 ([#1056](https://github.com/nrkno/sofie-core/issues/1056)) ([0c3c1bf](https://github.com/nrkno/sofie-core/commit/0c3c1bfd2bb779034976dc34e49aa6e664ea874b))
- update meteor to 2.12 SOFIE-2368 ([#931](https://github.com/nrkno/sofie-core/issues/931)) ([d7dfb71](https://github.com/nrkno/sofie-core/commit/d7dfb71d19405267cab5e2abc39794a80acb30b1))

## [1.50.5](https://github.com/nrkno/tv-automation-server-core/compare/v1.50.4...v1.50.5) (2024-09-19)

**Note:** Version bump only for package @sofie-automation/blueprints-integration

## [1.50.4](https://github.com/nrkno/tv-automation-server-core/compare/v1.50.3-LSG-updates...v1.50.4) (2024-07-30)

**Note:** Version bump only for package @sofie-automation/blueprints-integration

## [1.50.3](https://github.com/nrkno/tv-automation-server-core/compare/v1.50.2...v1.50.3) (2024-06-24)

**Note:** Version bump only for package @sofie-automation/blueprints-integration

## [1.50.2](https://github.com/nrkno/tv-automation-server-core/compare/v1.49.6...v1.50.2) (2024-05-15)

## [1.50.1](https://github.com/nrkno/tv-automation-server-core/compare/v1.49.5-0...v1.50.1) (2024-03-11)

## [1.50.1-0](https://github.com/nrkno/tv-automation-server-core/compare/v1.50.0...v1.50.1-0) (2024-03-05)

# [1.50.0](https://github.com/nrkno/tv-automation-server-core/compare/v1.49.4...v1.50.0) (2024-02-23)

### Features

- allow blueprints to specify a custom resolution for NORA hover preview SOFIE-2840 ([#1123](https://github.com/nrkno/tv-automation-server-core/issues/1123)) ([d2f3cef](https://github.com/nrkno/tv-automation-server-core/commit/d2f3cef03259f594feba8814046614d1ed16cf62))

# [1.50.0-in-testing.5](https://github.com/nrkno/tv-automation-server-core/compare/v1.50.0-in-testing.4...v1.50.0-in-testing.5) (2023-08-25)

# [1.50.0-in-testing.4](https://github.com/nrkno/tv-automation-server-core/compare/v1.49.0-in-testing.7...v1.50.0-in-testing.4) (2023-08-23)

# [1.50.0-in-testing.2](https://github.com/nrkno/tv-automation-server-core/compare/v1.50.0-in-testing.1...v1.50.0-in-testing.2) (2023-07-17)

### Bug Fixes

- Allow JSON objects in config presets ([#949](https://github.com/nrkno/tv-automation-server-core/issues/949)) ([4e5a797](https://github.com/nrkno/tv-automation-server-core/commit/4e5a79752d6c06f91ce070b1d67e7bed97a4f0f2))
- expose `deviceType` in `listPlayoutDevices` to blueprints ([2b32c72](https://github.com/nrkno/tv-automation-server-core/commit/2b32c7256762716071d467193f344646af484f18))
- require blueprint baseline objects to be of type `TimelineObjectCoreExt` instead of `TSR.TSRTimelineObj` [#961](https://github.com/nrkno/tv-automation-server-core/issues/961) ([b8d0cf3](https://github.com/nrkno/tv-automation-server-core/commit/b8d0cf313c88e29fd08f6405b86a55d3579e7692))

### Features

- add `prompterTitle` property SOFIE-2404 ([#975](https://github.com/nrkno/tv-automation-server-core/issues/975)) ([6f0567d](https://github.com/nrkno/tv-automation-server-core/commit/6f0567de958cede745e918529bae660305ceb66e))
- add milestone timing ([5950fd5](https://github.com/nrkno/tv-automation-server-core/commit/5950fd5e202cfab5e7f5b36942ffb7525c713e0a))
- allow getting the Source and Output layers from the ShowStyle context ([#979](https://github.com/nrkno/tv-automation-server-core/issues/979)) ([ab57fb4](https://github.com/nrkno/tv-automation-server-core/commit/ab57fb4871bf23e37b99e73f5f809738fd8fdd1b))
- blueprint settings overhaul ([#878](https://github.com/nrkno/tv-automation-server-core/issues/878)) ([ee3307c](https://github.com/nrkno/tv-automation-server-core/commit/ee3307cae10076e2d91d624f783e40c54c297b91))
- fallback to cumetime if no backtime ([2cafbab](https://github.com/nrkno/tv-automation-server-core/commit/2cafbab2f03d49b92c121a7206ddfed62bf770fa))
- move blueprint ab logic into sofie SOFIE-2403 ([#946](https://github.com/nrkno/tv-automation-server-core/issues/946)) ([cc37b75](https://github.com/nrkno/tv-automation-server-core/commit/cc37b751d674be7f8631d0315e52f8fa29a8d3c4))
- move gateway settings onto Studio SOFIE-1330 ([#907](https://github.com/nrkno/tv-automation-server-core/issues/907)) ([523c061](https://github.com/nrkno/tv-automation-server-core/commit/523c061c51296e21814deeeabbe9aafca21cd5a6))
- trs actions in blueprints rundown hooks ([bb5e442](https://github.com/nrkno/tv-automation-server-core/commit/bb5e4422fa32e1af1e520e0c288360b304da4289))

## [1.50.1](https://github.com/nrkno/tv-automation-server-core/compare/v1.50.1-0...v1.50.1) (2024-03-11)

**Note:** Version bump only for package @sofie-automation/blueprints-integration

## [1.50.1-0](https://github.com/nrkno/tv-automation-server-core/compare/v1.50.0...v1.50.1-0) (2024-03-05)

**Note:** Version bump only for package @sofie-automation/blueprints-integration

# [1.50.0](https://github.com/nrkno/tv-automation-server-core/compare/v1.49.4...v1.50.0) (2024-02-23)

### Features

- allow blueprints to specify a custom resolution for NORA hover preview SOFIE-2840 ([#1123](https://github.com/nrkno/tv-automation-server-core/issues/1123)) ([d2f3cef](https://github.com/nrkno/tv-automation-server-core/commit/d2f3cef03259f594feba8814046614d1ed16cf62))

# [1.50.0-in-testing.5](https://github.com/nrkno/tv-automation-server-core/compare/v1.50.0-in-testing.4...v1.50.0-in-testing.5) (2023-08-25)

# [1.50.0-in-testing.4](https://github.com/nrkno/tv-automation-server-core/compare/v1.49.0-in-testing.7...v1.50.0-in-testing.4) (2023-08-23)

# [1.50.0-in-testing.2](https://github.com/nrkno/tv-automation-server-core/compare/v1.50.0-in-testing.1...v1.50.0-in-testing.2) (2023-07-17)

### Bug Fixes

- Allow JSON objects in config presets ([#949](https://github.com/nrkno/tv-automation-server-core/issues/949)) ([4e5a797](https://github.com/nrkno/tv-automation-server-core/commit/4e5a79752d6c06f91ce070b1d67e7bed97a4f0f2))
- expose `deviceType` in `listPlayoutDevices` to blueprints ([2b32c72](https://github.com/nrkno/tv-automation-server-core/commit/2b32c7256762716071d467193f344646af484f18))
- require blueprint baseline objects to be of type `TimelineObjectCoreExt` instead of `TSR.TSRTimelineObj` [#961](https://github.com/nrkno/tv-automation-server-core/issues/961) ([b8d0cf3](https://github.com/nrkno/tv-automation-server-core/commit/b8d0cf313c88e29fd08f6405b86a55d3579e7692))

### Features

- add `prompterTitle` property SOFIE-2404 ([#975](https://github.com/nrkno/tv-automation-server-core/issues/975)) ([6f0567d](https://github.com/nrkno/tv-automation-server-core/commit/6f0567de958cede745e918529bae660305ceb66e))
- add milestone timing ([5950fd5](https://github.com/nrkno/tv-automation-server-core/commit/5950fd5e202cfab5e7f5b36942ffb7525c713e0a))
- allow getting the Source and Output layers from the ShowStyle context ([#979](https://github.com/nrkno/tv-automation-server-core/issues/979)) ([ab57fb4](https://github.com/nrkno/tv-automation-server-core/commit/ab57fb4871bf23e37b99e73f5f809738fd8fdd1b))
- blueprint settings overhaul ([#878](https://github.com/nrkno/tv-automation-server-core/issues/878)) ([ee3307c](https://github.com/nrkno/tv-automation-server-core/commit/ee3307cae10076e2d91d624f783e40c54c297b91))
- fallback to cumetime if no backtime ([2cafbab](https://github.com/nrkno/tv-automation-server-core/commit/2cafbab2f03d49b92c121a7206ddfed62bf770fa))
- move blueprint ab logic into sofie SOFIE-2403 ([#946](https://github.com/nrkno/tv-automation-server-core/issues/946)) ([cc37b75](https://github.com/nrkno/tv-automation-server-core/commit/cc37b751d674be7f8631d0315e52f8fa29a8d3c4))
- move gateway settings onto Studio SOFIE-1330 ([#907](https://github.com/nrkno/tv-automation-server-core/issues/907)) ([523c061](https://github.com/nrkno/tv-automation-server-core/commit/523c061c51296e21814deeeabbe9aafca21cd5a6))
- trs actions in blueprints rundown hooks ([bb5e442](https://github.com/nrkno/tv-automation-server-core/commit/bb5e4422fa32e1af1e520e0c288360b304da4289))

# [1.50.0-in-testing.5](https://github.com/nrkno/tv-automation-server-core/compare/v1.50.0-in-testing.4...v1.50.0-in-testing.5) (2023-08-25)

# [1.50.0-in-testing.4](https://github.com/nrkno/tv-automation-server-core/compare/v1.49.0-in-testing.7...v1.50.0-in-testing.4) (2023-08-23)

# [1.50.0-in-testing.3](https://github.com/nrkno/tv-automation-server-core/compare/v1.49.0-in-testing.5...v1.50.0-in-testing.3) (2023-08-17)

# [1.50.0-in-testing.2](https://github.com/nrkno/tv-automation-server-core/compare/v1.50.0-in-testing.1...v1.50.0-in-testing.2) (2023-07-17)

### Bug Fixes

- Allow JSON objects in config presets ([#949](https://github.com/nrkno/tv-automation-server-core/issues/949)) ([4e5a797](https://github.com/nrkno/tv-automation-server-core/commit/4e5a79752d6c06f91ce070b1d67e7bed97a4f0f2))
- expose `deviceType` in `listPlayoutDevices` to blueprints ([2b32c72](https://github.com/nrkno/tv-automation-server-core/commit/2b32c7256762716071d467193f344646af484f18))
- require blueprint baseline objects to be of type `TimelineObjectCoreExt` instead of `TSR.TSRTimelineObj` [#961](https://github.com/nrkno/tv-automation-server-core/issues/961) ([b8d0cf3](https://github.com/nrkno/tv-automation-server-core/commit/b8d0cf313c88e29fd08f6405b86a55d3579e7692))

### Features

- add `prompterTitle` property SOFIE-2404 ([#975](https://github.com/nrkno/tv-automation-server-core/issues/975)) ([6f0567d](https://github.com/nrkno/tv-automation-server-core/commit/6f0567de958cede745e918529bae660305ceb66e))
- add milestone timing ([5950fd5](https://github.com/nrkno/tv-automation-server-core/commit/5950fd5e202cfab5e7f5b36942ffb7525c713e0a))
- allow getting the Source and Output layers from the ShowStyle context ([#979](https://github.com/nrkno/tv-automation-server-core/issues/979)) ([ab57fb4](https://github.com/nrkno/tv-automation-server-core/commit/ab57fb4871bf23e37b99e73f5f809738fd8fdd1b))
- blueprint settings overhaul ([#878](https://github.com/nrkno/tv-automation-server-core/issues/878)) ([ee3307c](https://github.com/nrkno/tv-automation-server-core/commit/ee3307cae10076e2d91d624f783e40c54c297b91))
- fallback to cumetime if no backtime ([2cafbab](https://github.com/nrkno/tv-automation-server-core/commit/2cafbab2f03d49b92c121a7206ddfed62bf770fa))
- move blueprint ab logic into sofie SOFIE-2403 ([#946](https://github.com/nrkno/tv-automation-server-core/issues/946)) ([cc37b75](https://github.com/nrkno/tv-automation-server-core/commit/cc37b751d674be7f8631d0315e52f8fa29a8d3c4))
- move gateway settings onto Studio SOFIE-1330 ([#907](https://github.com/nrkno/tv-automation-server-core/issues/907)) ([523c061](https://github.com/nrkno/tv-automation-server-core/commit/523c061c51296e21814deeeabbe9aafca21cd5a6))
- trs actions in blueprints rundown hooks ([bb5e442](https://github.com/nrkno/tv-automation-server-core/commit/bb5e4422fa32e1af1e520e0c288360b304da4289))

# [1.50.0-in-testing.1](https://github.com/nrkno/tv-automation-server-core/compare/v1.50.0-in-testing.0...v1.50.0-in-testing.1) (2023-07-05)

# [1.50.0-in-testing.0](https://github.com/nrkno/tv-automation-server-core/compare/v1.49.0-in-testing.4...v1.50.0-in-testing.0) (2023-07-03)

### Bug Fixes

- Allow JSON objects in config presets ([#949](https://github.com/nrkno/tv-automation-server-core/issues/949)) ([4e5a797](https://github.com/nrkno/tv-automation-server-core/commit/4e5a79752d6c06f91ce070b1d67e7bed97a4f0f2))
- expose `deviceType` in `listPlayoutDevices` to blueprints ([2b32c72](https://github.com/nrkno/tv-automation-server-core/commit/2b32c7256762716071d467193f344646af484f18))
- require blueprint baseline objects to be of type `TimelineObjectCoreExt` instead of `TSR.TSRTimelineObj` [#961](https://github.com/nrkno/tv-automation-server-core/issues/961) ([b8d0cf3](https://github.com/nrkno/tv-automation-server-core/commit/b8d0cf313c88e29fd08f6405b86a55d3579e7692))

### Features

- add `prompterTitle` property SOFIE-2404 ([#975](https://github.com/nrkno/tv-automation-server-core/issues/975)) ([6f0567d](https://github.com/nrkno/tv-automation-server-core/commit/6f0567de958cede745e918529bae660305ceb66e))
- add milestone timing ([5950fd5](https://github.com/nrkno/tv-automation-server-core/commit/5950fd5e202cfab5e7f5b36942ffb7525c713e0a))
- allow getting the Source and Output layers from the ShowStyle context ([#979](https://github.com/nrkno/tv-automation-server-core/issues/979)) ([ab57fb4](https://github.com/nrkno/tv-automation-server-core/commit/ab57fb4871bf23e37b99e73f5f809738fd8fdd1b))
- blueprint settings overhaul ([#878](https://github.com/nrkno/tv-automation-server-core/issues/878)) ([ee3307c](https://github.com/nrkno/tv-automation-server-core/commit/ee3307cae10076e2d91d624f783e40c54c297b91))
- fallback to cumetime if no backtime ([2cafbab](https://github.com/nrkno/tv-automation-server-core/commit/2cafbab2f03d49b92c121a7206ddfed62bf770fa))
- move blueprint ab logic into sofie SOFIE-2403 ([#946](https://github.com/nrkno/tv-automation-server-core/issues/946)) ([cc37b75](https://github.com/nrkno/tv-automation-server-core/commit/cc37b751d674be7f8631d0315e52f8fa29a8d3c4))
- move gateway settings onto Studio SOFIE-1330 ([#907](https://github.com/nrkno/tv-automation-server-core/issues/907)) ([523c061](https://github.com/nrkno/tv-automation-server-core/commit/523c061c51296e21814deeeabbe9aafca21cd5a6))
- trs actions in blueprints rundown hooks ([bb5e442](https://github.com/nrkno/tv-automation-server-core/commit/bb5e4422fa32e1af1e520e0c288360b304da4289))

## [1.49.3](https://github.com/nrkno/tv-automation-server-core/compare/v1.49.2...v1.49.3) (2023-12-21)

**Note:** Version bump only for package @sofie-automation/blueprints-integration

## [1.49.2](https://github.com/nrkno/tv-automation-server-core/compare/v1.49.1...v1.49.2) (2023-11-29)

**Note:** Version bump only for package @sofie-automation/blueprints-integration

## [1.49.1](https://github.com/nrkno/tv-automation-server-core/compare/v1.49.0...v1.49.1) (2023-10-20)

**Note:** Version bump only for package @sofie-automation/blueprints-integration

# [1.49.0](https://github.com/nrkno/tv-automation-server-core/compare/v1.49.0-in-testing.10...v1.49.0) (2023-10-06)

**Note:** Version bump only for package @sofie-automation/blueprints-integration

# [1.49.0](https://github.com/nrkno/tv-automation-server-core/compare/v1.49.0-in-testing.10...v1.49.0) (2023-10-06)

**Note:** Version bump only for package @sofie-automation/blueprints-integration

# [1.49.0-in-testing.10](https://github.com/nrkno/tv-automation-server-core/compare/v1.49.0-in-testing.9...v1.49.0-in-testing.10) (2023-10-03)

**Note:** Version bump only for package @sofie-automation/blueprints-integration

# [1.49.0-in-testing.9](https://github.com/nrkno/tv-automation-server-core/compare/v1.49.0-in-testing.8...v1.49.0-in-testing.9) (2023-09-20)

**Note:** Version bump only for package @sofie-automation/blueprints-integration

# [1.49.0-in-testing.8](https://github.com/nrkno/tv-automation-server-core/compare/v1.47.6...v1.49.0-in-testing.8) (2023-09-20)

**Note:** Version bump only for package @sofie-automation/blueprints-integration

# [1.49.0-in-testing.7](https://github.com/nrkno/tv-automation-server-core/compare/v1.49.0-in-testing.6...v1.49.0-in-testing.7) (2023-08-22)

# [1.49.0-in-testing.6](https://github.com/nrkno/tv-automation-server-core/compare/v1.49.0-in-testing.5...v1.49.0-in-testing.6) (2023-08-22)

# [1.49.0-in-testing.5](https://github.com/nrkno/tv-automation-server-core/compare/v1.49.0-in-testing.4...v1.49.0-in-testing.5) (2023-08-17)

# [1.49.0-in-testing.4](https://github.com/nrkno/tv-automation-server-core/compare/v1.47.5...v1.49.0-in-testing.4) (2023-06-29)

# [1.49.0-in-testing.3](https://github.com/nrkno/tv-automation-server-core/compare/v1.49.0-in-testing.2...v1.49.0-in-testing.3) (2023-04-18)

# [1.49.0-in-testing.2](https://github.com/nrkno/tv-automation-server-core/compare/v1.47.1-0...v1.49.0-in-testing.2) (2023-03-30)

# [1.49.0-in-testing.1](https://github.com/nrkno/tv-automation-server-core/compare/v1.49.0-in-testing.0...v1.49.0-in-testing.1) (2023-03-23)

# [1.49.0-in-testing.0](https://github.com/nrkno/tv-automation-server-core/compare/v1.47.0...v1.49.0-in-testing.0) (2023-03-21)

### Bug Fixes

- downgrade type-fest (again) ([82346cc](https://github.com/nrkno/tv-automation-server-core/commit/82346cc9fc01a251c6dcb4d2f86ea954601ada32))

### Features

- add studio frameRate to coreConfig ([#870](https://github.com/nrkno/tv-automation-server-core/issues/870)) ([265ad61](https://github.com/nrkno/tv-automation-server-core/commit/265ad61048ca638471d2cb07eab1747dace8b92d))
- Expose peripheralDeviceActions to blueprints ([fdb61c9](https://github.com/nrkno/tv-automation-server-core/commit/fdb61c9e23a77a52c1fdc65cd40ba36c3005ce31))

# [1.48.0-in-testing.3](https://github.com/nrkno/tv-automation-server-core/compare/v1.48.0-in-testing.2...v1.48.0-in-testing.3) (2023-02-14)

# [1.48.0-in-testing.2](https://github.com/nrkno/tv-automation-server-core/compare/v1.47.0-in-testing.8...v1.48.0-in-testing.2) (2023-02-14)

### Bug Fixes

- update mos-connection dependency ([#820](https://github.com/nrkno/tv-automation-server-core/issues/820)) ([b5df74f](https://github.com/nrkno/tv-automation-server-core/commit/b5df74f26b29c1e0b85a6d85ae3b83277ed1f554))

# [1.48.0-in-testing.1](https://github.com/nrkno/tv-automation-server-core/compare/v1.47.0-in-testing.5...v1.48.0-in-testing.1) (2023-01-11)

### Bug Fixes

- refactor playout-gateway types into shared-lib ([#827](https://github.com/nrkno/tv-automation-server-core/issues/827)) ([d8245ff](https://github.com/nrkno/tv-automation-server-core/commit/d8245ff4e681cbb92ba09e1fb948525b6854b093))

### Features

- Blueprints migrations replacement ([#808](https://github.com/nrkno/tv-automation-server-core/issues/808)) ([7a0692a](https://github.com/nrkno/tv-automation-server-core/commit/7a0692a2216b5fc720f7342d6c7bc26410faf417))
- initial translations for tsr actions ([889fa04](https://github.com/nrkno/tv-automation-server-core/commit/889fa04b368d5bf34bd0acd5ad8c377b4f3af264))
- refactor timeline types to work better with typescript 4.7 ([#793](https://github.com/nrkno/tv-automation-server-core/issues/793)) ([1ec87ef](https://github.com/nrkno/tv-automation-server-core/commit/1ec87ef5578e4341225957e43132ef6a8f452503))
- remove initial system migrations with manual steps ([#779](https://github.com/nrkno/tv-automation-server-core/issues/779)) ([3f51952](https://github.com/nrkno/tv-automation-server-core/commit/3f519520fb0efdc36822982766bf780eed83bac7))
- stronger ddp call typings in gateways ([#788](https://github.com/nrkno/tv-automation-server-core/issues/788)) ([2a1f8af](https://github.com/nrkno/tv-automation-server-core/commit/2a1f8affad1b0278a2350c6e4f6ed7d3070121a1))
- tsr action manifests ([4987eaf](https://github.com/nrkno/tv-automation-server-core/commit/4987eaf3277a58311c1c2d2613af3bc72a5c4487))
- typings WIP ([0101b29](https://github.com/nrkno/tv-automation-server-core/commit/0101b29bdff7b1367bd27d16d524c24a1a8ae90a))

# [1.49.0-in-testing.7](https://github.com/nrkno/tv-automation-server-core/compare/v1.49.0-in-testing.6...v1.49.0-in-testing.7) (2023-08-22)

**Note:** Version bump only for package @sofie-automation/blueprints-integration

# [1.49.0-in-testing.6](https://github.com/nrkno/tv-automation-server-core/compare/v1.49.0-in-testing.5...v1.49.0-in-testing.6) (2023-08-22)

**Note:** Version bump only for package @sofie-automation/blueprints-integration

# [1.49.0-in-testing.5](https://github.com/nrkno/tv-automation-server-core/compare/v1.49.0-in-testing.4...v1.49.0-in-testing.5) (2023-08-17)

**Note:** Version bump only for package @sofie-automation/blueprints-integration

# [1.49.0-in-testing.4](https://github.com/nrkno/tv-automation-server-core/compare/v1.47.5...v1.49.0-in-testing.4) (2023-06-29)

# [1.49.0-in-testing.3](https://github.com/nrkno/tv-automation-server-core/compare/v1.49.0-in-testing.2...v1.49.0-in-testing.3) (2023-04-18)

# [1.49.0-in-testing.2](https://github.com/nrkno/tv-automation-server-core/compare/v1.47.1-0...v1.49.0-in-testing.2) (2023-03-30)

# [1.49.0-in-testing.1](https://github.com/nrkno/tv-automation-server-core/compare/v1.49.0-in-testing.0...v1.49.0-in-testing.1) (2023-03-23)

# [1.49.0-in-testing.0](https://github.com/nrkno/tv-automation-server-core/compare/v1.47.0...v1.49.0-in-testing.0) (2023-03-21)

### Bug Fixes

- downgrade type-fest (again) ([82346cc](https://github.com/nrkno/tv-automation-server-core/commit/82346cc9fc01a251c6dcb4d2f86ea954601ada32))

### Features

- add studio frameRate to coreConfig ([#870](https://github.com/nrkno/tv-automation-server-core/issues/870)) ([265ad61](https://github.com/nrkno/tv-automation-server-core/commit/265ad61048ca638471d2cb07eab1747dace8b92d))
- Expose peripheralDeviceActions to blueprints ([fdb61c9](https://github.com/nrkno/tv-automation-server-core/commit/fdb61c9e23a77a52c1fdc65cd40ba36c3005ce31))

# [1.48.0-in-testing.3](https://github.com/nrkno/tv-automation-server-core/compare/v1.48.0-in-testing.2...v1.48.0-in-testing.3) (2023-02-14)

# [1.48.0-in-testing.2](https://github.com/nrkno/tv-automation-server-core/compare/v1.47.0-in-testing.8...v1.48.0-in-testing.2) (2023-02-14)

### Bug Fixes

- update mos-connection dependency ([#820](https://github.com/nrkno/tv-automation-server-core/issues/820)) ([b5df74f](https://github.com/nrkno/tv-automation-server-core/commit/b5df74f26b29c1e0b85a6d85ae3b83277ed1f554))

# [1.48.0-in-testing.1](https://github.com/nrkno/tv-automation-server-core/compare/v1.47.0-in-testing.5...v1.48.0-in-testing.1) (2023-01-11)

### Bug Fixes

- refactor playout-gateway types into shared-lib ([#827](https://github.com/nrkno/tv-automation-server-core/issues/827)) ([d8245ff](https://github.com/nrkno/tv-automation-server-core/commit/d8245ff4e681cbb92ba09e1fb948525b6854b093))

### Features

- Blueprints migrations replacement ([#808](https://github.com/nrkno/tv-automation-server-core/issues/808)) ([7a0692a](https://github.com/nrkno/tv-automation-server-core/commit/7a0692a2216b5fc720f7342d6c7bc26410faf417))
- initial translations for tsr actions ([889fa04](https://github.com/nrkno/tv-automation-server-core/commit/889fa04b368d5bf34bd0acd5ad8c377b4f3af264))
- refactor timeline types to work better with typescript 4.7 ([#793](https://github.com/nrkno/tv-automation-server-core/issues/793)) ([1ec87ef](https://github.com/nrkno/tv-automation-server-core/commit/1ec87ef5578e4341225957e43132ef6a8f452503))
- remove initial system migrations with manual steps ([#779](https://github.com/nrkno/tv-automation-server-core/issues/779)) ([3f51952](https://github.com/nrkno/tv-automation-server-core/commit/3f519520fb0efdc36822982766bf780eed83bac7))
- stronger ddp call typings in gateways ([#788](https://github.com/nrkno/tv-automation-server-core/issues/788)) ([2a1f8af](https://github.com/nrkno/tv-automation-server-core/commit/2a1f8affad1b0278a2350c6e4f6ed7d3070121a1))
- tsr action manifests ([4987eaf](https://github.com/nrkno/tv-automation-server-core/commit/4987eaf3277a58311c1c2d2613af3bc72a5c4487))
- typings WIP ([0101b29](https://github.com/nrkno/tv-automation-server-core/commit/0101b29bdff7b1367bd27d16d524c24a1a8ae90a))

# [1.49.0-in-testing.3](https://github.com/nrkno/tv-automation-server-core/compare/v1.49.0-in-testing.2...v1.49.0-in-testing.3) (2023-04-18)

## [1.47.6](https://github.com/nrkno/tv-automation-server-core/compare/v1.47.6-0...v1.47.6) (2023-09-04)

## [1.47.6-0](https://github.com/nrkno/tv-automation-server-core/compare/v1.47.5...v1.47.6-0) (2023-09-01)

## [1.47.5](https://github.com/nrkno/tv-automation-server-core/compare/v1.47.5-0...v1.47.5) (2023-06-27)

**Note:** Version bump only for package @sofie-automation/blueprints-integration

## [1.47.5-0](https://github.com/nrkno/tv-automation-server-core/compare/v1.47.4...v1.47.5-0) (2023-06-26)

**Note:** Version bump only for package @sofie-automation/blueprints-integration

## [1.47.4](https://github.com/nrkno/tv-automation-server-core/compare/v1.47.3...v1.47.4) (2023-06-13)

**Note:** Version bump only for package @sofie-automation/blueprints-integration

# [1.47.3](https://github.com/nrkno/tv-automation-server-core/compare/v1.47.1...v1.47.3) (2023-06-01)

**Note:** Version bump only for package @sofie-automation/blueprints-integration

# [1.47.2](https://github.com/nrkno/tv-automation-server-core/compare/v1.47.1...v1.47.2) (2023-06-01)

**Note:** Version bump only for package @sofie-automation/blueprints-integration

# [1.47.1](https://github.com/nrkno/tv-automation-server-core/compare/v1.47.1-1...v1.47.1) (2023-05-11)

**Note:** Version bump only for package @sofie-automation/blueprints-integration

# [1.49.0-in-testing.2](https://github.com/nrkno/tv-automation-server-core/compare/v1.47.1-0...v1.49.0-in-testing.2) (2023-03-30)

# [1.49.0-in-testing.1](https://github.com/nrkno/tv-automation-server-core/compare/v1.49.0-in-testing.0...v1.49.0-in-testing.1) (2023-03-23)

# [1.49.0-in-testing.0](https://github.com/nrkno/tv-automation-server-core/compare/v1.47.0...v1.49.0-in-testing.0) (2023-03-21)

### Bug Fixes

- downgrade type-fest (again) ([82346cc](https://github.com/nrkno/tv-automation-server-core/commit/82346cc9fc01a251c6dcb4d2f86ea954601ada32))

### Features

- add studio frameRate to coreConfig ([#870](https://github.com/nrkno/tv-automation-server-core/issues/870)) ([265ad61](https://github.com/nrkno/tv-automation-server-core/commit/265ad61048ca638471d2cb07eab1747dace8b92d))
- Expose peripheralDeviceActions to blueprints ([fdb61c9](https://github.com/nrkno/tv-automation-server-core/commit/fdb61c9e23a77a52c1fdc65cd40ba36c3005ce31))

# [1.48.0-in-testing.3](https://github.com/nrkno/tv-automation-server-core/compare/v1.48.0-in-testing.2...v1.48.0-in-testing.3) (2023-02-14)

# [1.48.0-in-testing.2](https://github.com/nrkno/tv-automation-server-core/compare/v1.47.0-in-testing.8...v1.48.0-in-testing.2) (2023-02-14)

### Bug Fixes

- update mos-connection dependency ([#820](https://github.com/nrkno/tv-automation-server-core/issues/820)) ([b5df74f](https://github.com/nrkno/tv-automation-server-core/commit/b5df74f26b29c1e0b85a6d85ae3b83277ed1f554))

# [1.48.0-in-testing.1](https://github.com/nrkno/tv-automation-server-core/compare/v1.47.0-in-testing.5...v1.48.0-in-testing.1) (2023-01-11)

### Bug Fixes

- refactor playout-gateway types into shared-lib ([#827](https://github.com/nrkno/tv-automation-server-core/issues/827)) ([d8245ff](https://github.com/nrkno/tv-automation-server-core/commit/d8245ff4e681cbb92ba09e1fb948525b6854b093))

### Features

- Blueprints migrations replacement ([#808](https://github.com/nrkno/tv-automation-server-core/issues/808)) ([7a0692a](https://github.com/nrkno/tv-automation-server-core/commit/7a0692a2216b5fc720f7342d6c7bc26410faf417))
- initial translations for tsr actions ([889fa04](https://github.com/nrkno/tv-automation-server-core/commit/889fa04b368d5bf34bd0acd5ad8c377b4f3af264))
- refactor timeline types to work better with typescript 4.7 ([#793](https://github.com/nrkno/tv-automation-server-core/issues/793)) ([1ec87ef](https://github.com/nrkno/tv-automation-server-core/commit/1ec87ef5578e4341225957e43132ef6a8f452503))
- remove initial system migrations with manual steps ([#779](https://github.com/nrkno/tv-automation-server-core/issues/779)) ([3f51952](https://github.com/nrkno/tv-automation-server-core/commit/3f519520fb0efdc36822982766bf780eed83bac7))
- stronger ddp call typings in gateways ([#788](https://github.com/nrkno/tv-automation-server-core/issues/788)) ([2a1f8af](https://github.com/nrkno/tv-automation-server-core/commit/2a1f8affad1b0278a2350c6e4f6ed7d3070121a1))
- tsr action manifests ([4987eaf](https://github.com/nrkno/tv-automation-server-core/commit/4987eaf3277a58311c1c2d2613af3bc72a5c4487))
- typings WIP ([0101b29](https://github.com/nrkno/tv-automation-server-core/commit/0101b29bdff7b1367bd27d16d524c24a1a8ae90a))

# [1.49.0-in-testing.1](https://github.com/nrkno/tv-automation-server-core/compare/v1.49.0-in-testing.0...v1.49.0-in-testing.1) (2023-03-23)

**Note:** Version bump only for package @sofie-automation/blueprints-integration

# [1.49.0-in-testing.0](https://github.com/nrkno/tv-automation-server-core/compare/v1.47.0...v1.49.0-in-testing.0) (2023-03-21)

### Bug Fixes

- downgrade type-fest (again) ([82346cc](https://github.com/nrkno/tv-automation-server-core/commit/82346cc9fc01a251c6dcb4d2f86ea954601ada32))

### Features

- add studio frameRate to coreConfig ([#870](https://github.com/nrkno/tv-automation-server-core/issues/870)) ([265ad61](https://github.com/nrkno/tv-automation-server-core/commit/265ad61048ca638471d2cb07eab1747dace8b92d))
- Expose peripheralDeviceActions to blueprints ([fdb61c9](https://github.com/nrkno/tv-automation-server-core/commit/fdb61c9e23a77a52c1fdc65cd40ba36c3005ce31))

# [1.48.0-in-testing.3](https://github.com/nrkno/tv-automation-server-core/compare/v1.48.0-in-testing.2...v1.48.0-in-testing.3) (2023-02-14)

# [1.48.0-in-testing.2](https://github.com/nrkno/tv-automation-server-core/compare/v1.47.0-in-testing.8...v1.48.0-in-testing.2) (2023-02-14)

### Bug Fixes

- update mos-connection dependency ([#820](https://github.com/nrkno/tv-automation-server-core/issues/820)) ([b5df74f](https://github.com/nrkno/tv-automation-server-core/commit/b5df74f26b29c1e0b85a6d85ae3b83277ed1f554))

# [1.48.0-in-testing.1](https://github.com/nrkno/tv-automation-server-core/compare/v1.47.0-in-testing.5...v1.48.0-in-testing.1) (2023-01-11)

### Bug Fixes

- refactor playout-gateway types into shared-lib ([#827](https://github.com/nrkno/tv-automation-server-core/issues/827)) ([d8245ff](https://github.com/nrkno/tv-automation-server-core/commit/d8245ff4e681cbb92ba09e1fb948525b6854b093))

### Features

- Blueprints migrations replacement ([#808](https://github.com/nrkno/tv-automation-server-core/issues/808)) ([7a0692a](https://github.com/nrkno/tv-automation-server-core/commit/7a0692a2216b5fc720f7342d6c7bc26410faf417))
- initial translations for tsr actions ([889fa04](https://github.com/nrkno/tv-automation-server-core/commit/889fa04b368d5bf34bd0acd5ad8c377b4f3af264))
- refactor timeline types to work better with typescript 4.7 ([#793](https://github.com/nrkno/tv-automation-server-core/issues/793)) ([1ec87ef](https://github.com/nrkno/tv-automation-server-core/commit/1ec87ef5578e4341225957e43132ef6a8f452503))
- remove initial system migrations with manual steps ([#779](https://github.com/nrkno/tv-automation-server-core/issues/779)) ([3f51952](https://github.com/nrkno/tv-automation-server-core/commit/3f519520fb0efdc36822982766bf780eed83bac7))
- stronger ddp call typings in gateways ([#788](https://github.com/nrkno/tv-automation-server-core/issues/788)) ([2a1f8af](https://github.com/nrkno/tv-automation-server-core/commit/2a1f8affad1b0278a2350c6e4f6ed7d3070121a1))
- tsr action manifests ([4987eaf](https://github.com/nrkno/tv-automation-server-core/commit/4987eaf3277a58311c1c2d2613af3bc72a5c4487))
- typings WIP ([0101b29](https://github.com/nrkno/tv-automation-server-core/commit/0101b29bdff7b1367bd27d16d524c24a1a8ae90a))

# [1.48.0-in-testing.3](https://github.com/nrkno/tv-automation-server-core/compare/v1.48.0-in-testing.2...v1.48.0-in-testing.3) (2023-02-14)

## [1.47.1-1](https://github.com/nrkno/tv-automation-server-core/compare/v1.47.1-0...v1.47.1-1) (2023-04-26)

**Note:** Version bump only for package @sofie-automation/blueprints-integration

## [1.47.1-0](https://github.com/nrkno/tv-automation-server-core/compare/v1.47.0...v1.47.1-0) (2023-03-30)

**Note:** Version bump only for package @sofie-automation/blueprints-integration

# [1.47.0](https://github.com/nrkno/tv-automation-server-core/compare/v1.47.0-in-testing.8...v1.47.0) (2023-03-01)

**Note:** Version bump only for package @sofie-automation/blueprints-integration

# [1.48.0-in-testing.2](https://github.com/nrkno/tv-automation-server-core/compare/v1.44.2...v1.48.0-in-testing.2) (2023-02-14)

# [1.47.0-in-testing.8](https://github.com/nrkno/tv-automation-server-core/compare/v1.44.2...v1.47.0-in-testing.8) (2023-02-14)

# [1.47.0-in-testing.7](https://github.com/nrkno/tv-automation-server-core/compare/v1.44.2-1...v1.47.0-in-testing.7) (2023-01-24)

# [1.47.0-in-testing.6](https://github.com/nrkno/tv-automation-server-core/compare/v1.44.2-0...v1.47.0-in-testing.6) (2023-01-16)

# [1.47.0-in-testing.5](https://github.com/nrkno/tv-automation-server-core/compare/v1.46.0-in-testing.2...v1.47.0-in-testing.5) (2023-01-11)

# [1.46.0-in-testing.2](https://github.com/nrkno/tv-automation-server-core/compare/v1.47.0-in-testing.4...v1.46.0-in-testing.2) (2023-01-06)

# [1.47.0-in-testing.4](https://github.com/nrkno/tv-automation-server-core/compare/v1.47.0-in-testing.3...v1.47.0-in-testing.4) (2023-01-05)

# [1.47.0-in-testing.3](https://github.com/nrkno/tv-automation-server-core/compare/v1.46.0-in-testing.1...v1.47.0-in-testing.3) (2022-11-30)

# [1.47.0-in-testing.2](https://github.com/nrkno/tv-automation-server-core/compare/v1.47.0-in-testing.1...v1.47.0-in-testing.2) (2022-11-07)

# [1.47.0-in-testing.1](https://github.com/nrkno/tv-automation-server-core/compare/v1.46.0-in-testing.0...v1.47.0-in-testing.1) (2022-11-07)

### Bug Fixes

- add an option to purge all Viz elements from the viz-rundown, in system-status view ([d22f0d6](https://github.com/nrkno/tv-automation-server-core/commit/d22f0d673e080fc7d9ca11ba7b9df1cb3e43c1d2))

# [1.46.0-in-testing.0](https://github.com/nrkno/tv-automation-server-core/compare/v1.47.0-in-testing.0...v1.46.0-in-testing.0) (2022-10-31)

# [1.47.0-in-testing.0](https://github.com/nrkno/tv-automation-server-core/compare/v1.44.0...v1.47.0-in-testing.0) (2022-10-28)

### Bug Fixes

- remove unused SourceLayerType.METADATA ([25dfc6d](https://github.com/nrkno/tv-automation-server-core/commit/25dfc6dd310ea07cfc933e8cc76cf5323b1d25d0))
- SOF-954 make hackGetMediaObjectDuration return values ([e762b0d](https://github.com/nrkno/tv-automation-server-core/commit/e762b0da601489531b7fde01057a753926d37b95))
- update TSR dep ([145bb57](https://github.com/nrkno/tv-automation-server-core/commit/145bb572c76e404d6effd4b3d1424ecf9b11e417))

### Features

- adlib actions can set timeline datastore ([0cd2f62](https://github.com/nrkno/tv-automation-server-core/commit/0cd2f62ba1a079ea0cc5b17c13846ead26ae7a21))
- datastore table view ([83467af](https://github.com/nrkno/tv-automation-server-core/commit/83467afec8f52521b8af5ebe91287cafcb000953))
- differentiate user/default settings datastructure changes ([#772](https://github.com/nrkno/tv-automation-server-core/issues/772)) ([b39067d](https://github.com/nrkno/tv-automation-server-core/commit/b39067d9e4e7b87e7e00a80bdca19aade8b3bc04))
- multi gateway mode ([#760](https://github.com/nrkno/tv-automation-server-core/issues/760)) ([9f23148](https://github.com/nrkno/tv-automation-server-core/commit/9f231486c47f414008f0f0f80ed4b665a2115b4a))
- prototype (WIP) ([01a2b8b](https://github.com/nrkno/tv-automation-server-core/commit/01a2b8bda9ad395f1a1bcdc2c246d16808240261))
- **Segment List View:** show AdLibs as indicators on each Part ([c7aceec](https://github.com/nrkno/tv-automation-server-core/commit/c7aceece784c6857f688fba62e4e3f1f8f7f2359))
- **Segment List:** rename One Part Per Line to SegmentList ([0e6b13e](https://github.com/nrkno/tv-automation-server-core/commit/0e6b13ef416029abda780633cf6f83ef6eeeef04))
- SOF-978 add config manifest entry showing a (multi)select with values from a table's column ([34e96e0](https://github.com/nrkno/tv-automation-server-core/commit/34e96e0ba2e62c9b149daf2c42bc7198cd757cf9))
- syncIngestUpdateToPartInstance is called when a Part is orphaned, and allows for removing the PartInstance ([#750](https://github.com/nrkno/tv-automation-server-core/issues/750)) ([fae7d3f](https://github.com/nrkno/tv-automation-server-core/commit/fae7d3f61c497b8d8e3048a966912aaa2b21cacf))

## [37.1.2](https://github.com/nrkno/tv-automation-server-core/compare/v37.1.1...v37.1.2) (2022-03-16)

# [1.47.0-in-testing.7](https://github.com/nrkno/tv-automation-server-core/compare/v1.47.0-in-testing.6...v1.47.0-in-testing.7) (2023-01-24)

# [1.47.0-in-testing.6](https://github.com/nrkno/tv-automation-server-core/compare/v1.47.0-in-testing.5...v1.47.0-in-testing.6) (2023-01-16)

**Note:** Version bump only for package @sofie-automation/blueprints-integration

# [1.47.0-in-testing.6](https://github.com/nrkno/tv-automation-server-core/compare/v1.47.0-in-testing.5...v1.47.0-in-testing.6) (2023-01-16)

# [1.47.0-in-testing.5](https://github.com/nrkno/tv-automation-server-core/compare/v1.47.0-in-testing.4...v1.47.0-in-testing.5) (2023-01-11)

# [1.47.0-in-testing.4](https://github.com/nrkno/tv-automation-server-core/compare/v1.47.0-in-testing.3...v1.47.0-in-testing.4) (2023-01-05)

# [1.47.0-in-testing.3](https://github.com/nrkno/tv-automation-server-core/compare/v1.46.0-in-testing.1...v1.47.0-in-testing.3) (2022-11-30)

# [1.47.0-in-testing.2](https://github.com/nrkno/tv-automation-server-core/compare/v1.47.0-in-testing.1...v1.47.0-in-testing.2) (2022-11-07)

# [1.47.0-in-testing.1](https://github.com/nrkno/tv-automation-server-core/compare/v1.46.0-in-testing.0...v1.47.0-in-testing.1) (2022-11-07)

### Bug Fixes

- add an option to purge all Viz elements from the viz-rundown, in system-status view ([d22f0d6](https://github.com/nrkno/tv-automation-server-core/commit/d22f0d673e080fc7d9ca11ba7b9df1cb3e43c1d2))

# [1.47.0-in-testing.0](https://github.com/nrkno/tv-automation-server-core/compare/v1.44.0...v1.47.0-in-testing.0) (2022-10-28)

### Features

- adlib actions can set timeline datastore ([0cd2f62](https://github.com/nrkno/tv-automation-server-core/commit/0cd2f62ba1a079ea0cc5b17c13846ead26ae7a21))
- datastore table view ([83467af](https://github.com/nrkno/tv-automation-server-core/commit/83467afec8f52521b8af5ebe91287cafcb000953))
- differentiate user/default settings datastructure changes ([#772](https://github.com/nrkno/tv-automation-server-core/issues/772)) ([b39067d](https://github.com/nrkno/tv-automation-server-core/commit/b39067d9e4e7b87e7e00a80bdca19aade8b3bc04))
- multi gateway mode ([#760](https://github.com/nrkno/tv-automation-server-core/issues/760)) ([9f23148](https://github.com/nrkno/tv-automation-server-core/commit/9f231486c47f414008f0f0f80ed4b665a2115b4a))
- SOF-978 add config manifest entry showing a (multi)select with values from a table's column ([34e96e0](https://github.com/nrkno/tv-automation-server-core/commit/34e96e0ba2e62c9b149daf2c42bc7198cd757cf9))

# [1.46.0-in-testing.2](https://github.com/nrkno/tv-automation-server-core/compare/v1.46.0-in-testing.1...v1.46.0-in-testing.2) (2023-01-06)

**Note:** Version bump only for package @sofie-automation/blueprints-integration

# [1.46.0-in-testing.1](https://github.com/nrkno/tv-automation-server-core/compare/v1.46.0-in-testing.0...v1.46.0-in-testing.1) (2022-11-30)

**Note:** Version bump only for package @sofie-automation/blueprints-integration

# [1.46.0-in-testing.0](https://github.com/nrkno/tv-automation-server-core/compare/v1.44.0...v1.46.0-in-testing.0) (2022-10-31)

### Bug Fixes

- remove unused SourceLayerType.METADATA ([25dfc6d](https://github.com/nrkno/tv-automation-server-core/commit/25dfc6dd310ea07cfc933e8cc76cf5323b1d25d0))
- SOF-954 make hackGetMediaObjectDuration return values ([e762b0d](https://github.com/nrkno/tv-automation-server-core/commit/e762b0da601489531b7fde01057a753926d37b95))
- update TSR dep ([145bb57](https://github.com/nrkno/tv-automation-server-core/commit/145bb572c76e404d6effd4b3d1424ecf9b11e417))

### Features

- adlib actions can set timeline datastore ([0cd2f62](https://github.com/nrkno/tv-automation-server-core/commit/0cd2f62ba1a079ea0cc5b17c13846ead26ae7a21))
- datastore table view ([83467af](https://github.com/nrkno/tv-automation-server-core/commit/83467afec8f52521b8af5ebe91287cafcb000953))
- differentiate user/default settings datastructure changes ([#772](https://github.com/nrkno/tv-automation-server-core/issues/772)) ([b39067d](https://github.com/nrkno/tv-automation-server-core/commit/b39067d9e4e7b87e7e00a80bdca19aade8b3bc04))
- multi gateway mode ([#760](https://github.com/nrkno/tv-automation-server-core/issues/760)) ([9f23148](https://github.com/nrkno/tv-automation-server-core/commit/9f231486c47f414008f0f0f80ed4b665a2115b4a))
- prototype (WIP) ([01a2b8b](https://github.com/nrkno/tv-automation-server-core/commit/01a2b8bda9ad395f1a1bcdc2c246d16808240261))
- **Segment List View:** show AdLibs as indicators on each Part ([c7aceec](https://github.com/nrkno/tv-automation-server-core/commit/c7aceece784c6857f688fba62e4e3f1f8f7f2359))
- **Segment List:** rename One Part Per Line to SegmentList ([0e6b13e](https://github.com/nrkno/tv-automation-server-core/commit/0e6b13ef416029abda780633cf6f83ef6eeeef04))
- SOF-978 add config manifest entry showing a (multi)select with values from a table's column ([34e96e0](https://github.com/nrkno/tv-automation-server-core/commit/34e96e0ba2e62c9b149daf2c42bc7198cd757cf9))
- syncIngestUpdateToPartInstance is called when a Part is orphaned, and allows for removing the PartInstance ([#750](https://github.com/nrkno/tv-automation-server-core/issues/750)) ([fae7d3f](https://github.com/nrkno/tv-automation-server-core/commit/fae7d3f61c497b8d8e3048a966912aaa2b21cacf))

## [1.44.2](https://github.com/nrkno/tv-automation-server-core/compare/v1.44.2-1...v1.44.2) (2023-01-27)

**Note:** Version bump only for package @sofie-automation/blueprints-integration

## [1.44.2-1](https://github.com/nrkno/tv-automation-server-core/compare/v1.44.2-0...v1.44.2-1) (2023-01-23)

**Note:** Version bump only for package @sofie-automation/blueprints-integration

## [1.44.2-0](https://github.com/nrkno/tv-automation-server-core/compare/v1.44.1...v1.44.2-0) (2023-01-11)

**Note:** Version bump only for package @sofie-automation/blueprints-integration

## [1.44.1](https://github.com/nrkno/tv-automation-server-core/compare/v1.44.0...v1.44.1) (2022-11-28)

**Note:** Version bump only for package @sofie-automation/blueprints-integration

# [1.44.0](https://github.com/nrkno/tv-automation-server-core/compare/v1.44.0-in-testing.3...v1.44.0) (2022-10-24)

**Note:** Version bump only for package @sofie-automation/blueprints-integration

# [1.44.0-in-testing.3](https://github.com/nrkno/tv-automation-server-core/compare/v1.44.0-in-testing.2...v1.44.0-in-testing.3) (2022-10-24)

**Note:** Version bump only for package @sofie-automation/blueprints-integration

# [1.44.0-in-testing.2](https://github.com/nrkno/tv-automation-server-core/compare/v1.41.4...v1.44.0-in-testing.2) (2022-10-13)

# [1.44.0-in-testing.1](https://github.com/nrkno/tv-automation-server-core/compare/v1.44.0-in-testing.0...v1.44.0-in-testing.1) (2022-07-05)

# [1.44.0-in-testing.0](https://github.com/nrkno/tv-automation-server-core/compare/v1.41.0...v1.44.0-in-testing.0) (2022-07-04)

### Bug Fixes

- race condition on manual rundown move ([#728](https://github.com/nrkno/tv-automation-server-core/issues/728)) ([a12f7d8](https://github.com/nrkno/tv-automation-server-core/commit/a12f7d8082fe1c08b5c68d6d536cbc5b32c1aebf))
- remove deprecated ConfigManifestEntryType.Number ([cb777aa](https://github.com/nrkno/tv-automation-server-core/commit/cb777aa1d7738a8b72da8aa21943c58bc9b5df9c))

### Features

- **Action Triggers:** Select AdLib Action Trigger Modes ([#740](https://github.com/nrkno/tv-automation-server-core/issues/740)) ([311b9e4](https://github.com/nrkno/tv-automation-server-core/commit/311b9e41b46025bdf759fccc1c97d94318661c83))

# [1.43.0-in-testing.0](https://github.com/nrkno/tv-automation-server-core/compare/v1.39.0...v1.43.0-in-testing.0) (2022-05-18)

### Features

- move more logic into workers ([#718](https://github.com/nrkno/tv-automation-server-core/issues/718)) ([3376826](https://github.com/nrkno/tv-automation-server-core/commit/3376826e4029985e3975d6d5a85f9ab1f06a9dd4))

## [1.42.5](https://github.com/nrkno/tv-automation-server-core/compare/v1.42.4...v1.42.5) (2022-05-03)

## [1.42.4](https://github.com/nrkno/tv-automation-server-core/compare/v1.39.0...v1.42.4) (2022-05-03)

## [37.1.2](https://github.com/nrkno/tv-automation-server-core/compare/v37.1.1...v37.1.2) (2022-03-16)

# [1.39.0](https://github.com/nrkno/tv-automation-server-core/compare/v1.42.0-in-testing.0...v1.39.0) (2022-04-29)

# [1.42.0-in-testing.0](https://github.com/nrkno/tv-automation-server-core/compare/v1.41.0-in-testing.1...v1.42.0-in-testing.0) (2022-04-29)

### Bug Fixes

- update supertimeline ([#703](https://github.com/nrkno/tv-automation-server-core/issues/703)) ([897d81e](https://github.com/nrkno/tv-automation-server-core/commit/897d81ef2648947cd23caee6edf80d26e5a05de0))

### Features

- piece postroll ([674d7c5](https://github.com/nrkno/tv-automation-server-core/commit/674d7c588998e59a794b1da64276f73637ae8556))

# [1.44.0-in-testing.1](https://github.com/nrkno/tv-automation-server-core/compare/v1.44.0-in-testing.0...v1.44.0-in-testing.1) (2022-07-05)

**Note:** Version bump only for package @sofie-automation/blueprints-integration

# [1.44.0-in-testing.0](https://github.com/nrkno/tv-automation-server-core/compare/v1.41.0...v1.44.0-in-testing.0) (2022-07-04)

### Bug Fixes

- race condition on manual rundown move ([#728](https://github.com/nrkno/tv-automation-server-core/issues/728)) ([a12f7d8](https://github.com/nrkno/tv-automation-server-core/commit/a12f7d8082fe1c08b5c68d6d536cbc5b32c1aebf))
- remove deprecated ConfigManifestEntryType.Number ([cb777aa](https://github.com/nrkno/tv-automation-server-core/commit/cb777aa1d7738a8b72da8aa21943c58bc9b5df9c))

### Features

- **Action Triggers:** Select AdLib Action Trigger Modes ([#740](https://github.com/nrkno/tv-automation-server-core/issues/740)) ([311b9e4](https://github.com/nrkno/tv-automation-server-core/commit/311b9e41b46025bdf759fccc1c97d94318661c83))

# [1.43.0-in-testing.0](https://github.com/nrkno/tv-automation-server-core/compare/v1.39.0...v1.43.0-in-testing.0) (2022-05-18)

### Features

- move more logic into workers ([#718](https://github.com/nrkno/tv-automation-server-core/issues/718)) ([3376826](https://github.com/nrkno/tv-automation-server-core/commit/3376826e4029985e3975d6d5a85f9ab1f06a9dd4))

# [1.39.0](https://github.com/nrkno/tv-automation-server-core/compare/v1.42.0-in-testing.0...v1.39.0) (2022-04-29)

# [1.42.0-in-testing.0](https://github.com/nrkno/tv-automation-server-core/compare/v1.41.0-in-testing.1...v1.42.0-in-testing.0) (2022-04-29)

### Bug Fixes

- update supertimeline ([#703](https://github.com/nrkno/tv-automation-server-core/issues/703)) ([897d81e](https://github.com/nrkno/tv-automation-server-core/commit/897d81ef2648947cd23caee6edf80d26e5a05de0))

### Features

- piece postroll ([674d7c5](https://github.com/nrkno/tv-automation-server-core/commit/674d7c588998e59a794b1da64276f73637ae8556))

# [1.43.0-in-testing.0](https://github.com/nrkno/tv-automation-server-core/compare/v1.42.0-in-testing.0...v1.43.0-in-testing.0) (2022-05-18)

### Features

- move more logic into workers ([#718](https://github.com/nrkno/tv-automation-server-core/issues/718)) ([3376826](https://github.com/nrkno/tv-automation-server-core/commit/3376826e4029985e3975d6d5a85f9ab1f06a9dd4))

# [1.42.0-in-testing.0](https://github.com/nrkno/tv-automation-server-core/compare/v1.38.4...v1.42.0-in-testing.0) (2022-04-29)

## [1.41.4](https://github.com/nrkno/tv-automation-server-core/compare/v1.41.4-0...v1.41.4) (2022-08-18)

**Note:** Version bump only for package @sofie-automation/blueprints-integration

## [1.41.4-0](https://github.com/nrkno/tv-automation-server-core/compare/v1.41.3...v1.41.4-0) (2022-08-17)

**Note:** Version bump only for package @sofie-automation/blueprints-integration

## [1.41.3](https://github.com/nrkno/tv-automation-server-core/compare/v1.41.2...v1.41.3) (2022-08-10)

### Bug Fixes

- support NOT filters in Shelf layouts ([be3aac0](https://github.com/nrkno/tv-automation-server-core/commit/be3aac0d7b4b31fd4a8fdaa2702221fcbd9b07b6))
- update supertimeline ([#703](https://github.com/nrkno/tv-automation-server-core/issues/703)) ([897d81e](https://github.com/nrkno/tv-automation-server-core/commit/897d81ef2648947cd23caee6edf80d26e5a05de0))
- upgrade tsr ([32105d6](https://github.com/nrkno/tv-automation-server-core/commit/32105d623685f6feaa0ee30c723fcd494376fb11))

### Features

- piece postroll ([674d7c5](https://github.com/nrkno/tv-automation-server-core/commit/674d7c588998e59a794b1da64276f73637ae8556))

# [1.41.0](https://github.com/nrkno/tv-automation-server-core/compare/v1.41.0-in-testing.1...v1.41.0) (2022-06-28)

# [1.39.0](https://github.com/nrkno/tv-automation-server-core/compare/v1.38.4...v1.39.0) (2022-04-29)

# [1.39.0-in-testing.7](https://github.com/nrkno/tv-automation-server-core/compare/v1.38.3...v1.39.0-in-testing.7) (2022-03-30)

# [1.41.0-in-testing.0](https://github.com/nrkno/tv-automation-server-core/compare/v1.38.2...v1.41.0-in-testing.0) (2022-03-28)

### Bug Fixes

- fix potential edge-case where blueprints would set allVariants for only SOME variants (they shouldn't really, but still) ([a5db882](https://github.com/nrkno/tv-automation-server-core/commit/a5db8823983eda8fe5b3d8afa8ca5ee82b9db935))

# [1.39.0-in-testing.5](https://github.com/nrkno/tv-automation-server-core/compare/v1.40.0-in-testing.1...v1.39.0-in-testing.5) (2022-03-11)

# [1.40.0-in-testing.1](https://github.com/nrkno/tv-automation-server-core/compare/v1.39.0-in-testing.4...v1.40.0-in-testing.1) (2022-03-10)

# [1.39.0-in-testing.4](https://github.com/nrkno/tv-automation-server-core/compare/v1.38.2-1...v1.39.0-in-testing.4) (2022-03-10)

### Bug Fixes

- add getRandomId() to context ([7990014](https://github.com/nrkno/tv-automation-server-core/commit/79900144636a34f40c465c4501ef0bdcad6f116e))
- mongo client 4.2 typings break on timelineObjects ([#671](https://github.com/nrkno/tv-automation-server-core/issues/671)) ([ce9d4b3](https://github.com/nrkno/tv-automation-server-core/commit/ce9d4b3a862d93f61e895c27e65f25609679a4ff))

### Features

- add "allVariants" property to IBlueprintActionManifest and showStyleBaseId to AdlibActions/AdlibPiece ([2a8db5a](https://github.com/nrkno/tv-automation-server-core/commit/2a8db5a83c6a8c3a21c8a0935092e67135caae12))
- add and use uniquenessId for bucket adlibs ([ff04c1b](https://github.com/nrkno/tv-automation-server-core/commit/ff04c1b07c3f9ec7e118fdd9e1f4ca6c25a61594))
- better handling of non-unqiue externalId for pieces and other types ([#685](https://github.com/nrkno/tv-automation-server-core/issues/685)) ([02a891e](https://github.com/nrkno/tv-automation-server-core/commit/02a891e66dd8c9aa01b2ceb1634ac425ab18217d))
- MigrationContextWithTriggeredActions exposes getTriggeredActionsId ([7bba681](https://github.com/nrkno/tv-automation-server-core/commit/7bba681a7eb628a8d476f6802e79c77153d69239))

# [1.39.0-in-testing.3](https://github.com/nrkno/tv-automation-server-core/compare/v1.38.2-0...v1.39.0-in-testing.3) (2022-02-14)

### Bug Fixes

- add getCurrentPlaylist to blueprint getRundown-context ([4a43e14](https://github.com/nrkno/tv-automation-server-core/commit/4a43e14287d41ae7775a7301b5be1ab7bd227e96))

# [1.40.0-in-testing.0](https://github.com/nrkno/tv-automation-server-core/compare/v1.39.0-in-testing.1...v1.40.0-in-testing.0) (2022-02-09)

### Bug Fixes

- blueprints-integration: allow getRundown to be async, to be able to call async functions therein ([b166cca](https://github.com/nrkno/tv-automation-server-core/commit/b166cca3376ee4d3ae747dac9a8268ea9131898a))
- change context type of getRundown ([52f981a](https://github.com/nrkno/tv-automation-server-core/commit/52f981ab485cfcf06fa4a01ed1feeac1ef2d0742))

# [1.39.0-in-testing.1](https://github.com/nrkno/tv-automation-server-core/compare/v1.39.0-in-testing.0...v1.39.0-in-testing.1) (2022-02-07)

### Features

- allow sync of previous Part Instances ([#674](https://github.com/nrkno/tv-automation-server-core/issues/674)) ([04d0142](https://github.com/nrkno/tv-automation-server-core/commit/04d01427e85e6df99400387bec71b1b2b7fa4a3e))
- update blueprint interface to support a new way of assigning rundowns to playlists ([3bf092e](https://github.com/nrkno/tv-automation-server-core/commit/3bf092e2f56a1e448d0909430f155d6e7c48ac9a))

# [1.39.0-in-testing.0](https://github.com/nrkno/tv-automation-server-core/compare/v1.38.1...v1.39.0-in-testing.0) (2022-02-04)

### Bug Fixes

- blueprints-integration typing issue ([7c3a93a](https://github.com/nrkno/tv-automation-server-core/commit/7c3a93af23f08a7c4b6b41ce28e6b2624fb135a7))
- replace codecov from npm with github action ([f390abb](https://github.com/nrkno/tv-automation-server-core/commit/f390abbfef492b956ac947534a8a4e9e1a03f521))

### Features

- adlib-actions can block a take from happening until a certain time ([588f4d9](https://github.com/nrkno/tv-automation-server-core/commit/588f4d9f071530b59fb400e7a3e1d3ad43e5090f))
- out transitions ([03101a5](https://github.com/nrkno/tv-automation-server-core/commit/03101a503a82254baeaa279c4131cdad308c5344))

# [1.41.0-in-testing.1](https://github.com/nrkno/tv-automation-server-core/compare/v1.38.4...v1.41.0-in-testing.1) (2022-04-28)

### Bug Fixes

- support NOT filters in Shelf layouts ([be3aac0](https://github.com/nrkno/tv-automation-server-core/commit/be3aac0d7b4b31fd4a8fdaa2702221fcbd9b07b6))
- upgrade tsr ([32105d6](https://github.com/nrkno/tv-automation-server-core/commit/32105d623685f6feaa0ee30c723fcd494376fb11))

# [1.41.0-in-testing.0](https://github.com/nrkno/tv-automation-server-core/compare/v1.38.2...v1.41.0-in-testing.0) (2022-03-28)

### Bug Fixes

- fix potential edge-case where blueprints would set allVariants for only SOME variants (they shouldn't really, but still) ([a5db882](https://github.com/nrkno/tv-automation-server-core/commit/a5db8823983eda8fe5b3d8afa8ca5ee82b9db935))

# [1.39.0-in-testing.5](https://github.com/nrkno/tv-automation-server-core/compare/v1.40.0-in-testing.1...v1.39.0-in-testing.5) (2022-03-11)

# [1.40.0-in-testing.1](https://github.com/nrkno/tv-automation-server-core/compare/v1.39.0-in-testing.4...v1.40.0-in-testing.1) (2022-03-10)

# [1.39.0-in-testing.4](https://github.com/nrkno/tv-automation-server-core/compare/v1.38.2-1...v1.39.0-in-testing.4) (2022-03-10)

### Bug Fixes

- add getRandomId() to context ([7990014](https://github.com/nrkno/tv-automation-server-core/commit/79900144636a34f40c465c4501ef0bdcad6f116e))
- mongo client 4.2 typings break on timelineObjects ([#671](https://github.com/nrkno/tv-automation-server-core/issues/671)) ([ce9d4b3](https://github.com/nrkno/tv-automation-server-core/commit/ce9d4b3a862d93f61e895c27e65f25609679a4ff))

### Features

- add "allVariants" property to IBlueprintActionManifest and showStyleBaseId to AdlibActions/AdlibPiece ([2a8db5a](https://github.com/nrkno/tv-automation-server-core/commit/2a8db5a83c6a8c3a21c8a0935092e67135caae12))
- add and use uniquenessId for bucket adlibs ([ff04c1b](https://github.com/nrkno/tv-automation-server-core/commit/ff04c1b07c3f9ec7e118fdd9e1f4ca6c25a61594))
- better handling of non-unqiue externalId for pieces and other types ([#685](https://github.com/nrkno/tv-automation-server-core/issues/685)) ([02a891e](https://github.com/nrkno/tv-automation-server-core/commit/02a891e66dd8c9aa01b2ceb1634ac425ab18217d))
- MigrationContextWithTriggeredActions exposes getTriggeredActionsId ([7bba681](https://github.com/nrkno/tv-automation-server-core/commit/7bba681a7eb628a8d476f6802e79c77153d69239))

# [1.39.0-in-testing.3](https://github.com/nrkno/tv-automation-server-core/compare/v1.38.2-0...v1.39.0-in-testing.3) (2022-02-14)

### Bug Fixes

- add getCurrentPlaylist to blueprint getRundown-context ([4a43e14](https://github.com/nrkno/tv-automation-server-core/commit/4a43e14287d41ae7775a7301b5be1ab7bd227e96))

# [1.40.0-in-testing.0](https://github.com/nrkno/tv-automation-server-core/compare/v1.39.0-in-testing.1...v1.40.0-in-testing.0) (2022-02-09)

### Bug Fixes

- blueprints-integration: allow getRundown to be async, to be able to call async functions therein ([b166cca](https://github.com/nrkno/tv-automation-server-core/commit/b166cca3376ee4d3ae747dac9a8268ea9131898a))
- change context type of getRundown ([52f981a](https://github.com/nrkno/tv-automation-server-core/commit/52f981ab485cfcf06fa4a01ed1feeac1ef2d0742))

# [1.39.0-in-testing.1](https://github.com/nrkno/tv-automation-server-core/compare/v1.39.0-in-testing.0...v1.39.0-in-testing.1) (2022-02-07)

### Features

- allow sync of previous Part Instances ([#674](https://github.com/nrkno/tv-automation-server-core/issues/674)) ([04d0142](https://github.com/nrkno/tv-automation-server-core/commit/04d01427e85e6df99400387bec71b1b2b7fa4a3e))
- update blueprint interface to support a new way of assigning rundowns to playlists ([3bf092e](https://github.com/nrkno/tv-automation-server-core/commit/3bf092e2f56a1e448d0909430f155d6e7c48ac9a))

# [1.39.0-in-testing.0](https://github.com/nrkno/tv-automation-server-core/compare/v1.38.1...v1.39.0-in-testing.0) (2022-02-04)

### Bug Fixes

- blueprints-integration typing issue ([7c3a93a](https://github.com/nrkno/tv-automation-server-core/commit/7c3a93af23f08a7c4b6b41ce28e6b2624fb135a7))
- replace codecov from npm with github action ([f390abb](https://github.com/nrkno/tv-automation-server-core/commit/f390abbfef492b956ac947534a8a4e9e1a03f521))

### Features

- adlib-actions can block a take from happening until a certain time ([588f4d9](https://github.com/nrkno/tv-automation-server-core/commit/588f4d9f071530b59fb400e7a3e1d3ad43e5090f))
- out transitions ([03101a5](https://github.com/nrkno/tv-automation-server-core/commit/03101a503a82254baeaa279c4131cdad308c5344))

# [1.41.0-in-testing.0](https://github.com/nrkno/tv-automation-server-core/compare/v1.39.0-in-testing.5...v1.41.0-in-testing.0) (2022-03-28)

# [1.40.0-in-testing.1](https://github.com/nrkno/tv-automation-server-core/compare/v1.39.0-in-testing.4...v1.40.0-in-testing.1) (2022-03-10)

### Bug Fixes

- add getCurrentPlaylist to blueprint getRundown-context ([4a43e14](https://github.com/nrkno/tv-automation-server-core/commit/4a43e14287d41ae7775a7301b5be1ab7bd227e96))
- add getRandomId() to context ([7990014](https://github.com/nrkno/tv-automation-server-core/commit/79900144636a34f40c465c4501ef0bdcad6f116e))
- mongo client 4.2 typings break on timelineObjects ([#671](https://github.com/nrkno/tv-automation-server-core/issues/671)) ([ce9d4b3](https://github.com/nrkno/tv-automation-server-core/commit/ce9d4b3a862d93f61e895c27e65f25609679a4ff))

### Features

- better handling of non-unqiue externalId for pieces and other types ([#685](https://github.com/nrkno/tv-automation-server-core/issues/685)) ([02a891e](https://github.com/nrkno/tv-automation-server-core/commit/02a891e66dd8c9aa01b2ceb1634ac425ab18217d))

# [1.40.0-in-testing.0](https://github.com/nrkno/tv-automation-server-core/compare/v1.39.0-in-testing.1...v1.40.0-in-testing.0) (2022-02-09)

### Bug Fixes

- blueprints-integration typing issue ([7c3a93a](https://github.com/nrkno/tv-automation-server-core/commit/7c3a93af23f08a7c4b6b41ce28e6b2624fb135a7))
- blueprints-integration: allow getRundown to be async, to be able to call async functions therein ([b166cca](https://github.com/nrkno/tv-automation-server-core/commit/b166cca3376ee4d3ae747dac9a8268ea9131898a))
- change context type of getRundown ([52f981a](https://github.com/nrkno/tv-automation-server-core/commit/52f981ab485cfcf06fa4a01ed1feeac1ef2d0742))
- replace codecov from npm with github action ([f390abb](https://github.com/nrkno/tv-automation-server-core/commit/f390abbfef492b956ac947534a8a4e9e1a03f521))

### Features

- update blueprint interface to support a new way of assigning rundowns to playlists ([3bf092e](https://github.com/nrkno/tv-automation-server-core/commit/3bf092e2f56a1e448d0909430f155d6e7c48ac9a))

# [1.40.0-in-testing.1](https://github.com/nrkno/tv-automation-server-core/compare/v1.39.0-in-testing.4...v1.40.0-in-testing.1) (2022-03-10)

# [1.40.0-in-testing.0](https://github.com/nrkno/tv-automation-server-core/compare/v1.39.0-in-testing.1...v1.40.0-in-testing.0) (2022-02-09)

### Bug Fixes

- blueprints-integration typing issue ([7c3a93a](https://github.com/nrkno/tv-automation-server-core/commit/7c3a93af23f08a7c4b6b41ce28e6b2624fb135a7))
- replace codecov from npm with github action ([f390abb](https://github.com/nrkno/tv-automation-server-core/commit/f390abbfef492b956ac947534a8a4e9e1a03f521))

# [1.40.0-in-testing.0](https://github.com/nrkno/tv-automation-server-core/compare/v1.39.0-in-testing.1...v1.40.0-in-testing.0) (2022-02-09)

# [1.39.0-in-testing.4](https://github.com/nrkno/tv-automation-server-core/compare/v1.38.2-1...v1.39.0-in-testing.4) (2022-03-10)

### Features

- MigrationContextWithTriggeredActions exposes getTriggeredActionsId ([7bba681](https://github.com/nrkno/tv-automation-server-core/commit/7bba681a7eb628a8d476f6802e79c77153d69239))

# [1.39.0-in-testing.3](https://github.com/nrkno/tv-automation-server-core/compare/v1.38.2-0...v1.39.0-in-testing.3) (2022-02-14)

# [1.39.0-in-testing.1](https://github.com/nrkno/tv-automation-server-core/compare/v1.39.0-in-testing.0...v1.39.0-in-testing.1) (2022-02-07)

### Features

- allow sync of previous Part Instances ([#674](https://github.com/nrkno/tv-automation-server-core/issues/674)) ([04d0142](https://github.com/nrkno/tv-automation-server-core/commit/04d01427e85e6df99400387bec71b1b2b7fa4a3e))

# [1.39.0-in-testing.0](https://github.com/nrkno/tv-automation-server-core/compare/v1.38.1...v1.39.0-in-testing.0) (2022-02-04)

### Features

- adlib-actions can block a take from happening until a certain time ([588f4d9](https://github.com/nrkno/tv-automation-server-core/commit/588f4d9f071530b59fb400e7a3e1d3ad43e5090f))
- out transitions ([03101a5](https://github.com/nrkno/tv-automation-server-core/commit/03101a503a82254baeaa279c4131cdad308c5344))

# [1.39.0-in-testing.3](https://github.com/nrkno/tv-automation-server-core/compare/v1.38.2-0...v1.39.0-in-testing.3) (2022-02-14)

### Bug Fixes

- blueprints-integration typing issue ([7c3a93a](https://github.com/nrkno/tv-automation-server-core/commit/7c3a93af23f08a7c4b6b41ce28e6b2624fb135a7))
- replace codecov from npm with github action ([f390abb](https://github.com/nrkno/tv-automation-server-core/commit/f390abbfef492b956ac947534a8a4e9e1a03f521))

# [1.39.0-in-testing.1](https://github.com/nrkno/tv-automation-server-core/compare/v1.39.0-in-testing.0...v1.39.0-in-testing.1) (2022-02-07)

### Features

- allow sync of previous Part Instances ([#674](https://github.com/nrkno/tv-automation-server-core/issues/674)) ([04d0142](https://github.com/nrkno/tv-automation-server-core/commit/04d01427e85e6df99400387bec71b1b2b7fa4a3e))

# [1.39.0-in-testing.0](https://github.com/nrkno/tv-automation-server-core/compare/v1.38.1...v1.39.0-in-testing.0) (2022-02-04)

### Features

- adlib-actions can block a take from happening until a certain time ([588f4d9](https://github.com/nrkno/tv-automation-server-core/commit/588f4d9f071530b59fb400e7a3e1d3ad43e5090f))
- out transitions ([03101a5](https://github.com/nrkno/tv-automation-server-core/commit/03101a503a82254baeaa279c4131cdad308c5344))

## [1.38.1](https://github.com/nrkno/tv-automation-server-core/compare/v1.38.0...v1.38.1) (2022-01-27)

**Note:** Version bump only for package @sofie-automation/blueprints-integration

# [1.38.0](https://github.com/nrkno/tv-automation-server-core/compare/v1.37.2...v1.38.0) (2022-01-26)

### Bug Fixes

- Make shouldRemoveOrphanedPartInstance return a bool ([584e649](https://github.com/nrkno/tv-automation-server-core/commit/584e649d856b353a1e63dd305b852bbe6b14b702))
- performance is degraded in Blink >= 96 (CompositeAfterPaint) ([#635](https://github.com/nrkno/tv-automation-server-core/issues/635)) ([a07fea2](https://github.com/nrkno/tv-automation-server-core/commit/a07fea26f86a4bf03ed445a52165ca7ae418cfd2))
- use a unified diff calculation ([#607](https://github.com/nrkno/tv-automation-server-core/issues/607)) ([ccf0218](https://github.com/nrkno/tv-automation-server-core/commit/ccf021828bf08abb22f8191f04098a468d39bb1c))

### Features

- Segment Storyboard ([#625](https://github.com/nrkno/tv-automation-server-core/issues/625)) ([c862d7b](https://github.com/nrkno/tv-automation-server-core/commit/c862d7b11b565ddace36bcd758df9f441fa5ece0))

# [1.38.0-in-testing.2](https://github.com/nrkno/tv-automation-server-core/compare/v1.38.0-in-testing.1...v1.38.0-in-testing.2) (2021-12-17)

# [1.38.0-in-testing.1](https://github.com/nrkno/tv-automation-server-core/compare/v1.37.1-0...v1.38.0-in-testing.1) (2021-12-17)

# [1.38.0-in-testing.0](https://github.com/nrkno/tv-automation-server-core/compare/v1.37.0...v1.38.0-in-testing.0) (2021-12-17)

### Bug Fixes

- provide playlistExternalId to blueprints getRundownPlaylistInfo ([c71146f](https://github.com/nrkno/tv-automation-server-core/commit/c71146fcae7aded1e7691a2b241c0465c0ad30a3))
- update code-preset, lints only changed files ([10fb7dc](https://github.com/nrkno/tv-automation-server-core/commit/10fb7dc9e024ffebd67c4accdf82d6bb0369893e))

### Features

- add comment field for script content ([#600](https://github.com/nrkno/tv-automation-server-core/issues/600)) ([cf6332f](https://github.com/nrkno/tv-automation-server-core/commit/cf6332fe777147ebd7aee386a743ee2675211f07))
- add info level user notifications for blueprint contexts ([29d3068](https://github.com/nrkno/tv-automation-server-core/commit/29d306845c496013c394e3d940fa845d0d66f3db))
- add level property to Part invalidReason ([#582](https://github.com/nrkno/tv-automation-server-core/issues/582)) [publish] ([52205fc](https://github.com/nrkno/tv-automation-server-core/commit/52205fc4f315515bc92037e3f67ab04c77415b93))
- Budget Duration ([#556](https://github.com/nrkno/tv-automation-server-core/issues/556)) ([4b7627d](https://github.com/nrkno/tv-automation-server-core/commit/4b7627dda1ed914f5fc949e548181f8e38f65d02))
- rundown metadata update ([#591](https://github.com/nrkno/tv-automation-server-core/issues/591)) ([8da7eda](https://github.com/nrkno/tv-automation-server-core/commit/8da7eda76f1eb8f5ab0e84ac75326317f69823de))
- Rundown view, rundown header, and presenter view customization ([#551](https://github.com/nrkno/tv-automation-server-core/issues/551)) ([f945594](https://github.com/nrkno/tv-automation-server-core/commit/f945594ff7983618c79d66023e8628eeaa93f898)), closes [#554](https://github.com/nrkno/tv-automation-server-core/issues/554)
- shouldRemoveOrphanedPartInstance ([25321b2](https://github.com/nrkno/tv-automation-server-core/commit/25321b28ffbc53c8d4771c3d6e91063d9e3bc68a))

# [1.38.0-in-testing.2](https://github.com/nrkno/tv-automation-server-core/compare/v1.38.0-in-testing.1...v1.38.0-in-testing.2) (2021-12-17)

**Note:** Version bump only for package @sofie-automation/blueprints-integration

# [1.38.0-in-testing.1](https://github.com/nrkno/tv-automation-server-core/compare/v1.38.0-in-testing.0...v1.38.0-in-testing.1) (2021-12-17)

**Note:** Version bump only for package @sofie-automation/blueprints-integration

# [1.38.0-in-testing.0](https://github.com/nrkno/tv-automation-server-core/compare/v1.37.0...v1.38.0-in-testing.0) (2021-12-17)

### Bug Fixes

- provide playlistExternalId to blueprints getRundownPlaylistInfo ([c71146f](https://github.com/nrkno/tv-automation-server-core/commit/c71146fcae7aded1e7691a2b241c0465c0ad30a3))
- update code-preset, lints only changed files ([10fb7dc](https://github.com/nrkno/tv-automation-server-core/commit/10fb7dc9e024ffebd67c4accdf82d6bb0369893e))

### Features

- add comment field for script content ([#600](https://github.com/nrkno/tv-automation-server-core/issues/600)) ([cf6332f](https://github.com/nrkno/tv-automation-server-core/commit/cf6332fe777147ebd7aee386a743ee2675211f07))
- add info level user notifications for blueprint contexts ([29d3068](https://github.com/nrkno/tv-automation-server-core/commit/29d306845c496013c394e3d940fa845d0d66f3db))
- add level property to Part invalidReason ([#582](https://github.com/nrkno/tv-automation-server-core/issues/582)) [publish] ([52205fc](https://github.com/nrkno/tv-automation-server-core/commit/52205fc4f315515bc92037e3f67ab04c77415b93))
- Budget Duration ([#556](https://github.com/nrkno/tv-automation-server-core/issues/556)) ([4b7627d](https://github.com/nrkno/tv-automation-server-core/commit/4b7627dda1ed914f5fc949e548181f8e38f65d02))
- rundown metadata update ([#591](https://github.com/nrkno/tv-automation-server-core/issues/591)) ([8da7eda](https://github.com/nrkno/tv-automation-server-core/commit/8da7eda76f1eb8f5ab0e84ac75326317f69823de))
- Rundown view, rundown header, and presenter view customization ([#551](https://github.com/nrkno/tv-automation-server-core/issues/551)) ([f945594](https://github.com/nrkno/tv-automation-server-core/commit/f945594ff7983618c79d66023e8628eeaa93f898)), closes [#554](https://github.com/nrkno/tv-automation-server-core/issues/554)

# [1.37.0](https://github.com/nrkno/tv-automation-server-core/compare/v1.37.0-in-testing.13...v1.37.0) (2021-12-08)

### Bug Fixes

- IRundownTimingEventContext.getFirstPartInstanceInRundown ignored untimed parts unless asked to include them ([00a109f](https://github.com/nrkno/tv-automation-server-core/commit/00a109f15419bf9a70c3e8502655ac0b2a5fca05))

# [1.37.0-in-testing.13](https://github.com/nrkno/tv-automation-server-core/compare/v1.37.0-testing.12...v1.37.0-in-testing.13) (2021-11-02)

**Note:** Version bump only for package @sofie-automation/blueprints-integration

# [1.37.0-in-testing.11](https://github.com/nrkno/tv-automation-server-core/compare/v1.35.1-4...v1.37.0-in-testing.11) (2021-10-22)

### Bug Fixes

- add priority & prevStatusReasons into package workStatuses ([de73fd1](https://github.com/nrkno/tv-automation-server-core/commit/de73fd10acbab04b2669eed97b631df7fd12ea50))
- naming changes after QA ([ddd20c9](https://github.com/nrkno/tv-automation-server-core/commit/ddd20c9a7f9ca3a1807bb1171225441279a123c7))

### Features

- add fileflowProfile to Quantel accessor properties [publish] ([5f72ed0](https://github.com/nrkno/tv-automation-server-core/commit/5f72ed05976825ab659d3b2df110bd88c2cd28d1))
- allow setting a fileflow URL for Quantel Accessors ([22c6af5](https://github.com/nrkno/tv-automation-server-core/commit/22c6af5999aad0a2f89688179a3f057432a40fb0))
- ignore media statuses ([76f8f01](https://github.com/nrkno/tv-automation-server-core/commit/76f8f01172d8e2c60cff1a8f517b02af2f8e54cb))
- implement notInVision ([3d30dba](https://github.com/nrkno/tv-automation-server-core/commit/3d30dba9210730b69fffc6ed6a201ad63ed088dd))
- new infinites styling only for super-infinites (rundown/showstyle-length) ([ba49436](https://github.com/nrkno/tv-automation-server-core/commit/ba49436b5168d1804b06fca909f7c483eb5df80d))
- pieces can specify how to be direct-played ([#574](https://github.com/nrkno/tv-automation-server-core/issues/574)) ([a61a22b](https://github.com/nrkno/tv-automation-server-core/commit/a61a22bd3502d885d6e290e65ebce67337daba42))
- use sourcelayer LOCAL for EVS content ([3b87a90](https://github.com/nrkno/tv-automation-server-core/commit/3b87a909123ecdadaa98de1ec878390ca71ec1fc))

# [1.37.0-in-testing.0](https://github.com/nrkno/tv-automation-server-core/compare/v1.35.1-3...v1.37.0-in-testing.0) (2021-09-13)

### Bug Fixes

- add color code property to EvsContent ([c9d34db](https://github.com/nrkno/tv-automation-server-core/commit/c9d34db27f70271eba61b97121972637756f60d7))

### Features

- Action Triggers ([#553](https://github.com/nrkno/tv-automation-server-core/issues/553)) ([35e2b1a](https://github.com/nrkno/tv-automation-server-core/commit/35e2b1a7c3eab9381835d2811c1b7c49c9d3940e))
- add content and source layer types for EVS ([ff86d17](https://github.com/nrkno/tv-automation-server-core/commit/ff86d17cd18fae0dd4c61c62ad6d193e6bb89912))
- add custom timeline rendering for EVS items ([1efdd6a](https://github.com/nrkno/tv-automation-server-core/commit/1efdd6a70fcdb729f4ced2e522fa5c43a5811e32))

# [1.36.0-in-testing.9](https://github.com/nrkno/tv-automation-server-core/compare/v1.36.0-in-testing.8...v1.36.0-in-testing.9) (2021-08-10)

# [1.36.0-in-testing.8](https://github.com/nrkno/tv-automation-server-core/compare/v1.35.1-2...v1.36.0-in-testing.8) (2021-08-10)

### Features

- expected end time / back time ([#540](https://github.com/nrkno/tv-automation-server-core/issues/540)) ([84e1092](https://github.com/nrkno/tv-automation-server-core/commit/84e1092c31fc94d71b6047010138c133ce72a507))

# [1.36.0-in-testing.7](https://github.com/nrkno/tv-automation-server-core/compare/v1.35.1-1...v1.36.0-in-testing.7) (2021-07-20)

# [1.36.0-in-testing.6](https://github.com/nrkno/tv-automation-server-core/compare/v1.36.0-in-testing.4...v1.36.0-in-testing.6) (2021-07-14)

# [1.36.0-in-testing.4](https://github.com/nrkno/tv-automation-server-core/compare/v1.36.0-in-testing.3...v1.36.0-in-testing.4) (2021-07-12)

# [1.36.0-in-testing.3](https://github.com/nrkno/tv-automation-server-core/compare/v1.36.0-in-testing.2...v1.36.0-in-testing.3) (2021-07-12)

# [1.36.0-in-testing.2](https://github.com/nrkno/tv-automation-server-core/compare/v1.36.0-in-testing.1...v1.36.0-in-testing.2) (2021-07-12)

# [1.36.0-in-testing.1](https://github.com/nrkno/tv-automation-server-core/compare/v1.36.0-in-testing.0...v1.36.0-in-testing.1) (2021-07-12)

# [1.36.0-in-testing.0](https://github.com/nrkno/tv-automation-server-core/compare/v1.35.1-0...v1.36.0-in-testing.0) (2021-07-12)

### Bug Fixes

- infinite pieces losing their startedPlayback time on their second take ([4fbde9d](https://github.com/nrkno/tv-automation-server-core/commit/4fbde9dfba3fcb5416707b24187b1b295825354c))
- iterateDeeply for arrays [publish] ([9a64fd3](https://github.com/nrkno/tv-automation-server-core/commit/9a64fd347d715ca41b5b703415663fa02996fd5c))
- package manager: add statusChanged type, to use for determining that a status has changed (used in GUI) [publish] ([22b29d9](https://github.com/nrkno/tv-automation-server-core/commit/22b29d9ebe58e88db6438ad084d1f12182f6a4e5))
- PM add WorkStatusState, for stronger typings [publish] ([51788bc](https://github.com/nrkno/tv-automation-server-core/commit/51788bc31a26ce720b829508399a4a20737f2b66))

### Features

- add FTP package accessors type to blueprint-integrations ([412d2f1](https://github.com/nrkno/tv-automation-server-core/commit/412d2f1ec86586860d56e07f311668332c7117e8))
- blueprint getPackageInfo implementation based on cache ([74b40ad](https://github.com/nrkno/tv-automation-server-core/commit/74b40ad7925f97041697d6c5b9c91c7af3ff0f68))
- expand FTP accessor with options for explicit login and encrypted connections [publish] ([a4e77bd](https://github.com/nrkno/tv-automation-server-core/commit/a4e77bd78b2184e335fb0e2762dbf5cfef1f1ad4))
- package manager API: add a generic JSONData package, add a generit HTTP accessor and rename the old HTTP into HTTPProxy ([52592b6](https://github.com/nrkno/tv-automation-server-core/commit/52592b68b3bd6cb5fd49fb7803057d29e0c7d3f4))
- package-manager API: change statusReason into a Reason with user-readable and technical status descriptions (wip) ([191fcde](https://github.com/nrkno/tv-automation-server-core/commit/191fcde244589859c248de8b3db6fe169d01a17b))
- show Viz loading status in MSE on the Piece ([#538](https://github.com/nrkno/tv-automation-server-core/issues/538)) ([2c1d3a3](https://github.com/nrkno/tv-automation-server-core/commit/2c1d3a3e1fc86c8224aba0c05ce857e33cb6c9fc))

# [1.37.0-in-testing.0](https://github.com/nrkno/tv-automation-server-core/compare/v1.35.1-3...v1.37.0-in-testing.0) (2021-09-13)

### Features

- Action Triggers ([#553](https://github.com/nrkno/tv-automation-server-core/issues/553)) ([35e2b1a](https://github.com/nrkno/tv-automation-server-core/commit/35e2b1a7c3eab9381835d2811c1b7c49c9d3940e))

# [1.36.0-in-testing.9](https://github.com/nrkno/tv-automation-server-core/compare/v1.36.0-in-testing.8...v1.36.0-in-testing.9) (2021-08-10)

# [1.36.0-in-testing.8](https://github.com/nrkno/tv-automation-server-core/compare/v1.35.1-2...v1.36.0-in-testing.8) (2021-08-10)

### Features

- expected end time / back time ([#540](https://github.com/nrkno/tv-automation-server-core/issues/540)) ([84e1092](https://github.com/nrkno/tv-automation-server-core/commit/84e1092c31fc94d71b6047010138c133ce72a507))

# [1.36.0-in-testing.7](https://github.com/nrkno/tv-automation-server-core/compare/v1.35.1-1...v1.36.0-in-testing.7) (2021-07-20)

# [1.36.0-in-testing.6](https://github.com/nrkno/tv-automation-server-core/compare/v1.36.0-in-testing.4...v1.36.0-in-testing.6) (2021-07-14)

# [1.36.0-in-testing.4](https://github.com/nrkno/tv-automation-server-core/compare/v1.36.0-in-testing.3...v1.36.0-in-testing.4) (2021-07-12)

# [1.36.0-in-testing.3](https://github.com/nrkno/tv-automation-server-core/compare/v1.36.0-in-testing.2...v1.36.0-in-testing.3) (2021-07-12)

# [1.36.0-in-testing.2](https://github.com/nrkno/tv-automation-server-core/compare/v1.36.0-in-testing.1...v1.36.0-in-testing.2) (2021-07-12)

# [1.36.0-in-testing.1](https://github.com/nrkno/tv-automation-server-core/compare/v1.36.0-in-testing.0...v1.36.0-in-testing.1) (2021-07-12)

# [1.36.0-in-testing.0](https://github.com/nrkno/tv-automation-server-core/compare/v1.35.1-0...v1.36.0-in-testing.0) (2021-07-12)

### Bug Fixes

- infinite pieces losing their startedPlayback time on their second take ([4fbde9d](https://github.com/nrkno/tv-automation-server-core/commit/4fbde9dfba3fcb5416707b24187b1b295825354c))
- iterateDeeply for arrays [publish] ([9a64fd3](https://github.com/nrkno/tv-automation-server-core/commit/9a64fd347d715ca41b5b703415663fa02996fd5c))
- package manager: add statusChanged type, to use for determining that a status has changed (used in GUI) [publish] ([22b29d9](https://github.com/nrkno/tv-automation-server-core/commit/22b29d9ebe58e88db6438ad084d1f12182f6a4e5))
- PM add WorkStatusState, for stronger typings [publish] ([51788bc](https://github.com/nrkno/tv-automation-server-core/commit/51788bc31a26ce720b829508399a4a20737f2b66))

### Features

- add FTP package accessors type to blueprint-integrations ([412d2f1](https://github.com/nrkno/tv-automation-server-core/commit/412d2f1ec86586860d56e07f311668332c7117e8))
- blueprint getPackageInfo implementation based on cache ([74b40ad](https://github.com/nrkno/tv-automation-server-core/commit/74b40ad7925f97041697d6c5b9c91c7af3ff0f68))
- expand FTP accessor with options for explicit login and encrypted connections [publish] ([a4e77bd](https://github.com/nrkno/tv-automation-server-core/commit/a4e77bd78b2184e335fb0e2762dbf5cfef1f1ad4))
- package manager API: add a generic JSONData package, add a generit HTTP accessor and rename the old HTTP into HTTPProxy ([52592b6](https://github.com/nrkno/tv-automation-server-core/commit/52592b68b3bd6cb5fd49fb7803057d29e0c7d3f4))
- package-manager API: change statusReason into a Reason with user-readable and technical status descriptions (wip) ([191fcde](https://github.com/nrkno/tv-automation-server-core/commit/191fcde244589859c248de8b3db6fe169d01a17b))
- show Viz loading status in MSE on the Piece ([#538](https://github.com/nrkno/tv-automation-server-core/issues/538)) ([2c1d3a3](https://github.com/nrkno/tv-automation-server-core/commit/2c1d3a3e1fc86c8224aba0c05ce857e33cb6c9fc))

# [1.36.0-in-testing.9](https://github.com/nrkno/tv-automation-server-core/compare/v1.36.0-in-testing.8...v1.36.0-in-testing.9) (2021-08-10)

## [1.35.1-3](https://github.com/nrkno/tv-automation-server-core/compare/v1.35.1-2...v1.35.1-3) (2021-09-07)

**Note:** Version bump only for package @sofie-automation/blueprints-integration

## [1.35.1-2](https://github.com/nrkno/tv-automation-server-core/compare/v1.35.1-1...v1.35.1-2) (2021-08-10)

**Note:** Version bump only for package @sofie-automation/blueprints-integration

# [1.36.0-in-testing.8](https://github.com/nrkno/tv-automation-server-core/compare/v1.36.0-in-testing.7...v1.36.0-in-testing.8) (2021-08-10)

**Note:** Version bump only for package @sofie-automation/blueprints-integration

# [1.36.0-in-testing.7](https://github.com/nrkno/tv-automation-server-core/compare/v1.36.0-in-testing.6...v1.36.0-in-testing.7) (2021-07-20)

**Note:** Version bump only for package @sofie-automation/blueprints-integration

# [1.36.0-in-testing.6](https://github.com/nrkno/tv-automation-server-core/compare/v1.36.0-in-testing.4...v1.36.0-in-testing.6) (2021-07-14)

**Note:** Version bump only for package @sofie-automation/blueprints-integration

# [1.36.0-in-testing.5](https://github.com/nrkno/tv-automation-server-core/compare/v1.36.0-in-testing.4...v1.36.0-in-testing.5) (2021-07-14)

**Note:** Version bump only for package @sofie-automation/blueprints-integration

# [1.36.0-in-testing.4](https://github.com/nrkno/tv-automation-server-core/compare/v1.36.0-in-testing.3...v1.36.0-in-testing.4) (2021-07-12)

**Note:** Version bump only for package @sofie-automation/blueprints-integration

# [1.36.0-in-testing.3](https://github.com/nrkno/tv-automation-server-core/compare/v1.36.0-in-testing.2...v1.36.0-in-testing.3) (2021-07-12)

**Note:** Version bump only for package @sofie-automation/blueprints-integration

# [1.36.0-in-testing.2](https://github.com/nrkno/tv-automation-server-core/compare/v1.36.0-in-testing.1...v1.36.0-in-testing.2) (2021-07-12)

**Note:** Version bump only for package @sofie-automation/blueprints-integration

# [1.36.0-in-testing.1](https://github.com/nrkno/tv-automation-server-core/compare/v1.36.0-in-testing.0...v1.36.0-in-testing.1) (2021-07-12)

**Note:** Version bump only for package @sofie-automation/blueprints-integration

# [1.36.0-in-testing.0](https://github.com/nrkno/tv-automation-server-core/compare/v1.35.1-0...v1.36.0-in-testing.0) (2021-07-12)

### Bug Fixes

- infinite pieces losing their startedPlayback time on their second take ([4fbde9d](https://github.com/nrkno/tv-automation-server-core/commit/4fbde9dfba3fcb5416707b24187b1b295825354c))
- iterateDeeply for arrays [publish] ([9a64fd3](https://github.com/nrkno/tv-automation-server-core/commit/9a64fd347d715ca41b5b703415663fa02996fd5c))
- package manager: add statusChanged type, to use for determining that a status has changed (used in GUI) [publish] ([22b29d9](https://github.com/nrkno/tv-automation-server-core/commit/22b29d9ebe58e88db6438ad084d1f12182f6a4e5))
- PM add WorkStatusState, for stronger typings [publish] ([51788bc](https://github.com/nrkno/tv-automation-server-core/commit/51788bc31a26ce720b829508399a4a20737f2b66))

### Features

- add FTP package accessors type to blueprint-integrations ([412d2f1](https://github.com/nrkno/tv-automation-server-core/commit/412d2f1ec86586860d56e07f311668332c7117e8))
- blueprint getPackageInfo implementation based on cache ([74b40ad](https://github.com/nrkno/tv-automation-server-core/commit/74b40ad7925f97041697d6c5b9c91c7af3ff0f68))
- expand FTP accessor with options for explicit login and encrypted connections [publish] ([a4e77bd](https://github.com/nrkno/tv-automation-server-core/commit/a4e77bd78b2184e335fb0e2762dbf5cfef1f1ad4))
- package manager API: add a generic JSONData package, add a generit HTTP accessor and rename the old HTTP into HTTPProxy ([52592b6](https://github.com/nrkno/tv-automation-server-core/commit/52592b68b3bd6cb5fd49fb7803057d29e0c7d3f4))
- package-manager API: change statusReason into a Reason with user-readable and technical status descriptions (wip) ([191fcde](https://github.com/nrkno/tv-automation-server-core/commit/191fcde244589859c248de8b3db6fe169d01a17b))
- show Viz loading status in MSE on the Piece ([#538](https://github.com/nrkno/tv-automation-server-core/issues/538)) ([2c1d3a3](https://github.com/nrkno/tv-automation-server-core/commit/2c1d3a3e1fc86c8224aba0c05ce857e33cb6c9fc))

## [1.35.1-0](https://github.com/nrkno/tv-automation-server-core/compare/v1.35.0...v1.35.1-0) (2021-07-12)

**Note:** Version bump only for package @sofie-automation/blueprints-integration

# [1.35.0](https://github.com/nrkno/tv-automation-server-core/compare/v1.34.0...v1.35.0) (2021-07-07)

# [1.35.0-in-testing.1](https://github.com/nrkno/tv-automation-server-core/compare/v1.32.3...v1.35.0-in-testing.1) (2021-06-10)

# [1.35.0-in-testing.0](https://github.com/nrkno/tv-automation-server-core/compare/v1.32.3-0...v1.35.0-in-testing.0) (2021-06-09)

### Bug Fixes

- upd package-manager publication ([82d6587](https://github.com/nrkno/tv-automation-server-core/commit/82d6587ee3da6a6556b81455aaf2025107bf4a62))

### Features

- add baseline expectedPlayoutItems support ([#520](https://github.com/nrkno/tv-automation-server-core/issues/520)) [publish] ([6865b7e](https://github.com/nrkno/tv-automation-server-core/commit/6865b7ec2be8ca57b70d25ac6db41669fc686c97))
- dataPlaylistGet ([7cbdfb4](https://github.com/nrkno/tv-automation-server-core/commit/7cbdfb4dc5ff8a693cfd49825d03777f31416dce))
- expose PartEndState to the adlib actions ([#518](https://github.com/nrkno/tv-automation-server-core/issues/518)) [publish] ([813cb03](https://github.com/nrkno/tv-automation-server-core/commit/813cb03369792fa095cbeca8a9ce4f1835fce376))
- expose studioId to blueprints on IStudioContext [publish] ([0f30520](https://github.com/nrkno/tv-automation-server-core/commit/0f305207c41e618411161db2fc105936b699534f))
- OnShowStyleEnd infinites ([d22c592](https://github.com/nrkno/tv-automation-server-core/commit/d22c5922c752e75495ada1127b515d9fb1c4fad4))
- require node 12.20 for all packages ([776e0d5](https://github.com/nrkno/tv-automation-server-core/commit/776e0d5c3e402b394990aafea8e7be4f44f8753f))

# [1.35.0-in-testing.1](https://github.com/nrkno/tv-automation-server-core/compare/v1.35.0-in-testing.0...v1.35.0-in-testing.1) (2021-06-10)

**Note:** Version bump only for package @sofie-automation/blueprints-integration

# [1.35.0-in-testing.0](https://github.com/nrkno/tv-automation-server-core/compare/v1.32.2...v1.35.0-in-testing.0) (2021-06-09)

### Features

- add baseline expectedPlayoutItems support ([#520](https://github.com/nrkno/tv-automation-server-core/issues/520)) [publish] ([6865b7e](https://github.com/nrkno/tv-automation-server-core/commit/6865b7ec2be8ca57b70d25ac6db41669fc686c97))
- dataPlaylistGet ([7cbdfb4](https://github.com/nrkno/tv-automation-server-core/commit/7cbdfb4dc5ff8a693cfd49825d03777f31416dce))
- expose PartEndState to the adlib actions ([#518](https://github.com/nrkno/tv-automation-server-core/issues/518)) [publish] ([813cb03](https://github.com/nrkno/tv-automation-server-core/commit/813cb03369792fa095cbeca8a9ce4f1835fce376))
- expose studioId to blueprints on IStudioContext [publish] ([0f30520](https://github.com/nrkno/tv-automation-server-core/commit/0f305207c41e618411161db2fc105936b699534f))
- OnShowStyleEnd infinites ([d22c592](https://github.com/nrkno/tv-automation-server-core/commit/d22c5922c752e75495ada1127b515d9fb1c4fad4))
- require node 12.20 for all packages ([776e0d5](https://github.com/nrkno/tv-automation-server-core/commit/776e0d5c3e402b394990aafea8e7be4f44f8753f))

# [1.34.0](https://github.com/nrkno/tv-automation-server-core/compare/v1.33.0...v1.34.0) (2021-06-28)

### Bug Fixes

- add property for fileName into FFProbeInfo ([b2bfeac](https://github.com/nrkno/tv-automation-server-core/commit/b2bfeac4f0097afa3522cd4854839a9efd6e45f9))
- logging ([f9aafc6](https://github.com/nrkno/tv-automation-server-core/commit/f9aafc66858ea39dc49f0b06732e790e545cd567))
- move PackageInfo interfaces into blueprints-integration ([2730e06](https://github.com/nrkno/tv-automation-server-core/commit/2730e0675a3b696530aad5b854115475dd383736))
- prompter doesn't use changes from part/piece instances ([#533](https://github.com/nrkno/tv-automation-server-core/issues/533)) ([e3bd920](https://github.com/nrkno/tv-automation-server-core/commit/e3bd9200f4d784b65015fa8a8cbc2efc23f1b4ad))

### Features

- **Rundown View:** time of day countdowns & end of loop timer ([#535](https://github.com/nrkno/tv-automation-server-core/issues/535)) ([0430960](https://github.com/nrkno/tv-automation-server-core/commit/0430960f79d7a287eebe2e81ea9a7e9534880b4b))
- implement listenToPackageInfo from blueprints ([e1c1cca](https://github.com/nrkno/tv-automation-server-core/commit/e1c1ccae6e71fc0ef0d02ea54c772b67284eec02))

# [1.34.0-in-testing.0](https://github.com/nrkno/tv-automation-server-core/compare/v1.32.0...v1.34.0-in-testing.0) (2021-05-18)

### Bug Fixes

- upd package-manager publication ([82d6587](https://github.com/nrkno/tv-automation-server-core/commit/82d6587ee3da6a6556b81455aaf2025107bf4a62))

### Features

- untimed Parts ([#512](https://github.com/nrkno/tv-automation-server-core/issues/512)) ([bd7d336](https://github.com/nrkno/tv-automation-server-core/commit/bd7d336d45bca1c92c45e2b2797722db956be1fb))

# [1.33.0-in-testing.1](https://github.com/nrkno/tv-automation-server-core/compare/v1.33.0-in-development.0...v1.33.0-in-testing.1) (2021-04-22)

# [1.33.0-in-development.0](https://github.com/nrkno/tv-automation-server-core/compare/v1.19.0-in-testing.2...v1.33.0-in-development.0) (2021-04-22)

### Bug Fixes

- Issues from review ([018a50b](https://github.com/nrkno/tv-automation-server-core/commit/018a50b6c3a5ec04518c41ec2151afbca634fb29))
- PM: fix quantel types and add GUI settings ([9c4bb37](https://github.com/nrkno/tv-automation-server-core/commit/9c4bb37be6f27beaff9f9db387f357fc5148f509))

### Features

- Add duplicate AdLibs filtering ([5ecdaa8](https://github.com/nrkno/tv-automation-server-core/commit/5ecdaa823fef5a19ec264eedf234106914e16853))
- add step property to nora payload typings ([819d339](https://github.com/nrkno/tv-automation-server-core/commit/819d3395905f9b4b36d7ea4d397c4183eef69f8f))
- blueprint static assets upload ([9033b7d](https://github.com/nrkno/tv-automation-server-core/commit/9033b7dba1f24edf03d027b8f4ed1a4e6d65d86e))
- findLastScriptedPieceOnLayer ([897ddb9](https://github.com/nrkno/tv-automation-server-core/commit/897ddb9ccd856987041debe63d1d9868b0922bf2))
- import gateways to packages ([240d938](https://github.com/nrkno/tv-automation-server-core/commit/240d93822bc3f0c00d1e41cadb0954b81e72f6be))
- support expectedPlayoutItems for adlib actions ([b0b866a](https://github.com/nrkno/tv-automation-server-core/commit/b0b866a4ff10de5301bfd94f1cc9f3a6d4844911))
- translatable AdLib Actions ([#494](https://github.com/nrkno/tv-automation-server-core/issues/494)) [publish] ([4ca0904](https://github.com/nrkno/tv-automation-server-core/commit/4ca090406ae5604e32b84394dd57692e1bced9ba))
- zero-based config settings ([31bb2c3](https://github.com/nrkno/tv-automation-server-core/commit/31bb2c30b5790770d3ad630afb75ac0d57b9d306))

# [1.34.0-in-testing.0](https://github.com/nrkno/tv-automation-server-core/compare/v1.32.0...v1.34.0-in-testing.0) (2021-05-18)

# [1.33.0](https://github.com/nrkno/tv-automation-server-core/compare/v1.32.2...v1.33.0) (2021-06-15)

# [1.33.0-in-testing.1](https://github.com/nrkno/tv-automation-server-core/compare/v1.33.0-in-development.0...v1.33.0-in-testing.1) (2021-04-22)

# [1.33.0-in-development.0](https://github.com/nrkno/tv-automation-server-core/compare/v1.19.0-in-testing.2...v1.33.0-in-development.0) (2021-04-22)

### Bug Fixes

- Issues from review ([018a50b](https://github.com/nrkno/tv-automation-server-core/commit/018a50b6c3a5ec04518c41ec2151afbca634fb29))
- PM: fix quantel types and add GUI settings ([9c4bb37](https://github.com/nrkno/tv-automation-server-core/commit/9c4bb37be6f27beaff9f9db387f357fc5148f509))

### Features

- Add duplicate AdLibs filtering ([5ecdaa8](https://github.com/nrkno/tv-automation-server-core/commit/5ecdaa823fef5a19ec264eedf234106914e16853))
- blueprint static assets upload ([9033b7d](https://github.com/nrkno/tv-automation-server-core/commit/9033b7dba1f24edf03d027b8f4ed1a4e6d65d86e))
- findLastScriptedPieceOnLayer ([897ddb9](https://github.com/nrkno/tv-automation-server-core/commit/897ddb9ccd856987041debe63d1d9868b0922bf2))
- import gateways to packages ([240d938](https://github.com/nrkno/tv-automation-server-core/commit/240d93822bc3f0c00d1e41cadb0954b81e72f6be))
- support expectedPlayoutItems for adlib actions ([b0b866a](https://github.com/nrkno/tv-automation-server-core/commit/b0b866a4ff10de5301bfd94f1cc9f3a6d4844911))
- translatable AdLib Actions ([#494](https://github.com/nrkno/tv-automation-server-core/issues/494)) [publish] ([4ca0904](https://github.com/nrkno/tv-automation-server-core/commit/4ca090406ae5604e32b84394dd57692e1bced9ba))

# [1.33.0-in-testing.1](https://github.com/nrkno/tv-automation-server-core/compare/v1.33.0-in-development.0...v1.33.0-in-testing.1) (2021-04-22)

**Note:** Version bump only for package @sofie-automation/blueprints-integration

### Features

- untimed Parts ([#512](https://github.com/nrkno/tv-automation-server-core/issues/512)) ([bd7d336](https://github.com/nrkno/tv-automation-server-core/commit/bd7d336d45bca1c92c45e2b2797722db956be1fb))

# [1.33.0-in-testing.1](https://github.com/nrkno/tv-automation-server-core/compare/v1.33.0-in-development.0...v1.33.0-in-testing.1) (2021-04-22)

# [1.33.0-in-development.0](https://github.com/nrkno/tv-automation-server-core/compare/v1.19.0-in-testing.2...v1.33.0-in-development.0) (2021-04-22)

### Bug Fixes

- Issues from review ([018a50b](https://github.com/nrkno/tv-automation-server-core/commit/018a50b6c3a5ec04518c41ec2151afbca634fb29))
- PM: fix quantel types and add GUI settings ([9c4bb37](https://github.com/nrkno/tv-automation-server-core/commit/9c4bb37be6f27beaff9f9db387f357fc5148f509))

### Features

- Add duplicate AdLibs filtering ([5ecdaa8](https://github.com/nrkno/tv-automation-server-core/commit/5ecdaa823fef5a19ec264eedf234106914e16853))
- add step property to nora payload typings ([819d339](https://github.com/nrkno/tv-automation-server-core/commit/819d3395905f9b4b36d7ea4d397c4183eef69f8f))
- blueprint static assets upload ([9033b7d](https://github.com/nrkno/tv-automation-server-core/commit/9033b7dba1f24edf03d027b8f4ed1a4e6d65d86e))
- findLastScriptedPieceOnLayer ([897ddb9](https://github.com/nrkno/tv-automation-server-core/commit/897ddb9ccd856987041debe63d1d9868b0922bf2))
- import gateways to packages ([240d938](https://github.com/nrkno/tv-automation-server-core/commit/240d93822bc3f0c00d1e41cadb0954b81e72f6be))
- support expectedPlayoutItems for adlib actions ([b0b866a](https://github.com/nrkno/tv-automation-server-core/commit/b0b866a4ff10de5301bfd94f1cc9f3a6d4844911))
- translatable AdLib Actions ([#494](https://github.com/nrkno/tv-automation-server-core/issues/494)) [publish] ([4ca0904](https://github.com/nrkno/tv-automation-server-core/commit/4ca090406ae5604e32b84394dd57692e1bced9ba))
- zero-based config settings ([31bb2c3](https://github.com/nrkno/tv-automation-server-core/commit/31bb2c30b5790770d3ad630afb75ac0d57b9d306))

# [1.33.0-in-testing.1](https://github.com/nrkno/tv-automation-server-core/compare/v1.33.0-in-development.0...v1.33.0-in-testing.1) (2021-04-22)

**Note:** Version bump only for package @sofie-automation/blueprints-integration

# [1.33.0-in-development.0](https://github.com/nrkno/tv-automation-server-core/compare/v1.19.0-in-testing.2...v1.33.0-in-development.0) (2021-04-22)

### Bug Fixes

- Issues from review ([018a50b](https://github.com/nrkno/tv-automation-server-core/commit/018a50b6c3a5ec04518c41ec2151afbca634fb29))
- PM: fix quantel types and add GUI settings ([9c4bb37](https://github.com/nrkno/tv-automation-server-core/commit/9c4bb37be6f27beaff9f9db387f357fc5148f509))

### Features

- Add duplicate AdLibs filtering ([5ecdaa8](https://github.com/nrkno/tv-automation-server-core/commit/5ecdaa823fef5a19ec264eedf234106914e16853))
- blueprint static assets upload ([9033b7d](https://github.com/nrkno/tv-automation-server-core/commit/9033b7dba1f24edf03d027b8f4ed1a4e6d65d86e))
- findLastScriptedPieceOnLayer ([897ddb9](https://github.com/nrkno/tv-automation-server-core/commit/897ddb9ccd856987041debe63d1d9868b0922bf2))
- import gateways to packages ([240d938](https://github.com/nrkno/tv-automation-server-core/commit/240d93822bc3f0c00d1e41cadb0954b81e72f6be))
- support expectedPlayoutItems for adlib actions ([b0b866a](https://github.com/nrkno/tv-automation-server-core/commit/b0b866a4ff10de5301bfd94f1cc9f3a6d4844911))
- translatable AdLib Actions ([#494](https://github.com/nrkno/tv-automation-server-core/issues/494)) [publish] ([4ca0904](https://github.com/nrkno/tv-automation-server-core/commit/4ca090406ae5604e32b84394dd57692e1bced9ba))

# [1.32.0-in-testing.0](https://github.com/nrkno/tv-automation-server-core/compare/v1.18.0...v1.32.0-in-testing.0) (2021-03-22)

### Bug Fixes

- blueprint-integration: add expectedPackages properties to Adlib actions ([b45df41](https://github.com/nrkno/tv-automation-server-core/commit/b45df419140aa3c4280cc8832368b69ea2790085))
- clarify typings of ExpectedPackageWorkStatus.fromPackages property ([ec7c26d](https://github.com/nrkno/tv-automation-server-core/commit/ec7c26d072375bd185d513e9612aabf8d49ed2ac))
- expectedPackages: add seekTime property for thumbnail generation ([baa551d](https://github.com/nrkno/tv-automation-server-core/commit/baa551d8334746138bbc667ae5e385d4ca7bd96f))
- merge MappedDrive into FileShare, they will configured as the same thing ([852c5ea](https://github.com/nrkno/tv-automation-server-core/commit/852c5ea4544e3a06f0c8b3bcbd3646c8df5d85fd))
- minor fixes ([2f66298](https://github.com/nrkno/tv-automation-server-core/commit/2f66298b021f4366e1f1c796bbb53127484db035))
- move PackageContainerPackageStatus to blueprint-integration ([ebe3b3f](https://github.com/nrkno/tv-automation-server-core/commit/ebe3b3fe373791d302d51d1a13a5d597f8324e5a))
- package management: continued implementations ([9a23581](https://github.com/nrkno/tv-automation-server-core/commit/9a23581c2335df6587dd95d9e9f16afd2b3b45e5))
- package: type updates, add locations ([e393b22](https://github.com/nrkno/tv-automation-server-core/commit/e393b221affc8b6994c5dceaee88ec5456147afb))
- packages: types for quantel ([fccf190](https://github.com/nrkno/tv-automation-server-core/commit/fccf190c966835ebde21a5b5a35f21f22a55bbfd))
- remove unused properties [publish] ([115ede6](https://github.com/nrkno/tv-automation-server-core/commit/115ede6d3e9a947eea788c7290b5757b9cb38e26))
- types: package origins: add HTTP interface ([3bb36fa](https://github.com/nrkno/tv-automation-server-core/commit/3bb36fa8d4ea7dbcb73014ad9ded596e9de19cff))
- typings fixes ([0721e16](https://github.com/nrkno/tv-automation-server-core/commit/0721e16b58ef0c032bc0d5bce7b6c563c133f550))

### Features

- add expectedPackages (wip) ([19e34d5](https://github.com/nrkno/tv-automation-server-core/commit/19e34d52785daac50e31a39f61720996d5f8f227))
- allow adlib actions to move the next part by either a part or segment delta ([3a56c5c](https://github.com/nrkno/tv-automation-server-core/commit/3a56c5c426f2f3e7ce928813da1a2c6f394df3df))
- allow an expectedPackage to have multiple layers [publish] ([60b8d7c](https://github.com/nrkno/tv-automation-server-core/commit/60b8d7c297485173c475e93f89c403878c23a598))
- expectedPackages contiued implementation. ([5a4dd80](https://github.com/nrkno/tv-automation-server-core/commit/5a4dd802b4360b93e80b9dd4c3eeefa96dded547))
- expectedPackages: let core set the path (& other settings in the future) for the thumbnail and preview [publish] ([cb3a600](https://github.com/nrkno/tv-automation-server-core/commit/cb3a600fdd0ab9f728c5bd6c1640f8bd3002b0ac))
- implement ExpectedPackageWorkStatuses, for piping info about work being performed on expectedPackages ([273c7f4](https://github.com/nrkno/tv-automation-server-core/commit/273c7f448af592fa136ca516c9efd5fd473af3fa))
- package management: continued implementation.. PackageContainers PackageContainerStatuses, PackageInfos etc,,, (wip) ([c5c2bce](https://github.com/nrkno/tv-automation-server-core/commit/c5c2bce6e567581ffc98c4dd543183ad5aa9174a))
- package-management: data piping for packageInfos, move device-container coupling to Studio, add Studio.previewContainerIds & Studio.thumbnailContainerIds etc. Add ExpectedPackage.sideEffect. etc... ([3fec5e9](https://github.com/nrkno/tv-automation-server-core/commit/3fec5e9bc53b287b4bb731d631e7b3494b88b141))
- remove AsRunLog collection ([#477](https://github.com/nrkno/tv-automation-server-core/issues/477)) ([1826f79](https://github.com/nrkno/tv-automation-server-core/commit/1826f79bb12732006cb174f8a7e915560b755a31))

# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [1.32.3](https://github.com/nrkno/tv-automation-server-core/compare/v1.32.3-0...v1.32.3) (2021-06-10)

### [1.32.3-0](https://github.com/nrkno/tv-automation-server-core/compare/v1.32.2...v1.32.3-0) (2021-06-09)

### [1.32.2](https://github.com/nrkno/tv-automation-server-core/compare/v1.32.1...v1.32.2) (2021-06-02)

### [1.32.2-0](https://github.com/nrkno/tv-automation-server-core/compare/v1.32.1...v1.32.2-0) (2021-05-26)

### [1.32.1](https://github.com/nrkno/tv-automation-server-core/compare/v1.32.0...v1.32.1) (2021-05-20)

## [1.32.0](https://github.com/nrkno/tv-automation-server-core/compare/v1.32.0-in-testing.1...v1.32.0) (2021-05-05)

## [1.32.0-in-testing.1](https://github.com/nrkno/tv-automation-server-core/compare/v1.19.0-in-testing.2...v1.32.0-in-testing.1) (2021-04-27)

## [1.32.0-in-testing.0](https://github.com/nrkno/tv-automation-server-core/compare/v1.18.0...v1.32.0-in-testing.0) (2021-03-22)

### Features

- add expectedPackages (wip) ([19e34d5](https://github.com/nrkno/tv-automation-server-core/commit/19e34d52785daac50e31a39f61720996d5f8f227))
- allow adlib actions to move the next part by either a part or segment delta ([3a56c5c](https://github.com/nrkno/tv-automation-server-core/commit/3a56c5c426f2f3e7ce928813da1a2c6f394df3df))
- allow an expectedPackage to have multiple layers [publish] ([60b8d7c](https://github.com/nrkno/tv-automation-server-core/commit/60b8d7c297485173c475e93f89c403878c23a598))
- expectedPackages contiued implementation. ([5a4dd80](https://github.com/nrkno/tv-automation-server-core/commit/5a4dd802b4360b93e80b9dd4c3eeefa96dded547))
- expectedPackages: let core set the path (& other settings in the future) for the thumbnail and preview [publish] ([cb3a600](https://github.com/nrkno/tv-automation-server-core/commit/cb3a600fdd0ab9f728c5bd6c1640f8bd3002b0ac))
- implement ExpectedPackageWorkStatuses, for piping info about work being performed on expectedPackages ([273c7f4](https://github.com/nrkno/tv-automation-server-core/commit/273c7f448af592fa136ca516c9efd5fd473af3fa))
- package management: continued implementation.. PackageContainers PackageContainerStatuses, PackageInfos etc,,, (wip) ([c5c2bce](https://github.com/nrkno/tv-automation-server-core/commit/c5c2bce6e567581ffc98c4dd543183ad5aa9174a))
- package-management: data piping for packageInfos, move device-container coupling to Studio, add Studio.previewContainerIds & Studio.thumbnailContainerIds etc. Add ExpectedPackage.sideEffect. etc... ([3fec5e9](https://github.com/nrkno/tv-automation-server-core/commit/3fec5e9bc53b287b4bb731d631e7b3494b88b141))
- remove AsRunLog collection ([#477](https://github.com/nrkno/tv-automation-server-core/issues/477)) ([1826f79](https://github.com/nrkno/tv-automation-server-core/commit/1826f79bb12732006cb174f8a7e915560b755a31))

### Bug Fixes

- blueprint-integration: add expectedPackages properties to Adlib actions ([b45df41](https://github.com/nrkno/tv-automation-server-core/commit/b45df419140aa3c4280cc8832368b69ea2790085))
- clarify typings of ExpectedPackageWorkStatus.fromPackages property ([ec7c26d](https://github.com/nrkno/tv-automation-server-core/commit/ec7c26d072375bd185d513e9612aabf8d49ed2ac))
- expectedPackages: add seekTime property for thumbnail generation ([baa551d](https://github.com/nrkno/tv-automation-server-core/commit/baa551d8334746138bbc667ae5e385d4ca7bd96f))
- merge MappedDrive into FileShare, they will configured as the same thing ([852c5ea](https://github.com/nrkno/tv-automation-server-core/commit/852c5ea4544e3a06f0c8b3bcbd3646c8df5d85fd))
- minor fixes ([2f66298](https://github.com/nrkno/tv-automation-server-core/commit/2f66298b021f4366e1f1c796bbb53127484db035))
- move PackageContainerPackageStatus to blueprint-integration ([ebe3b3f](https://github.com/nrkno/tv-automation-server-core/commit/ebe3b3fe373791d302d51d1a13a5d597f8324e5a))
- package management: continued implementations ([9a23581](https://github.com/nrkno/tv-automation-server-core/commit/9a23581c2335df6587dd95d9e9f16afd2b3b45e5))
- package: type updates, add locations ([e393b22](https://github.com/nrkno/tv-automation-server-core/commit/e393b221affc8b6994c5dceaee88ec5456147afb))
- packages: types for quantel ([fccf190](https://github.com/nrkno/tv-automation-server-core/commit/fccf190c966835ebde21a5b5a35f21f22a55bbfd))
- remove unused properties [publish] ([115ede6](https://github.com/nrkno/tv-automation-server-core/commit/115ede6d3e9a947eea788c7290b5757b9cb38e26))
- types: package origins: add HTTP interface ([3bb36fa](https://github.com/nrkno/tv-automation-server-core/commit/3bb36fa8d4ea7dbcb73014ad9ded596e9de19cff))
- typings fixes ([0721e16](https://github.com/nrkno/tv-automation-server-core/commit/0721e16b58ef0c032bc0d5bce7b6c563c133f550))

## [1.19.0-in-testing.2](https://github.com/nrkno/tv-automation-server-core/compare/v1.18.0...v1.19.0-in-testing.2) (2021-04-12)

## [1.19.0-in-testing.1](https://github.com/nrkno/tv-automation-server-core/compare/v1.19.0-in-testing.0...v1.19.0-in-testing.1) (2021-03-01)

### Features

- allow searching multiple sourcelayers at once in AdlibActionContext.findLastPieceOnLayer [publish] ([7b31a5b](https://github.com/nrkno/tv-automation-server-core/commit/7b31a5b7b74e6142f4cb330eb74b217e3f797500))
- remove getIngestDataFor\* methods from AsRunEventContext ([97e5632](https://github.com/nrkno/tv-automation-server-core/commit/97e563250056a011e6c94ab81fa81fc041b8bcc1))

### Bug Fixes

- add missing contexts to blueprint api methods [publish] ([#454](https://github.com/nrkno/tv-automation-server-core/issues/454)) ([2cef36c](https://github.com/nrkno/tv-automation-server-core/commit/2cef36c3f2e70ee722b5b890f5619d36fb7fa36d))
- invalidReason translation ([#459](https://github.com/nrkno/tv-automation-server-core/issues/459)) [publish] ([5bd01d4](https://github.com/nrkno/tv-automation-server-core/commit/5bd01d4660e9e76b07a2a3e02e8a4bc7ffd8a5f6))

## [1.32.0-in-testing.0](https://github.com/nrkno/tv-automation-server-core/compare/v1.18.0...v1.32.0-in-testing.0) (2021-03-22)

### Features

- allow adlib actions to move the next part by either a part or segment delta ([3a56c5c](https://github.com/nrkno/tv-automation-server-core/commit/3a56c5c426f2f3e7ce928813da1a2c6f394df3df))
- remove AsRunLog collection ([#477](https://github.com/nrkno/tv-automation-server-core/issues/477)) ([1826f79](https://github.com/nrkno/tv-automation-server-core/commit/1826f79bb12732006cb174f8a7e915560b755a31))

### Bug Fixes

- ci publish release scripts ([34c6f22](https://github.com/nrkno/tv-automation-server-core/commit/34c6f22cdba5a143804a3874c9b30febb816584e))
- packages: types for quantel ([fccf190](https://github.com/nrkno/tv-automation-server-core/commit/fccf190c966835ebde21a5b5a35f21f22a55bbfd))

## [1.19.0-in-testing.1](https://github.com/nrkno/tv-automation-server-core/compare/v1.19.0-in-testing.0...v1.19.0-in-testing.1) (2021-03-01)

### Features

- add expectedPackages (wip) ([19e34d5](https://github.com/nrkno/tv-automation-server-core/commit/19e34d52785daac50e31a39f61720996d5f8f227))
- allow an expectedPackage to have multiple layers [publish] ([60b8d7c](https://github.com/nrkno/tv-automation-server-core/commit/60b8d7c297485173c475e93f89c403878c23a598))
- allow searching multiple sourcelayers at once in AdlibActionContext.findLastPieceOnLayer [publish] ([7b31a5b](https://github.com/nrkno/tv-automation-server-core/commit/7b31a5b7b74e6142f4cb330eb74b217e3f797500))
- expectedPackages contiued implementation. ([5a4dd80](https://github.com/nrkno/tv-automation-server-core/commit/5a4dd802b4360b93e80b9dd4c3eeefa96dded547))
- expectedPackages: let core set the path (& other settings in the future) for the thumbnail and preview [publish] ([cb3a600](https://github.com/nrkno/tv-automation-server-core/commit/cb3a600fdd0ab9f728c5bd6c1640f8bd3002b0ac))
- implement ExpectedPackageWorkStatuses, for piping info about work being performed on expectedPackages ([273c7f4](https://github.com/nrkno/tv-automation-server-core/commit/273c7f448af592fa136ca516c9efd5fd473af3fa))
- package management: continued implementation.. PackageContainers PackageContainerStatuses, PackageInfos etc,,, (wip) ([c5c2bce](https://github.com/nrkno/tv-automation-server-core/commit/c5c2bce6e567581ffc98c4dd543183ad5aa9174a))
- package-management: data piping for packageInfos, move device-container coupling to Studio, add Studio.previewContainerIds & Studio.thumbnailContainerIds etc. Add ExpectedPackage.sideEffect. etc... ([3fec5e9](https://github.com/nrkno/tv-automation-server-core/commit/3fec5e9bc53b287b4bb731d631e7b3494b88b141))
- remove getIngestDataFor\* methods from AsRunEventContext ([97e5632](https://github.com/nrkno/tv-automation-server-core/commit/97e563250056a011e6c94ab81fa81fc041b8bcc1))

### Bug Fixes

- add missing contexts to blueprint api methods [publish] ([#454](https://github.com/nrkno/tv-automation-server-core/issues/454)) ([2cef36c](https://github.com/nrkno/tv-automation-server-core/commit/2cef36c3f2e70ee722b5b890f5619d36fb7fa36d))
- blueprint-integration: add expectedPackages properties to Adlib actions ([b45df41](https://github.com/nrkno/tv-automation-server-core/commit/b45df419140aa3c4280cc8832368b69ea2790085))
- clarify typings of ExpectedPackageWorkStatus.fromPackages property ([ec7c26d](https://github.com/nrkno/tv-automation-server-core/commit/ec7c26d072375bd185d513e9612aabf8d49ed2ac))
- expectedPackages: add seekTime property for thumbnail generation ([baa551d](https://github.com/nrkno/tv-automation-server-core/commit/baa551d8334746138bbc667ae5e385d4ca7bd96f))
- invalidReason translation ([#459](https://github.com/nrkno/tv-automation-server-core/issues/459)) [publish] ([5bd01d4](https://github.com/nrkno/tv-automation-server-core/commit/5bd01d4660e9e76b07a2a3e02e8a4bc7ffd8a5f6))
- merge MappedDrive into FileShare, they will configured as the same thing ([852c5ea](https://github.com/nrkno/tv-automation-server-core/commit/852c5ea4544e3a06f0c8b3bcbd3646c8df5d85fd))
- minor fixes ([2f66298](https://github.com/nrkno/tv-automation-server-core/commit/2f66298b021f4366e1f1c796bbb53127484db035))
- move PackageContainerPackageStatus to blueprint-integration ([ebe3b3f](https://github.com/nrkno/tv-automation-server-core/commit/ebe3b3fe373791d302d51d1a13a5d597f8324e5a))
- package management: continued implementations ([9a23581](https://github.com/nrkno/tv-automation-server-core/commit/9a23581c2335df6587dd95d9e9f16afd2b3b45e5))
- package: type updates, add locations ([e393b22](https://github.com/nrkno/tv-automation-server-core/commit/e393b221affc8b6994c5dceaee88ec5456147afb))
- remove unused properties [publish] ([115ede6](https://github.com/nrkno/tv-automation-server-core/commit/115ede6d3e9a947eea788c7290b5757b9cb38e26))
- types: package origins: add HTTP interface ([3bb36fa](https://github.com/nrkno/tv-automation-server-core/commit/3bb36fa8d4ea7dbcb73014ad9ded596e9de19cff))
- typings fixes ([0721e16](https://github.com/nrkno/tv-automation-server-core/commit/0721e16b58ef0c032bc0d5bce7b6c563c133f550))

## [1.19.0-in-testing.1](https://github.com/nrkno/tv-automation-server-core/compare/v1.19.0-in-testing.0...v1.19.0-in-testing.1) (2021-03-01)

### Features

- add expectedPackages (wip) ([19e34d5](https://github.com/nrkno/tv-automation-server-core/commit/19e34d52785daac50e31a39f61720996d5f8f227))
- allow an expectedPackage to have multiple layers [publish] ([60b8d7c](https://github.com/nrkno/tv-automation-server-core/commit/60b8d7c297485173c475e93f89c403878c23a598))
- allow searching multiple sourcelayers at once in AdlibActionContext.findLastPieceOnLayer [publish] ([7b31a5b](https://github.com/nrkno/tv-automation-server-core/commit/7b31a5b7b74e6142f4cb330eb74b217e3f797500))
- expectedPackages contiued implementation. ([5a4dd80](https://github.com/nrkno/tv-automation-server-core/commit/5a4dd802b4360b93e80b9dd4c3eeefa96dded547))
- expectedPackages: let core set the path (& other settings in the future) for the thumbnail and preview [publish] ([cb3a600](https://github.com/nrkno/tv-automation-server-core/commit/cb3a600fdd0ab9f728c5bd6c1640f8bd3002b0ac))
- implement ExpectedPackageWorkStatuses, for piping info about work being performed on expectedPackages ([273c7f4](https://github.com/nrkno/tv-automation-server-core/commit/273c7f448af592fa136ca516c9efd5fd473af3fa))
- package management: continued implementation.. PackageContainers PackageContainerStatuses, PackageInfos etc,,, (wip) ([c5c2bce](https://github.com/nrkno/tv-automation-server-core/commit/c5c2bce6e567581ffc98c4dd543183ad5aa9174a))
- package-management: data piping for packageInfos, move device-container coupling to Studio, add Studio.previewContainerIds & Studio.thumbnailContainerIds etc. Add ExpectedPackage.sideEffect. etc... ([3fec5e9](https://github.com/nrkno/tv-automation-server-core/commit/3fec5e9bc53b287b4bb731d631e7b3494b88b141))
- remove getIngestDataFor\* methods from AsRunEventContext ([97e5632](https://github.com/nrkno/tv-automation-server-core/commit/97e563250056a011e6c94ab81fa81fc041b8bcc1))

### Bug Fixes

- add missing contexts to blueprint api methods [publish] ([#454](https://github.com/nrkno/tv-automation-server-core/issues/454)) ([2cef36c](https://github.com/nrkno/tv-automation-server-core/commit/2cef36c3f2e70ee722b5b890f5619d36fb7fa36d))
- blueprint-integration: add expectedPackages properties to Adlib actions ([b45df41](https://github.com/nrkno/tv-automation-server-core/commit/b45df419140aa3c4280cc8832368b69ea2790085))
- clarify typings of ExpectedPackageWorkStatus.fromPackages property ([ec7c26d](https://github.com/nrkno/tv-automation-server-core/commit/ec7c26d072375bd185d513e9612aabf8d49ed2ac))
- expectedPackages: add seekTime property for thumbnail generation ([baa551d](https://github.com/nrkno/tv-automation-server-core/commit/baa551d8334746138bbc667ae5e385d4ca7bd96f))
- invalidReason translation ([#459](https://github.com/nrkno/tv-automation-server-core/issues/459)) [publish] ([5bd01d4](https://github.com/nrkno/tv-automation-server-core/commit/5bd01d4660e9e76b07a2a3e02e8a4bc7ffd8a5f6))
- merge MappedDrive into FileShare, they will configured as the same thing ([852c5ea](https://github.com/nrkno/tv-automation-server-core/commit/852c5ea4544e3a06f0c8b3bcbd3646c8df5d85fd))
- minor fixes ([2f66298](https://github.com/nrkno/tv-automation-server-core/commit/2f66298b021f4366e1f1c796bbb53127484db035))
- move PackageContainerPackageStatus to blueprint-integration ([ebe3b3f](https://github.com/nrkno/tv-automation-server-core/commit/ebe3b3fe373791d302d51d1a13a5d597f8324e5a))
- package management: continued implementations ([9a23581](https://github.com/nrkno/tv-automation-server-core/commit/9a23581c2335df6587dd95d9e9f16afd2b3b45e5))
- package: type updates, add locations ([e393b22](https://github.com/nrkno/tv-automation-server-core/commit/e393b221affc8b6994c5dceaee88ec5456147afb))
- remove unused properties [publish] ([115ede6](https://github.com/nrkno/tv-automation-server-core/commit/115ede6d3e9a947eea788c7290b5757b9cb38e26))
- types: package origins: add HTTP interface ([3bb36fa](https://github.com/nrkno/tv-automation-server-core/commit/3bb36fa8d4ea7dbcb73014ad9ded596e9de19cff))
- typings fixes ([0721e16](https://github.com/nrkno/tv-automation-server-core/commit/0721e16b58ef0c032bc0d5bce7b6c563c133f550))

## [1.18.0](https://github.com/nrkno/tv-automation-server-core/compare/v1.18.0-1-in-testing-R30...v1.18.0) (2021-03-16)

### Features

- add interface IAsRunEventUserContext ([a3284a8](https://github.com/nrkno/tv-automation-server-core/commit/a3284a8f217f4040b79cb49a95dccb969e12bb82))
- expose PartInstance.orphaned to blueprints [publish] ([e1dc02a](https://github.com/nrkno/tv-automation-server-core/commit/e1dc02acb73f86dc5f9979374973a2819cdafbc8))
- PartInstances without Parts ([#417](https://github.com/nrkno/tv-automation-server-core/issues/417)) ([8895258](https://github.com/nrkno/tv-automation-server-core/commit/889525886f986f69fb91af55b49ed9b93780b67c))
- remove impossible interfaces and add type predicate functions for ICommonContext and IUserNotesContext ([3aecc51](https://github.com/nrkno/tv-automation-server-core/commit/3aecc5118fa5c5a5c008655862349c87c563793b))
- ShowStyleBlueprintManifest.onAsRunEvent context changed to user context ([5738cf9](https://github.com/nrkno/tv-automation-server-core/commit/5738cf97b70c452ecfc3ed0b5a3515105b292d38))
- ShowStyleBlueprintManifest.onTimelineGenerate changed to have user space context. Unused context argument removed from ShowStyleBlueprintManifest.getEndStateForPart ([ef97859](https://github.com/nrkno/tv-automation-server-core/commit/ef978590894d249796e9e853f24d3684c6ec43f3))
- simplify some piece content typings ([#388](https://github.com/nrkno/tv-automation-server-core/issues/388)) [publish] ([#388](https://github.com/nrkno/tv-automation-server-core/issues/388)) ([359916f](https://github.com/nrkno/tv-automation-server-core/commit/359916fbcfd2f86a2a0a2f836bef871a83a736c3))

### Bug Fixes

- add hint field to config manifest interfaces [publish] ([74b93b9](https://github.com/nrkno/tv-automation-server-core/commit/74b93b9113f824d225a47e976b9abb9cb5637395))
- bring back context argument for ShowStyleBlueprintManifest.getEndStateForPart ([903c6ab](https://github.com/nrkno/tv-automation-server-core/commit/903c6ab49f495fea7f25287826f854b96b3419a1))
- change back to non user contexts for ShowStyleBlueprintManifest.onTimelineGenerate and onAsRunEvent ([cfc0a1b](https://github.com/nrkno/tv-automation-server-core/commit/cfc0a1b40d23e59cfa3d2965f1480893c59f2204))
- remove unused context argument from StudioBlueprintManifest.getRundownPlaylistInfo, StudioBlueprintManifest.preprocessConfig and ShowStyleBlueprintManifest.getShowStyleVariantId ([0e30711](https://github.com/nrkno/tv-automation-server-core/commit/0e30711831ce11366be5ea1fecb595c3279805ac))
- remove unused import (linting error) ([970c8ea](https://github.com/nrkno/tv-automation-server-core/commit/970c8ea155fb6229c02c410afe0da3c8f78fdfdd))
- settle inconsistencies between outdated translation code and newer blueprint changes ([5cdf1e5](https://github.com/nrkno/tv-automation-server-core/commit/5cdf1e5a7f722c31411c8d95efd6e2228c6e4344))

## [1.17.0](https://github.com/nrkno/tv-automation-server-core/compare/v1.16.2...v1.17.0) (2021-02-08)

## [1.17.0-in-testing-R29.1](https://github.com/nrkno/tv-automation-server-core/compare/v1.16.0-in-testing-R28.1...v1.17.0-in-testing-R29.1) (2021-01-15)

### Features

- add getPartInstanceForPreviousPiece method to ActionExecutionContext ([74f939e](https://github.com/nrkno/tv-automation-server-core/commit/74f939e4b18835d83f9fa84302ac6a8f73a764f3))
- special timeline class for when the first part hasn't been taken ([#421](https://github.com/nrkno/tv-automation-server-core/issues/421)) ([789f8cb](https://github.com/nrkno/tv-automation-server-core/commit/789f8cbdf9d9bcf1594d78090152659aa486cd79))

## [1.17.0-in-testing-R29.1](https://github.com/nrkno/tv-automation-server-core/compare/v1.16.0-in-testing-R28.1...v1.17.0-in-testing-R29.1) (2021-01-15)

### Features

- add getPartInstanceForPreviousPiece method to ActionExecutionContext ([74f939e](https://github.com/nrkno/tv-automation-server-core/commit/74f939e4b18835d83f9fa84302ac6a8f73a764f3))
- special timeline class for when the first part hasn't been taken ([#421](https://github.com/nrkno/tv-automation-server-core/issues/421)) ([789f8cb](https://github.com/nrkno/tv-automation-server-core/commit/789f8cbdf9d9bcf1594d78090152659aa486cd79))

## [1.16.0](https://github.com/nrkno/tv-automation-server-core/compare/v1.16.0-in-testing-R28.1...v1.16.0) (2021-01-19)

## [1.16.0-in-testing-R28.1](https://github.com/nrkno/tv-automation-server-core/compare/v1.16.0-in-testing-R28.0...v1.16.0-in-testing-R28.1) (2020-12-14)

## [1.16.0-in-testing-R28.0](https://github.com/nrkno/tv-automation-server-core/compare/v1.15.0...v1.16.0-in-testing-R28.0) (2020-12-14)

### Features

- additional Action Manifest properties ([bbe47a8](https://github.com/nrkno/tv-automation-server-core/commit/bbe47a8a1530f9820407aed36f9bc42ffff4e1d8))
- import bucket actions via blueprints ([a9221b6](https://github.com/nrkno/tv-automation-server-core/commit/a9221b65ab502c16344e93124a14e50bbe5a36aa))
- mono repo ([49c12e0](https://github.com/nrkno/tv-automation-server-core/commit/49c12e0d8a79113a5647236602390d315fc2fd8f))
- remove blueprints minimumCoreVersion as the version of blueprin… ([#405](https://github.com/nrkno/tv-automation-server-core/issues/405)) ([ff775ad](https://github.com/nrkno/tv-automation-server-core/commit/ff775ad5485d1960c15cc565a940d2579c68e66e))
- update policies enhancements ([#380](https://github.com/nrkno/tv-automation-server-core/issues/380)) ([5a5b8ab](https://github.com/nrkno/tv-automation-server-core/commit/5a5b8ab55f3e867f05c60572df7db0aed6bc5f6e))

### Bug Fixes

- remove worksOn and replace with just a simple triggerLabel: string ([4bf45f2](https://github.com/nrkno/tv-automation-server-core/commit/4bf45f2fd433143274fd52cef6fc5e029b8fc89c))
