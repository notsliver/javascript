# 1. Installation

npm install @discolytics/discordjs

# 2. Get API Key

Under the API Keys tab of your dashboard, create a new API key. Copy this key and your bot ID to connect within your codebase.

# 3. Example Usage

Initiate the client library in your codebase. When initiating the Discolytics client, pass your Discord JS client for the bot property. Enter your bot ID and API key from the previous step to connect, as well as your bot token under the token option.

> Your bot token is never sent to Discolytics servers. It is used by our client libraries on your machine to make requests to Discord on your behalf for metadata and analytics (such as to request your bot profile, guild count, etc).

```js
require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { Discolytics } = require('@discolytics/discordjs');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

new Discolytics({
	botId: 'YOUR_BOT_ID',
	apiKey: process.env.DISCOLYTICS_KEY,
	bot: client,
	token: process.env.TOKEN,
});

client.on('ready', () => {
	console.log(`Logged in as ${client.user.tag}!`);
});

client.login(process.env.TOKEN);
```

# Support

Join our Discord server for help and support.

- https://discord.gg/aDPeJDcumz
