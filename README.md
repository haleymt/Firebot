# Firebot
Firebot is a Slack App for tracking activity in a team's public channels. It is written in Node.js, building off of the [ Botkit ]( https://github.com/howdyai/botkit ) library.


## Using Firebot
If you'd like to simply add Firebot to your team as an app, you can do so
[ here ]( http://fervidbot.com ). If you'd like to run the app in a development
environment or you'd like to adapt the bot to be a custom integration, see below.
For any questions about [ Botkit ]( https://github.com/howdyai/botkit ) or using the [ Slack API ]( https://api.slack.com/ ), see their documentation.

## Firebot in Development
Right now, in order to run Firebot in development you'll need to create your own app on Slack and have a Slack group you can test it in. You need an app of your
own in order to get a unique `clientId` and `clientSecret` from Slack that will
allow you to make oauth requests.  

1. To create an app, go [ here ]( https://api.slack.com/apps?new_app=1 ) and click **Create New App**. Follow the directions. Make sure to add a bot user to the app. Hang on to the `clientId` and `clientSecret`.
2. Clone this repository to your computer and run `npm install`.
3. Create a file called `.env` and add your`clientId` and `clientSecret` to it. You'll also need to define the port. Your `.env` file should look like this:
```
clientSecret=XXXXXXXXXX.XXXXXXXXX
clientId="XXXXXXX-XXXXXXXXX-XXXXXXXXX"
port=3000
IS_DEV=true
```
4. To start the server, run `npm start` in the terminal and navigate to localhost.
5. Before pushing any edits, be sure to either add the following to a `.gitignore` file or `rm -rf` each of them from the terminal. Both `.env` and `db_firebot` contain sensitive information. In particular, pushing `db_firebot` will cause any tokens stored there to become invalid. Pushing anything from `node_modules` will cause errors in the production environment. Your `.gitignore` should look like this:
```
.gitignore
.env
node_modules/*
db_firebot/*
```

## Firebot as a Custom Integration
If you want to use Firebot but don't feel comfortable with it using your data,
or you just want to customize it with weird things, a custom integration is the way to go.

1. Create a bot user in whatever Slack group you'd like Firebot to post in. Navigate to `[YOUR_GROUP_NAME].com/apps/build/custom-integration` and select **Bots**. Create the bot and name it whatever you like. Be sure to hang on to the token that Slack gives you.
2. Download the `firebot_ci` folder from this repository. From there you can run it in two ways:

### Firebot as its own app
`firebot_ci` is just a basic Express app. To host it locally or on its own server, do the following:    

1. Run `npm install`  
2. Create a file called `.env` and add your `token` to it. You'll also need to define the port. Your `.env` file should look like this:
```
token="XXXXXXX-XXXXXXXXX-XXXXXXXXX"
port=3000
```  
3. If you'd like to host the bot on it's own server, deploy it as you would any other app. If you only want to host it on your local server, run `npm start` in the command line. As long as your local server is up on your computer, the bot will work in your Slack group.
4. Before pushing any edits, be sure to either add `.env` to a `.gitignore` file, remove `.env` from your repository, or simply delete your token from `.env`. Pushing your `token` to a code repository will cause it to become invalid (you can get a new one, but that's a pain). If you're using Firebot on its own server, be sure to remove your `node_modules` too. Your `.gitignore` should look like this:
```
.env
node_modules/*
```

### Firebot in another app
Firebot is not yet available as a package on npm. If you'd like to run it within an app you already have, do the following:  

1. Include the latest version of Botkit in your `package.json`.  
2. Include the `firebot.js` file somewhere in your application.  
3. Include your `token` in your `process.env`.  
4. Import `firebot` and run it somewhere in your application. Pass in your token. Your file will look something like this:  
```javascript
var Firebot = require('./firebot');

Firebot.run({ token: process.env.firebot_token });

// If you'd like to stop Firebot at any time, you can do that too.
if (xyz) {
  Firebot.stop();
}

```
