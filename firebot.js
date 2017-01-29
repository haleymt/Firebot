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
var badPeople = ['shreeda', 'freeshreeda', 'curry.ove', 'beiser', 'voidfraction', 'akira', 'sol', 'tao', 'turrible_tao', 'jamesmcn', 'ksim', 'jsf', 'ema', 'othercriteria', 'cwage', 'alt', 'meaningness', 'andrew', 'asquidislove', 'ctrl', 'black_dwarf', 'blue_traveler', 'byrne', 'pamela', 'bookoftamara', 'chamber_of_heart', 'cobuddha', 'contemplationist', 'drethelin', 'grumplessgrinch', 'joelgrus', 'julespitt', 'keffie', 'mattsimpson', 'niftierideology', 'simplicio', 'suchaone', 'svigalae', 'the_langrangian', 'tipsycaek'];

var controller = Botkit.slackbot({
    debug: true,
    retry: Infinity,
});

var bot = controller.spawn({
    token: process.env.token
}).startRTM(function(err, bot, payload) {
  if (bot) {
    bot.setUpBot(payload);
  }
});


// controller.configureSlackApp({
//   clientId: process.env.clientId,
//   clientSecret: process.env.clientSecret,
//   redirectUri: 'http://localhost:3000',
//   scopes: ['incoming-webhook','team:read','users:read','channels:read','im:read','im:write','groups:read','emoji:read','chat:write:bot']
// });
//
// controller.setupWebserver(process.env.port,function(err,webserver) {
//
//   controller
//     .createHomepageEndpoint(controller.webserver)
//     .createOauthEndpoints(controller.webserver)
//     .createWebhookEndpoints(controller.webserver);
//
// });

controller.hears(['which channels (.*)'], 'direct_message,direct_mention,mention', function(bot, message) {
  var question = message.match[1];

  if (question === 'are dead') {
    bot.deadChannels = [];

    bot.getDeadChannels(function(channel, isLast) {
      if (channel) {
        bot.deadChannels.push(channel);
      }

      if (isLast) {
        var deadText;
        if (bot.deadChannels.length) {
          deadText = formatBotText(bot.deadChannels, "dead", bot);
        } else {
          deadText = "No dead channels right now."
        }
        bot.reply(message, deadText);
      }
    });
  } else {
    bot.dailyActiveChannels = [];

    bot.getActivity(true, function (channel, isLast) {
      if (channel) {
        bot.dailyActiveChannels.push(channel);
      }

      if (isLast) {
        var text;
        if (bot.dailyActiveChannels.length) {
          text = formatBotText(bot.dailyActiveChannels, "daily", bot);
        } else {
          text = "No channels have been busy lately."
        }
        bot.reply(message, text);
      }
    });
  }
});

controller.hears(['who is lit'], 'direct_message,direct_mention,mention', function(bot, message) {
  bot.reply(message, 'firebot is pretty lit');
});

