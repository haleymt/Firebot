/* Main Firebot functionality */


if (!process.env.clientId || !process.env.clientSecret || !process.env.port) {
  console.log('Error: Specify clientId clientSecret and port in environment');
  process.exit(1);
}

var Botkit = require('botkit');
var router = require('./routes/index');
var firebase_store = require('./store');
var {
  subtypeWhitelist,
  responses,
  hostName,
  controllerConfig,
  historyConfig,
  defaultInterval,
  isProduction
} = require('./constants');

var Firebot = {
  bots: {},

  trackBot: function(bot) {
    this.bots[bot.config.token] = bot;
  },

  run: function () {
    /* Use Firebase only in production */
    var controllerConfig = {
      debug: !isProduction,
      retry: Infinity
    };

    if (isProduction) {
      controllerConfig.storage = firebase_store;
    } else {
      /* Use a simple json file store in development */
      controllerConfig.json_file_store = './db_firebot';
    }
    
    this.controller = Botkit.slackbot(controllerConfig);

    this.controller.webserver = router;
    this.controller.config.port = process.env.port;

    this.setUpController();
  },

  setUpController: function() {
    var { controller } = this;

    controller.configureSlackApp({
      clientId: process.env.clientId,
      clientSecret: process.env.clientSecret,
      redirectUri: hostName + '/oauth',
      scopes: ['channels:history','incoming-webhook','team:read','users:read','chat:write:bot', 'bot','channels:read','im:read','im:write','groups:read','emoji:read']
    });

    controller.createOauthEndpoints(controller.webserver, function(err,req,res) {
      if (err) {
        res.status(err.status || 500);
        res.render('error', {
          message: err.message,
          error: {}
        });
      } else {
        res.render('success');
      }
    });
    // .createWebhookEndpoints(controller.webserver);

    controller.storage.teams.all(function(err, teams) {
      if (err) {
        throw new Error(err);
      }

      /* Connect all teams with bots up to slack */
      for (var t in teams) {
        if (teams[t].bot) {
          var bot = controller.spawn(teams[t]);
          this.setUpBot(bot);
        }
      }
    }.bind(this));

    this.attachEventListeners();
    this.attachConversationListeners();
  },

  attachEventListeners: function() {
    var { controller } = this;
    controller.on('create_team', function(team) {
      console.log(team);
      var bot = controller.spawn(team);
      this.setUpBot(bot);
    }.bind(this));

    controller.on('create_bot', function(bot,config) {
      if (!this.bots[bot.config.token]) {
        this.setUpBot(bot, true);
      }
    }.bind(this));

    controller.on('channel_created', function(bot,res) {
      if (res && res.channel) {
        bot.allChannels.push(res.channel);
      }
    });

    controller.on('channel_archive', function(bot,res) {
      for (var c in bot.allChannels) {
        if (bot.allChannels[c].id === res.channel) {
          bot.allChannels.splice(c, 1);
        }
      }

      for (var ch in bot.memberChannels) {
        if (bot.memberChannels[ch] === res.channel) {
          bot.memberChannels.splice(ch, 1);
        }
      }
    });

    controller.on('bot_channel_join', function(bot, res) {
      var bot_id = bot.config.bot.user_id;
      if (res.user === bot_id) {
        bot.memberChannels.push(res.channel);
      }
    });

    controller.on('channel_left', function(bot, res) {
      for (var ch in bot.memberChannels) {
        if (bot.memberChannels[ch] === res.channel) {
          bot.memberChannels.splice(ch, 1);
        }
      }
    });
  },

  attachConversationListeners: function() {
    var { controller } = this;

    controller.hears(['which channels(.*)'], 'ambient,direct_message,direct_mention,mention', function(bot, message) {
      var question = message.match[1];
      var type;

      if (question === ' are dead' || question === 'are dead?') {
        type = 'dead';
      } else if (question === ' are active' || question === 'are dead?') {
        type = 'daily';
      }

      if (type) {
        var { channelList, emptyListText } = historyConfig[type];

        bot[channelList] = [];
        getChannelActivity(bot, type, function(channel, isComplete) {
          if (channel) {
            bot[channelList].push(channel);
          }

          if (isComplete) {
            var text = emptyListText;
            if (bot[channelList].length) {
              text = formatBotText(bot, bot[channelList], type);
            }
            bot.reply(message, text);
          }
        });
      }
    });

    controller.hears(['who is lit'], 'ambient,direct_message,direct_mention,mention', function(bot, message) {
      bot.reply(message, 'firebot is pretty lit');
    });

    controller.hears(['am i lit'], 'ambient,direct_message,direct_mention,mention', function(bot, message) {
      bot.reply(message, 'nope');
    });

    controller.hears(['is (.*) lit', 'are (.*) lit'], 'ambient,direct_message,direct_mention,mention', function(bot, message) {
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
          }
        }

        for (var i = 0; i < bot.allUsers.length; i++) {
          if (bot.allUsers[i].id === channel || bot.allUsers[i].name === channel) {
            channel = bot.allUsers[i].name;
            text = responses.grabBag[Math.floor(Math.random() * responses.grabBag.length)];

            // TODO: allow teams to create customized responses
          }
        }

        if (bot.hourlyActivity[channel]) {
          text = 'yep';
        }

        bot.reply(message, text);
      }
    });
  },

  setUpBot: function(bot, isNew) {
    bot.startRTM(function(err, bot, payload) {
      if (bot) {
        bot.allUsers = [];
        bot.allChannels = [];
        bot.deadChannels = [];
        bot.hourlyActivity = {};
        bot.dailyActiveChannels = [];
        bot.recentActiveChannels = [];
        bot.memberChannels = [];

        if (payload) {
          if (payload.channels) {
            payload.channels.forEach(function(channel) {
              if (!channel.is_archived) {
                var bot_id = bot.config.bot.user_id;
                bot.allChannels.push(channel);
                if (channel.members && channel.members.indexOf(bot_id) > -1 && bot.memberChannels.indexOf(channel.id) < 0) {
                  bot.memberChannels.push(channel.id);
                }
              }
            });
          }

          if (payload.users) {
            bot.allUsers = payload.users;
          }
        }

        if (err === "account_inactive") {
          stop(bot);
        }

        if (!err) {
          this.trackBot(bot);
          bot.is_active = true;
          startInterval(bot);

          if (isNew) {
            bot.sendWebhook({
              text: `Thanks for adding Firebot! Invite <@${bot.config.bot.user_id}> to a channel so it can start posting about activity. We recommend having a dedicated channel for Firebot announcements.`,
              channel: bot.config.incoming_webhook.channel
            });
          }
        }
      }
    }.bind(this));
  }
};

