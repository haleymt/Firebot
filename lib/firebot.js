/* Main Firebot functionality */


if (!process.env.clientId || !process.env.clientSecret || !process.env.port) {
  console.log('Error: Specify clientId clientSecret and port in environment');
  process.exit(1);
}

var Botkit = require('botkit');
var router = require('../routes/index');
var {
  subtypeWhitelist,
  responses,
  hostName,
  historyConfig,
  defaultInterval,
  isProduction,
  iconUrl
} = require('./constants');

var Firebot = {
  bots: {},

  trackBot: function(bot) {
    this.bots[bot.config.token] = bot;
  },

  run: function (firebase_store) {
    /* Use Firebase only in production */
    var controllerConfig = {
      debug: !isProduction,
      retry: Infinity
    };

    if (!process.env.NODE_ENV === 'development') {
      /* Use a simple json file store in development */
      controllerConfig.json_file_store = './db_firebot';
    } else {
      controllerConfig.storage = firebase_store;
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
      scopes: ['incoming-webhook', 'channels:history','bot']
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

    controller.on('team_join', function(bot, res) {
      if (res) {
        bot.allUsers.push(res.user);
      }
    });

    controller.on('user_change', function(bot, res) {
      if (res) {
        var user = res.user;
        if (user.deleted) {
          for (var u in bot.allUsers) {
            if (bot.allUsers[u].id === user.id) {
              bot.allUsers.splice(u, 1);
            }
          }
        }
      }
    });
  },

  attachConversationListeners: function() {
    var { controller } = this;

    controller.hears(['which channels(.*)'], 'ambient,direct_message,direct_mention,mention', function(bot, message) {
      var question = message.match[1];
      var type;

      if (question === ' are dead' || question === ' are dead?') {
        type = 'dead';
      } else if (question === ' are active' || question === ' are active?') {
        type = 'daily';
      } else if (question === ' are lit' || question === ' are lit?') {
        type = 'recent';
      }

      if (type) {
        var { channelList, emptyListText } = historyConfig[type];
        if (type === 'recent') {
          var text;
          if (bot[channelList].length) {
            text = formatMessage(bot, bot[channelList], type);
          } else {
            text = formatMessage(emptyListText);
          }

          bot.reply(message, text);
        } else {
          bot[channelList] = [];
          getChannelActivity(bot, type, function(channel, isComplete) {
            if (channel) {
              bot[channelList].push(channel);
            }

            if (isComplete) {
              var text;
              if (bot[channelList].length) {
                text = formatMessage(bot, bot[channelList], type);
              } else {
                text = formatMessage(emptyListText);
              }
              bot.reply(message, text);
            }
          });
        }
      }
    });

    controller.hears(['who is lit', 'who is lit?'], 'ambient,direct_message,direct_mention,mention', function(bot, message) {
      bot.reply(message, formatMessage('firebot is pretty lit'));
    });

    controller.hears(['am i lit'], 'ambient,direct_message,direct_mention,mention', function(bot, message) {
      bot.reply(message, formatMessage('nope'));
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

        if (channel === 'firebot' || channel === bot.config.bot.name) {
          text = responses.positive[Math.floor(Math.random() * responses.positive.length)];
        }

        if (bot.hourlyActivity[channel]) {
          text = 'yep';
        }

        bot.reply(message, formatMessage(text));
      }
    });

    controller.hears(['help'], 'direct_message,direct_mention,mention', function(bot, message) {
      bot.startConversation(message, function(response, convo) {
        convo.ask(formatMessage("Did you have a question? If you'd like to see the list of questions you can ask Firebot, reply to this message with *yes*. If you'd like to contact Firebot support, send an email to firebot.help@gmail.com. See fervidbot.com for an FAQ."), function(response, convo) {
          if (response.text === 'yes') {
            convo.say(formatMessage("You can ask Firebot the following things:\n1. *Which channels are lit?* will return a list of channels that have had at least 10 new messages by at least 2 people in the last 15 minutes.\n2. *Which channels are active?* will return a list of channels that have had at least 20 messages made by at least 2 people in the last 24 hours.\n3. *Which channels are dead?* will return a list of channels that have not had any new messages in the last week.\n4. *Is #channel_name lit?* will return a positive response if the channel has had at least 10 new messages made by at least 2 people in the last 15 minutes.\n5. *@firebot help* will pull up this help chat again."));
          } else if (response.text === 'no' || response.text === 'n' || response.text === 'nevermind') {
            convo.say(formatMessage("No worries. Goodbye!"));
          }
          convo.next();
        });
      });
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
            for (var u in payload.users) {
              var user = payload.users[u];
              if (!user.deleted) {
                bot.allUsers.push(user);
              }
            }
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
            bot.hourlyActivity[key] = (value && value < 5 ? value + 1 : 0);
          }
        }.bind(bot));

        if (filteredChannels.length) {
          var text = formatMessage(bot, filteredChannels, "lit");
          for (var c in bot.memberChannels) {
            text = Object.assign(text, { channel: bot.memberChannels[c] });
            bot.send(text);
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

function formatMessage(bot, channelList, type) {
  /* Use this to force bot message appearance */
  var text;
  if (typeof bot === 'string'){
    text = bot;
  } else {
    text = formatBotText(bot, channelList, type);
  }

  return {
    text,
    username: 'firebot-dev',
    icon_url: iconUrl
  };
};

function formatBotText(bot, channelList, type) {
  var text = 'The ';
  var pastTense = type === 'daily' || type === 'revived';
  var channelName;

  for (var i = 0; i < channelList.length; i++) {
    channelName = channelList[i].name ? channelList[i].name : channelList[i];
    channelName = formatChannelName(bot, channelName);
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
