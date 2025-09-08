---
sidebar_position: 3
---
# Access Levels

A variety of access levels can be set via the URL. By default, a user cannot edit settings, nor play out anything. Some of the access levels provide additional administrative pages or helpful tool tips for new users. These modes are persistent between sessions and will need to be manually disabled by replacing the _1_ with a _0_ in the URL. Below is a quick reference to the modes and what they have access to.

If user accounts are enabled \(`enableUserAccounts` in [_Sofie&nbsp;Core_ settings](../configuration/sofie-core-settings#settings-file)\), the access levels are set under the user settings. If no user accounts are set, the access level for a browser is set by adding `?theaccessmode=1` to the URL as described below.

The access level is persisted in browser's Local Storage. To disable, visit`?theaccessmode=0`.

| Access area | Basic Mode | Configuration Mode | Studio Mode | Admin Mode |
| :--- | :--- | :--- | :--- | :--- |
| **Rundowns** | View Only | View Only | Yes, playout | Yes, playout |
| **Settings** | No | Yes | No | Yes |


### Basic Mode

Without enabling any additional modes in Sofie, the browser will have minimal access to the system. It will be able to view a rundown but, will not have the ability to manipulate it. This includes activating, deactivating, or resetting the rundown as well as taking the next part, adlib, etc.

### Studio Mode

Studio Mode gives the current browser full control of the studio and all information associated to it. This includes allowing actions like activating and deactivating rundowns, taking parts, adlibbing, etc. This mode is accessed by adding a `?studio=1` to the end of the URL.

### Configuration Mode

Configuration mode gives the user full control over the Settings pages and allows full access to the system including the ability to modify _Blueprints_, _Studios_, or _Show Styles_, creating and restoring _Snapshots_, as well as modifying attached devices.

### Help Mode

Enables some tooltips that might be useful to new users. This mode is accessed by adding `?help=1` to the end of the URL.

### Admin Mode

This mode will give the user the same access as the _Configuration_ and _Studio_ modes as well as having access to a set of _Test Tools_ and a _Manual Control_ section on the Rundown page.

This mode is enabled when `?admin=1` is added the end of the URL.

### Testing Mode

Enables the page Test Tools, which contains various tools useful for testing the system during development. This mode is enabled when `?testing=1` is added the end of the URL.

### Developer Mode

This mode will enable the browsers default right click menu to appear and can be accessed by adding `?develop=1` to the URL. It will also reveal the Manual Control section on the Rundown page.

### See Also

[URL Query Parameters](../../for-developers/url-query-parameters.md)
