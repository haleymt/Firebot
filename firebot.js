/* FIREBOT */

if (!process.env.token) {
    console.log('Error: Specify token in environment');
    process.exit(1);
}

var Botkit = require('botkit');
var os = require('os');
var subtypeWhitelist = ['file_comment', 'file_mention', 'file_share', 'message_replied', 'reply_broadcast'];
var negatives = ['no', 'no.', 'nope', 'not at all', 'no, only hales', 'uh..', 'lol', 'sorry man', 'meh', 'nah', 'ha', 'never', 'definitely not'];
var positives = ['very much so', 'absolutely', 'def', 'ya'];
var indifferent =['fine', 'meh', 'sure', 'hm', 'no'];
var people = ['shreeda', 'freeshreeda', 'curry.ove', 'beiser', 'voidfraction', 'akira', 'sol', 'tao', 'turrible_tao', 'jamesmcn', 'ksim', 'jsf', 'ema', 'othercriteria', 'cwage', 'alt', 'meaningness', 'andrew', 'asquidislove', 'ctrl', 'black_dwarf', 'blue_traveler', 'byrne', 'pamela', 'bookoftamara', 'chamber_of_heart', 'cobuddha', 'contemplationist', 'drethelin', 'grumplessgrinch', 'gabe', 'joelgrus', 'julespitt', 'keffie', 'mattsimpson', 'niftierideology', 'simplicio', 'suchaone', 'svigalae', 'the_langrangian', 'tipsycaek'];

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

controller.hears(['is (.*) lit', 'is (.*) lit right now', 'is (.*) lit rn'], 'ambient,direct_message,direct_mention,mention', function(bot, message) {
  var channel = message.match[1];
  console.log(channel);
  var text = 'nope';

  if (channel[0] === '#') {
    channel = channel.slice(1);
  }

  if (channel[0] === '<') {
    channel = channel.slice(channel.indexOf('|') + 1, channel.length - 1);
  }

  if (channel === 'hales' || channel === 'firebot') {
    text = positives[Math.floor(Math.random() * positives.length)];
  }

  if (channel === 'beiser') {
    text = 'lol fuck off';
  }
  
  if (channel === 'rev' || channel === 'st_rev') {
    text = indifferent[Math.floor(Math.random() * indifferent.length)];
  }

  if (channel === 'sarah' || channel === 'sarahsloth') {
    text = 'they are a banana';
  }

  if (people.indexOf(channel) > -1) {
    text = negatives[Math.floor(Math.random() * negatives.length)];
  }

  if (bot.hourlyActivity[channel]) {
    var text = channel === 'politics' ? 'no, but yes' : 'yep';
  }

  bot.reply(message, text);
});

var bot = controller.spawn({
    token: process.env.token
}).startRTM();

bot.dailyActiveChannels = [];
bot.recentActiveChannels = [];
bot.hourlyActivity = {};

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

        if (!_this.hourlyActivity[channel.name] || _this.hourlyActivity[channel.name] === 4) {
          _this.hourlyActivity[channel.name] = 1;
        } else {
          _this.hourlyActivity[channel.name] += 1;
        }
      }

      if (isLast) {
        /* Only announces channels that haven't been announced in the last hour */
        var filteredChannels = [];
        for (var i = 0; i < _this.recentActiveChannels.length; i++) {
          if (_this.hourlyActivity[_this.recentActiveChannels[i].name] === 1) {
            filteredChannels.push(_this.recentActiveChannels[i]);
          }
        }

        /* If a channel wasn't active during the last tick, it resets the hourly count to 0 */
        Object.keys(_this.hourlyActivity).forEach(function(key) {
          if (!_this.recentActiveChannels.find(function(channel) { channel.name === key })) {
            var value = _this.hourlyActivity[key];
            _this.hourlyActivity[key] = value && value < 4 ? value + 1 : 0;
          }
        });

        if (filteredChannels.length) {
          var text = formatBotText(filteredChannels);
          _this.send({text: text, channel: "#isitlit"});
        }
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
