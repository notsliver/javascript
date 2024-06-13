The JavaScript core package is where all other JS packages are built off of. If you have a custom implementation that doesn't fit in the other libraries, use the core package.

# 1. Installation

> npm install @discolytics/core

# 2. Get API Key

Under the API Keys tab of your dashboard, create a new API key. Copy this key and your bot ID to connect within your codebase.

# 3. Example Usage

Initiate the client library in your codebase. Enter your bot ID and API key from the previous step to connect, as well as your bot token under the token option. The example code below showcases how to connect and the methods you need to implement.

> Your bot token is never sent to Discolytics servers. It is used by our client libraries on your machine to make requests to Discord on your behalf for metadata and analytics (such as to request your bot profile, guild count, etc).

```js
require('dotenv').config();
const { Discolytics } = require('@discolytics/core');

const discolytics = new Discolytics({
	botId: 'YOUR_BOT_ID',
	authToken: `Bot ${process.env.TOKEN}`,
	apiKey: process.env.DISCOLYTICS_KEY,
});

// use discolytics.sendEvent() to send an event. Pass the event name and guild id (optional)
discolytics.sendEvent('MESSAGE_CREATE', 'GUILD_ID');

// use discolytics.postInteraction() to post an interaction. Pass the interaction type and guild id (optional)
discolytics.postInteraction(1, 'GUILD_ID');

// start a new command with discolytics.startCommand(). Provide the command name and user ID.
const command = discolytics.startCommand('help', '123');

setTimeout(() => {
	// run the .end() method on the command to end it, posts the command with the calculated duration
	command.end();
}, 5000);
```

# Support

Join our Discord server for help and support.

- https://discord.gg/aDPeJDcumz
