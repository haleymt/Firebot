/* FIREBOT */

if (!process.env.token) {
    console.log('Error: Specify token in environment');
    process.exit(1);
}

var Botkit = require('botkit');
var os = require('os');
var subtypeWhitelist = ['file_comment', 'file_mention', 'file_share', 'message_replied', 'reply_broadcast'];

var controller = Botkit.slackbot({
    debug: true,
});

controller.configureSlackApp({
  clientId: process.env.clientId,
  clientSecret: process.env.clientSecret,
  redirectUri: 'http://localhost:3002',
  scopes: ['incoming-webhook','team:read','users:read','channels:read','im:read','im:write','groups:read','emoji:read','chat:write:bot']
});

controller.setupWebserver(process.env.port,function(err,webserver) {

  // set up web endpoints for oauth, receiving webhooks, etc.
  controller
    .createHomepageEndpoint(controller.webserver)
    .createOauthEndpoints(controller.webserver)
    .createWebhookEndpoints(controller.webserver);

});

controller.hears(['which channels'], 'direct_message,direct_mention,mention', function(bot, message) {
  bot.dailyActiveChannels = [];

  bot.getActivity(true, function (channel, isLast) {
    if (channel) {
      bot.dailyActiveChannels.push(channel);
    }

    if (isLast && bot.dailyActiveChannels.length) {
      var text = formatBotText(bot.dailyActiveChannels, true);
      bot.reply(message, text);
    }
  });
});

var bot = controller.spawn({
    token: process.env.token
}).startRTM();

bot.dailyActiveChannels = [];
bot.recentActiveChannels = [];

bot.getChannelList = function(callback) {
  /* Slack API call to get list of channels */
  this.api.channels.list({ token: this.token }, function (err, res) {
    if (res && res.ok) {
      callback(res.channels);
    }
  });
};

bot.getChannelHistory = function(channel, isLast, daily, callback) {
  /* milliseconds in a day === 86400000 */
  /* milliseconds in 20 minutes === 1200000 */
  var offset = daily ? 86400000 : 1200000;
  var messageMinimum = daily ? 19 : 9;
  var oldestTime = (new Date().getTime() - offset) / 1000;

  this.api.channels.history({
    token: this.token,
    channel: channel.id,
    oldest: oldestTime,
    count: 50,
  }, function(err, res) {
    if (res && res.ok && res.messages && channelIsActive(res.messages, messageMinimum)) {
      callback(channel, isLast);
    } else if (isLast) {
      callback(false, isLast)
    }
  });
};

bot.getActivity = function(daily, callback) {
  /* Gets list of channels with more than X messages in the last day */

  this.getChannelList(function (channels) {
    if (channels) {
      for (var i = 0; i < channels.length; i++) {
        var isLast = i === channels.length - 1;
        this.getChannelHistory(channels[i], isLast, daily, callback);
      }
    }
  }.bind(this));
};

bot.startInterval = function () {
  /* Checks level of activity every 10 minutes (600000ms)*/
  var _this = this;
  var checkInterval = setInterval( function () {
    _this.recentActiveChannels = [];

    _this.getActivity(false, function (channel, isLast) {
      if (channel) {
        _this.recentActiveChannels.push(channel);
      }

      if (isLast && _this.recentActiveChannels.length) {
        var text = formatBotText(_this.recentActiveChannels);
        _this.send({text: text, channel: "#general"});
      }
    });

  }, 900000);
};

bot.startInterval();

function channelIsActive (messages, minimum) {
  var users = [];
  var messageCount = 0;

  for (var i = 0; i < messages.length; i++) {
    if (!messages[i].subtype || subtypeWhitelist.indexOf(messages[i].subtype) > -1) {
      messageCount++;
    }

    if (users.indexOf(messages[i].user) < 0) {
      users.push(messages[i].user);
    }

    if (messageCount > minimum && users.length > 1) {
      return true;
    }
  }

  return messageCount > minimum && users.length > 1;
};

function formatBotText (channelList, daily) {
  var text = 'The ';

  if (daily) {
    if (channelList.length === 1) {
      text += `#${channelList[0].name} channel was `;
    } else {
      for (var i = 0; i < channelList.length; i++) {
        if (i === channelList.length - 1) {
          text += ` and #${channelList[i].name} channels were `;
        } else if (i === channelList.length - 2) {
          text += `#${channelList[i].name}`;
        } else {
          text += `#${channelList[i].name}, `;
        }
      }
    }

    text += 'busy today.';
  } else {
    if (channelList.length === 1) {
      text += `#${channelList[0].name} channel is `;
    } else {
      for (var i = 0; i < channelList.length; i++) {
        if (i === channelList.length - 1) {
          text += ` and #${channelList[i].name} channels are `;
        } else if (i === channelList.length - 2) {
          text += `#${channelList[i].name}`;
        } else {
          text += `#${channelList[i].name}, `;
        }
      }
    }

    text += 'lit right now.';
  }

  return text;
};