/*
  BOT FUNCTIONS
*/

function stop(bot) {
  stopInterval(bot);
  bot.closeRTM();
  bot.is_active = false;
};

function restart(bot) {
  if (!bot.is_active) {
    setUpBot(bot);
  } else {
    console.log('Firebot is already active');
  }
};

function stopInterval(bot) {
  clearInterval(bot.checkInterval);
  bot.checkInterval = null;
};

function startInterval(bot) {
  /* Clears interval if it already exists */
  if (bot.checkInterval) {
    stopInterval(bot);
  }

  /* Checks level of activity every 10 minutes (600000ms)*/
  bot.checkInterval = setInterval( function () {
    bot.recentActiveChannels = [];

    getChannelActivity(bot, 'recent', function (channel, isLast) {
      if (channel) {
        bot.recentActiveChannels.push(channel);

        if (!bot.hourlyActivity[channel.name] || bot.hourlyActivity[channel.name] === 5) {
          bot.hourlyActivity[channel.name] = 1;
        } else {
          bot.hourlyActivity[channel.name] += 1;
        }
      }

      if (isLast) {
        /* Only announces channels that haven't been announced in the last half hour */
        var filteredChannels = [];
        for (var i = 0; i < bot.recentActiveChannels.length; i++) {
          if (bot.hourlyActivity[bot.recentActiveChannels[i].name] === 1) {
            filteredChannels.push(bot.recentActiveChannels[i]);
          }
        }

        /* If a channel wasn't active during the last tick, it resets the hourly count to 0 */
        Object.keys(bot.hourlyActivity).forEach(function(key) {
          if (!bot.recentActiveChannels.find(function(channel) { channel.name === key })) {
            var value = bot.hourlyActivity[key];
            bot.hourlyActivity[key] = value && value < 5 ? value + 1 : 0;
          }
        });

        if (filteredChannels.length) {
          var text = formatBotText(bot, filteredChannels, "lit");
          for (var c in bot.memberChannels) {
            bot.send({ text, channel: bot.memberChannels[c] });
          }
        }
      }
    });

  }, defaultInterval);
};

