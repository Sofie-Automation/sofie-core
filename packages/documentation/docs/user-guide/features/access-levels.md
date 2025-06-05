---
sidebar_position: 3
---

# Access Levels

## Permissions

There are a few different access levels that users can be assigned. They are not heirarchical, you will often need to enable multiple for each user.
Any client that can access Sofie always has at least view-only access to the rundowns, and system status pages.

| Level         | Summary                                                                                                                                          |
| :------------ | :----------------------------------------------------------------------------------------------------------------------------------------------- |
| **studio**    | Grants access to operate a studio for playout of a rundown.                                                                                      |
| **configure** | Grants access to the settings pages of Sofie, and other abilities to configure the system.                                                       |
| **developer** | Grants access to some tools useful to developers. This also changes some ui behaviours to be less agressive in what is shown in the rundown view |
| **testing**   | Enables the page Test Tools, which contains various tools useful for testing the system during development                                       |
| **service**   | Grants access to the external message status page, and some additional rundown management options that are not commonly needed                   |
| **gateway**   | Grants access to various APIs intended for use by the various gateways that connect Sofie to other systems.                                      |

## Authentication providers

There are two ways to define the access for each user, which to use depends on your security requirements.

### Browser based

:::info

This is a simple mode that relies on being able to trust every client that can connect to Sofie

:::

In this mode, a variety of access levels can be set via the URL. The access level is persisted in browser's Local Storage.

By default, a user cannot edit settings, nor play out anything. Some of the access levels provide additional administrative pages or helpful tool tips for new users. These modes are persistent between sessions and will need to be manually enabled or disabled by appending a suffix to the url.
Each of the modes listed in the levels table above can be used here, such as by navigating to `https://my-sofie/?studio=1` to enable studio mode, or `https://my-sofie/?studio=0` to disable studio mode.

There are some additional url parameters that can be used to simplify the granting of permissions:

- `?help=1` will enable some tooltips that might be useful to new users.
- `?admin=1` will give the user the same access as the _Configuration_ and _Studio_ modes as well as having access to a set of _Test Tools_ and a _Manual Control_ section on the Rundown page.

#### See Also

[URL Query Parameters](../../for-developers/url-query-parameters.md)

### Header based

:::danger

This mode is very new and could have some undiscovered holes.
It is known that secrets can be leaked to all clients who can connect to Sofie, which is not desirable.

:::

In this mode, we rely on Sofie being run behind a reverse-proxy which will inform Sofie of the permissions of each connection. This allows you to use your organisations preferred auth provider, and translate that into something that Sofie can understand.
To enable this mode, you need to enable the `enableHeaderAuth` property in the [settings file](../configuration/sofie-core-settings.md)

Sofie expects that for each DDP connection or http request, the `dnt` header will be set containing a comma separated list of the levels from the above table. If the header is not defined or is empty, the connection will have view-only access to Sofie.
This header can also contain simply `admin` to grant the connection permission to everything.
We are using the `dnt` header due to limitations imposed by Meteor, but intend this to become a proper header name in a future release.

When in this mode, you should make sure that Sofie can only be accessed through the reverse proxy, and that the reverse-proxy will always override any value sent by a client.
Because the value is defined in the http headers, it is not possible to revoke permissions for a user who currently has the ui open. If this is necessary to do, you can force the connection to be dropped by the reverse-proxy.
