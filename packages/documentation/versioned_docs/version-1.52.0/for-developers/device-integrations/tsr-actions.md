# TSR Actions

Sometimes a state based model isn't enough and you just need to fire an action. In Sofie we try to be strict about any playout operations needing to be state based, i.e. doing a transition operation on a vision mixer should be a result of a state change, not an action. However, there are things that are easier done with actions. For example cleaning up a playlist on a graphics server or formatting a disk on a recorder. For these scenarios we have added TSR Actions.

TSR Actions can be triggered through the UI by a user, through blueprints when the rundown is activated or deactivated or through adlib actions.

When implementing the TSR Actions API you should start by defining a JSON schema outlying the action id's and payload your integration will consume. Once you've done this you're ready to implement the actions as callbacks on the `actions` property of your integration.

:::warning
Beware that if your action changes the state of the device you should handle this appropriately by resetting the resolver
:::
