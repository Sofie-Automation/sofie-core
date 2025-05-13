---
sidebar_position: 3
---

# Initial Sofie Core Setup

#### Prerequisites

- [Installed and running _Sofie&nbsp;Core_](installing-sofie-server-core.md)

Once _Sofie&nbsp;Core_ has been installed and is running you can begin setting it up. The first step is to navigate to the _Settings page_. If you are running locally with docker compose, visit (http://localhost:3000/settings/?admin=1)[http://localhost:3000/settings/?admin=1], otherwise see the [Sofie Access Level](../features/access-levels.md) page for assistance getting there.

<!-- TODO: If I'm working my way through the docs, What exactly should I set up here? Studio? Playout device? -->

Next, you will need to add some [Blueprints](installing-blueprints.md) and add [Gateways](installing-a-gateway/intro.md) to allow _Sofie_ to interpret rundown data and then play out things.

<!-- TODO: Database seemed already up to date when I came to this point following the instructions, is this the best place to talk about upgrading it? -->

To upgrade to a newer version or installation of new blueprints, Sofie needs to run its "Upgrade database" procedure to migrate data and pre-fill various settings. You can do this by clicking the _Upgrade Database_ button in the menu.

![Update Database Section of the Settings Page](/img/docs/getting-started/settings-page-full-update-db-r47.png)

Fill in the form as prompted and continue by clicking _Run Migrations Procedure_. Sometimes you will need to go through multiple steps before the upgrade is finished.

<!-- TODO: Explain this image -->

![Initial Studio Settings Page](/img/docs/getting-started/settings-page-initial-studio.png)