controller.hears(['is (.*) lit', 'is (.*) lit right now', 'is (.*) lit rn', 'am i lit', 'are (.*) lit'], 'ambient,direct_message,direct_mention,mention', function(bot, message) {
  var channel = message.match[1];

  if (channel) {
    var text = 'nope';

    if (channel[0] === '#') {
      channel = channel.slice(1);
    }

    if (channel[0] === '<') {
      var pipeIndex = channel.indexOf('|');
      if (pipeIndex > -1) {
        /* Gets a channel name from a mention */
        channel = channel.slice(pipeIndex + 1, channel.length - 1);
      } else if (channel[1] === '@') {
        /* Gets a user name from a mention */
        channel = channel.slice(2, channel.length - 1);
        for (var i = 0; i < bot.allUsers.length; i++) {
          if (bot.allUsers[i].id === channel) {
            channel = bot.allUsers[i].name;
          }
        }
      }
    }

    if (channel === 'hales' || channel === 'firebot' || channel === 'haley') {
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

    if (channel === 'gabe') {
      text = ':hankey:';
    }

    if (badPeople.indexOf(channel) > -1) {
      text = negatives[Math.floor(Math.random() * negatives.length)];
    }

    if (bot.hourlyActivity[channel]) {
      var text = channel === 'politics' ? 'no, but yes' : 'yep';
    }

    bot.reply(message, text);
  }
});

bot.dailyActiveChannels = [];
bot.recentActiveChannels = [];
bot.deadChannels = [];
bot.hourlyActivity = {};

bot.setUpBot = function (payload) {
  bot.allChannels = [];
  bot.allUsers = []

  if (payload) {
    if (payload.channels) {
      payload.channels.forEach(function(channel) {
        if (!channel.is_archived) {
          bot.allChannels.push(channel);
        }
      });
    }

    if (payload.users) {
      bot.allUsers = payload.users;
    }

    // bot.getDeadChannels(function(channel, isLast) {
    //   if (channel) {
    //     bot.deadChannels.push(channel);
    //   }
    // });
  }
};

bot.getChannelList = function(callback) {
  /* Slack API call to get list of channels */
  var _this = this;
  if (this.allChannels && this.allChannels.length) {
    callback(this.allChannels);
  } else {
    this.api.channels.list({ token: this.token }, function (err, res) {
      if (res && res.ok) {
        _this.allChannels = res.channels;
        callback(res.channels);
      }
    });
  }
};

bot.getChannelHistory = function(channel, isLast, daily, callback) {
  /* milliseconds in a day === 86400000 */
  /* milliseconds in 15 minutes === 900000 */
  var offset = daily ? 86400000 : 900000;
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

bot.getDeadChannelHistory = function (channel, isLast, callback) {
  var weekAgo = (new Date().getTime() - (86400000 * 7)) / 1000;

  this.api.channels.history({
    token: this.token,
    channel: channel.id,
    oldest: weekAgo,
    count: 10
  }, function(err, res) {
    if (res && res.ok && res.messages && !res.messages.length) {
      callback(channel, isLast);
    } else if (isLast) {
      callback(false, isLast);
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

bot.getDeadChannels = function(callback) {
  this.getChannelList(function (channels) {
    if (channels) {
      for (var i = 0; i < channels.length; i++) {
        var isLast = i === channels.length - 1;
        this.getDeadChannelHistory(channels[i], isLast, callback);
      }
    }
  }.bind(this));
};

bot.checkForChannelRevival = function (channel) {
  return bot.deadChannels.find(function(ch) { return ch.id === channel.id });
};

bot.startInterval = function () {
  /* Checks level of activity every 10 minutes (600000ms)*/
  var _this = this;
  var checkInterval = setInterval( function () {
    _this.recentActiveChannels = [];

    _this.getActivity(false, function (channel, isLast) {
      if (channel) {
        _this.recentActiveChannels.push(channel);

        if (!_this.hourlyActivity[channel.name] || _this.hourlyActivity[channel.name] === 5) {
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
            _this.hourlyActivity[key] = value && value < 5 ? value + 1 : 0;
          }
        });

        if (filteredChannels.length) {
          var text = formatBotText(filteredChannels, "lit", _this);
          _this.send({text: text, channel: "#isitlit"});
        }
      }
    });

  }, 600000);
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

function formatBotText (channelList, type, bot) {
  var text = 'The ';
  var channelName;

  if (type === 'daily' || type === 'revived') {
    for (var i = 0; i < channelList.length; i++) {
      channelName = getChannelText(channelList[i].name, bot);
      if (channelList.length === 1) {
        text += `${channelName} channel was `;
      } else if (i === channelList.length - 1) {
        text += ` and ${channelName} channels were `;
      } else if (i === channelList.length - 2) {
        text += `${channelName}`;
      } else {
        text += `${channelName}, `;
      }
    }

    if (type === 'daily') {
      text += 'busy today.';
    } else {
      text += 'revived!!!';
    }
  } else {
    for (var i = 0; i < channelList.length; i++) {
      channelName = getChannelText(channelList[i].name, bot);
      if (channelList.length === 1) {
        text += `${channelName} channel is `;
      } else if (i === channelList.length - 1) {
        text += ` and ${channelName} channels are `;
      } else if (i === channelList.length - 2) {
        text += `${channelName}`;
      } else {
        text += `${channelName}, `;
      }
    }

    if (type === 'dead') {
      text += 'pretty dead. No new posts in the last week.'
    } else {
      text += 'lit right now.';
    }
  }

  return text;
};

function getChannelText(channelName, bot) {
  if (bot && bot.allChannels && bot.allChannels.length) {
    var chan = bot.allChannels.find(function(channel) {
      return channel.name === channelName;
    });

    if (chan) {
      return '<#' + chan.id + '|' + channelName + '>';
    }
  }

  return channelName;
};
