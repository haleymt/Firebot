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

**1.** To create an app, go [ here ]( https://api.slack.com/apps?new_app=1 ) and click **Create New App**. Follow the directions. Make sure to add a bot user to the app. Hang on to the `clientId` and `clientSecret`.
**2.** Clone this repository to your computer and run `npm install`.
**3.** Create a file called `.env` and add your`clientId` and `clientSecret` to it. You'll also need to define the port. Your `.env` file should look like this:
```
clientSecret=XXXXXXXXXX.XXXXXXXXX
clientId="XXXXXXX-XXXXXXXXX-XXXXXXXXX"
port=3000
IS_DEV=true
```
**4.** To start the server, run `npm start` in the terminal and navigate to localhost.
**5.** **NOTE:** Before pushing any edits, be sure to either add the following to a `.gitignore` file or `rm -rf` each of them from the terminal. Both `.env` and `db_firebot` contain sensitive information. In particular, pushing `db_firebot` will cause any tokens stored there to become invalid. Pushing anything from `node_modules` will cause errors in the production environment. Your `.gitignore` should look like this:
```
.gitignore
.env
node_modules/*
db_firebot/*
```

## Firebot as a Custom Integration
If you want to use Firebot but don't feel comfortable with it using your data,
or you just want to customize it with weird things, a custom integration is the way to go. You can find the repository for the custom integration version of Firebot [ here ]( https://github.com/haleymt/Firebot_CI ).
