/* Main Firebot functionality */


if (!process.env.clientId || !process.env.clientSecret || !process.env.port) {
  console.log('Error: Specify clientId clientSecret and port in environment');
  process.exit(1);
}

var Botkit = require('botkit');
var find = require('lodash/find');
var filter = require('lodash/filter');
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
    this.bots[bot.team_info.id] = bot;
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

  configureEventEndpoints: function() {
    var { controller } = this;
    const _this = this;

    controller.webserver.post('/slack/receive', function(req, res) {
      const { challenge, event } = req.body;
      if (challenge) {
        res.status(200);
        res.json({ challenge });
      } else if (event && event.type === 'message') {
        _this.handleReceiveMessage(req.body);
      }
    });
  },

  setUpController: function() {
    var { controller } = this;

    controller.configureSlackApp({
      clientId: process.env.clientId,
      clientSecret: process.env.clientSecret,
      redirectUri: hostName + '/oauth',
      rtm_receive_messages: false,
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

    this.configureEventEndpoints();

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
      if (!this.bots[bot.team_info.id]) {
        this.setUpBot(bot, true);
      }
    }.bind(this));

    controller.on('channel_created', function(bot,res) {
      if (res && res.channel) {
        bot.allChannels[res.channel.id] = res.channel;
      }
    });

    controller.on('channel_archive', function(bot, res) {
      if (bot.allChannels[res.channel]) {
        delete bot.allChannels[res.channel];
      }

      var memberChannelIndex = bot.memberChannels.indexOf(res.channel);
      if (memberChannelIndex > -1) {
        bot.memberChannels.splice(memberChannelIndex, 1);
      }
    });

    controller.on('bot_channel_join', function(bot, res) {
      var bot_id = bot.config.bot.user_id;
      if (res.user === bot_id) {
        bot.memberChannels.push(res.channel);
      }
    });

    controller.on('channel_left', function(bot, res) {
      var memberChannelIndex = bot.memberChannels.indexOf(res.channel);
      if (memberChannelIndex > -1) {
        bot.memberChannels.splice(memberChannelIndex, 1);
      }
    });

    controller.on('team_join', function(bot, res) {
      if (res) {
        bot.allUsers[res.user.id] = res.user;
      }
    });

    controller.on('user_change', function(bot, res) {
      if (res && res.user && res.user.deleted) {
        delete bot.allUsers[res.user.id];
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
      var channelId;

      if (channel) {
        var text = 'nope';

        if (channel[0] === '#') {
          channel = channel.slice(1);
        }

        if (channel[0] === '<') {
          var pipeIndex = channel.indexOf('|');
          if (pipeIndex > -1) {
            /* Gets a channel name from a mention */
            channelId = channel.slice(2, pipeIndex);
            channel = channel.slice(pipeIndex + 1, channel.length - 1);
          } else if (channel[1] === '@') {
            /* Gets a user name from a mention */
            channel = channel.slice(2, channel.length - 1);
          }
        }

        const user = bot.allUsers[channel] || find(bot.allUsers, { name: channel });

        if (user) {
          channel = user.name;
          text = responses.grabBag[Math.floor(Math.random() * responses.grabBag.length)];
          // TODO: allow teams to create customized responses
        }

        if (channel === 'firebot' || channel === bot.config.bot.name) {
          text = responses.positive[Math.floor(Math.random() * responses.positive.length)];
        }

        if (bot.hourlyActivity[channelId] || (bot.channelActivity[channelId] && bot.channelActivity[channelId].messages.length > 9)) {
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

  handleReceiveMessage: function(body) {
    const bot = this.bots[body.team_id];
    const message = body.event;
    if (!bot.channelActivity[message.channel]) {
      bot.channelActivity[message.channel] = { messages: [], users: []};
    }

    if (!message.subtype || subtypeWhitelist.indexOf(message.subtype) > -1) {
      let { messages, users } = bot.channelActivity[message.channel];

      if (messages.indexOf(body.event_id) < 0) {
        messages.push(body.event_id);

        const userId = message.user || message.bot_id;
        if (users.indexOf(userId) < 0) {
          users.push(userId);
        }
      }

      bot.channelActivity[message.channel] = { messages, users}
    }
  },

  setUpBot: function(bot, isNew) {
    bot.startRTM(function(err, bot, payload) {
      if (bot) {
        bot.allUsers = {};
        bot.allChannels = {};
        bot.deadChannels = [];
        bot.hourlyActivity = {};
        bot.dailyActiveChannels = [];
        bot.recentActiveChannels = [];
        bot.memberChannels = [];
        bot.channelActivity = {};

        if (payload) {
          normalizeChannels(bot, payload.channels || []);
          normalizeUsers(bot, payload.users || []);
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

    getChannelActivity(bot, 'recent', function (channelId, isLast) {
      if (channelId) {
        bot.recentActiveChannels.push(channelId);
        if (!bot.hourlyActivity[channelId] || bot.hourlyActivity[channelId] === 5) {
          bot.hourlyActivity[channelId] = 1;
        } else {
          bot.hourlyActivity[channelId] += 1;
        }
      }

      if (isLast) {
        /* Only announces channels that haven't been announced in the last half hour */
        var filteredChannels = filter(bot.recentActiveChannels, function(id) {
          return bot.hourlyActivity[id] === 1;
        });

        /* If a channel wasn't active during the last tick, it resets the hourly count to 0 */
        Object.keys(bot.hourlyActivity).forEach(function(key) {
          if (bot.recentActiveChannels.indexOf(key) > -1) {
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

function normalizeChannels(bot, channels = []) {
  channels.forEach(function(channel) {
    if (!channel.is_archived) {
      var botId = bot.config.bot.user_id;
      var isBotChannel = (
        channel.members &&
        channel.members.indexOf(botId) > -1 &&
        bot.memberChannels.indexOf(channel.id) < 0
      );

      bot.allChannels[channel.id] = channel;

      if (isBotChannel) {
        bot.memberChannels.push(channel.id);
      }
    }
  });
}

function normalizeUsers(bot, users = []) {
  for (var u in users) {
    var user = users[u];
    if (!user.deleted) {
      bot.allUsers[user.id] = user;
    }
  }
}

function getChannelList(bot, callback) {
  /* Slack API call to get list of channels */
  if (Object.keys(bot.allChannels || {}).length) {
    callback(bot.allChannels);
  } else {
    bot.api.channels.list({ token: bot.config.bot.app_token }, function (err, res) {
      if (res && res.ok) {
        normalizeChannels(bot, res.channels);
        callback(res.channels);
      }
    });
  }
};

function getChannelHistory(bot, channelId, type, callback) {
  var { timeOffset, messageMinimum } = historyConfig[type];
  var oldestTime = (new Date().getTime() - timeOffset) / 1000;
  var activity = bot.channelActivity[channelId];
  var isValid;

  if (type === 'recent' && activity) {
    /* Check the activity state if we can, fall back to the API call if we can't */
    isValid = activity.messages.length > messageMinimum && activity.users.length > 1;
    callback(isValid);
  } else {
    bot.api.channels.history({
      token: bot.config.bot.app_token,
      channel: channelId,
      oldest: oldestTime,
      count: 50,
    }, function(err, res) {
      isValid = res && res.ok && res.messages && ((!messageMinimum && !res.messages.length) || (messageMinimum && channelIsActive(res.messages, messageMinimum)));
      callback(isValid);
    });
  }
};

function getChannelActivity(bot, type, callback) {
  /* Gets list of channels with more than X messages in the last day */
  getChannelList(bot, function (channels = {}) {
    /*
      Only fetches the next channel's information once the previous one is fetched.
      A lot of nested callbacks. Cleaner way to do it?
    */
    var keys = Object.keys(channels);
    var idx = 0;

    var loopArray = function(arr) {
      getChannelHistory(bot, keys[idx], type, function(isValid) {
        var isLast = idx === arr.length - 1;
        if (isValid) {
          callback(keys[idx], isLast);
        } else if (isLast) {
          callback(false, isLast);
        }

        idx++;

        if (idx < arr.length) {
          loopArray(arr);
        }
      });
    };

    if (keys) {
      loopArray(keys);
    }
  });
};

function channelIsDead(bot, channel) {
  return bot.deadChannels.indexOf(channel.id) > -1;
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
    username: 'firebot',
    icon_url: iconUrl
  };
};

function formatBotText(bot, channelList, type) {
  var text = 'The ';
  var pastTense = type === 'daily' || type === 'revived';

  for (var i = 0; i < channelList.length; i++) {
    var channel = bot.allChannels[channelList[i]];
    var channelName = `<#${channel.id}|${channel.name}>`;

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



module.exports = Firebot;