function getChannelList(bot, callback) {
  /* Slack API call to get list of channels */
  if (bot.allChannels && bot.allChannels.length) {
    callback(bot.allChannels);
  } else {
    bot.api.channels.list({ token: bot.config.bot.app_token }, function (err, res) {
      if (res && res.ok) {
        bot.allChannels = res.channels;
        callback(res.channels);
      }
    });
  }
};

function getChannelHistory(bot, channel, type, callback) {
  var { timeOffset, messageMinimum } = historyConfig[type];
  var oldestTime = (new Date().getTime() - timeOffset) / 1000;

  bot.api.channels.history({
    token: bot.config.bot.app_token,
    channel: channel.id,
    oldest: oldestTime,
    count: 50,
  }, function(err, res) {
    var isValid = res && res.ok && res.messages && ((!messageMinimum && !res.messages.length) || (messageMinimum && channelIsActive(res.messages, messageMinimum)));
    callback(isValid);
  });
};

function getChannelActivity(bot, type, callback) {
  /* Gets list of channels with more than X messages in the last day */

  getChannelList(bot, function (channels) {
    /*
      Only fetches the next channel's information once the previous one is fetched.
      A lot of nested callbacks. Cleaner way to do it?
    */
    var idx = 0;

    var loopArray = function(arr) {
      getChannelHistory(bot, channels[idx], type, function(isValid) {
        var isLast = idx === arr.length - 1;
        if (isValid) {
          callback(channels[idx], isLast);
        } else if (isLast) {
          callback(false, isLast);
        }

        idx++;

        if (idx < arr.length) {
          loopArray(arr);
        }
      });
    };

    if (channels) {
      loopArray(channels);
    }
  });
};

function channelIsDead(bot, channel) {
  return bot.deadChannels.find(function(ch) { return ch.id === channel.id });
};

function channelIsActive(messages, minimum) {
  var users = [];
  var messageCount = 0;

  for (var i = 0; i < messages.length; i++) {
    if (!messages[i].subtype || subtypeWhitelist.indexOf(messages[i].subtype) > -1) {
      messageCount++;
    }

    if (users.indexOf(messages[i].user) < 0) {
      users.push(messages[i].user);
    }
  }

  return messageCount > minimum && users.length > 1;
};

function formatMessage(text) {
  // TODO: use this to force bot message appearance
  return {
    text,
    username: 'firebot',
    icon_emoji: ':fire:'
  };
};

function formatBotText(bot, channelList, type) {
  var text = 'The ';
  var pastTense = type === 'daily' || type === 'revived';
  var channelName;

  for (var i = 0; i < channelList.length; i++) {
    channelName = formatChannelName(bot, channelList[i].name);
    if (channelList.length === 1) {
      text += `${channelName} channel ${pastTense ? 'was' : 'is'} `;
    } else if (i === channelList.length - 1) {
      text += ` and ${channelName} channels ${pastTense ? 'were' : 'are'} `;
    } else if (i === channelList.length - 2) {
      text += `${channelName}`;
    } else {
      text += `${channelName}, `;
    }
  }

  if (type === 'daily') {
    text += 'busy today.';
  } else if (type === 'revived') {
    text += 'revived!!!';
  } else if (type === 'dead') {
    text += 'pretty dead. No new posts in the last week.'
  } else {
    text += 'lit right now.';
  }

  return text;
};

function formatChannelName(bot, channelName) {
  if (bot.allChannels && bot.allChannels.length) {
    var chan = bot.allChannels.find(function(channel) {
      return channel.name === channelName;
    });

    if (chan) {
      return '<#' + chan.id + '|' + channelName + '>';
    }
  }

  return channelName;
};



module.exports = Firebot;
