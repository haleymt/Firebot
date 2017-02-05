/* Main Firebot functionality */


if (!process.env.clientId || !process.env.clientSecret || !process.env.port) {
  console.log('Error: Specify clientId clientSecret and port in environment');
  process.exit(1);
}

var Botkit = require('botkit');
var { subtypeWhitelist, responses, peopleTypes } = require('./constants');

var Firebot = {
  bots: {},

  trackBot: function(bot) {
    this.bots[bot.config.token] = bot;
  },

  run: function () {
    var controller = Botkit.slackbot({
      json_file_store: './db_firebot/',
      debug: true,
      retry: Infinity,
    });

    this.setUpController(controller);
  },

  setUpController: function(controller) {
    controller.configureSlackApp({
      clientId: process.env.clientId,
      clientSecret: process.env.clientSecret,
      redirectUri: 'http://localhost:3000/oauth',
      scopes: ['channels:history','incoming-webhook','team:read','users:read','chat:write:bot', 'bot','channels:read','im:read','im:write','groups:read','emoji:read']
    });

    controller.setupWebserver(process.env.port, function(err, webserver) {
      controller
        .createHomepageEndpoint(controller.webserver)
        .createOauthEndpoints(controller.webserver, function(err,req,res) {
          if (err) {
            res.status(500).send('ERROR: ' + err);
          } else {
            res.send('Success!');
          }
        })
        .createWebhookEndpoints(controller.webserver);
    });

    controller.storage.teams.all(function(err, teams) {

      if (err) {
        throw new Error(err);
      }

      // Connect all teams with bots up to slack
      for (var t in teams) {
        if (teams[t].bot) {
          var bot = controller.spawn(teams[t]);
          this.setUpBot(bot);
        }
      }
    }.bind(this));

    this.attachListeners(controller);
    this.controller = controller;
  },

  attachListeners: function(controller) {
    controller.on('create_team', function(team) {
      var bot = controller.spawn(team);
      this.setUpBot(bot);
    }.bind(this));

    controller.on('create_bot', function(bot,config) {
      if (!this.bots[bot.config.token]) {
        this.setUpBot(bot, true);
      }
    }.bind(this));

    controller.hears(['which channels(.*)'], 'ambient,direct_message,direct_mention,mention', function(bot, message) {
      var question = message.match[1];

      if (question === ' are dead') {
        bot.deadChannels = [];

        this.getChannelActivity(bot, 'dead', function(channel, isLast) {
          if (channel) {
            bot.deadChannels.push(channel);
          }

          if (isLast) {
            var deadText = "No dead channels right now.";
            if (bot.deadChannels.length) {
              deadText = this.formatBotText(bot, bot.deadChannels, "dead");
            }
            bot.reply(message, deadText);
          }
        }.bind(this));
      } else {
        bot.dailyActiveChannels = [];

        this.getChannelActivity(bot, 'daily', function (channel, isLast) {
          if (channel) {
            bot.dailyActiveChannels.push(channel);
          }

          if (isLast) {
            var text = "No channels have been busy lately.";
            if (bot.dailyActiveChannels.length) {
              text = this.formatBotText(bot, bot.dailyActiveChannels, "daily");
            } 
            bot.reply(message, text);
          }
        }.bind(this));
      }
    }.bind(this));

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
            if (!bot.allUsers) {
              bot.allUsers = [];
            }

            channel = channel.slice(2, channel.length - 1);
            for (var i = 0; i < bot.allUsers.length; i++) {
              if (bot.allUsers[i].id === channel) {
                channel = bot.allUsers[i].name;
              }
            }
          }
        }

        if (peopleTypes.custom[channel]) {
          text = peopleTypes.custom[channel];
        } else if (peopleTypes.good.indexOf(channel) > -1) {
          text = responses.positive[Math.floor(Math.random() * responses.positive.length)];
        } else if (peopleTypes.meh.indexOf(channel) > -1) {
          text = responses.indifferent[Math.floor(Math.random() * responses.indifferent.length)];
        } else if (peopleTypes.bad.indexOf(channel) > -1) {
          text = responses.negative[Math.floor(Math.random() * responses.negative.length)];
        }

        if (bot.hourlyActivity[channel]) {
          var text = channel === 'politics' ? 'no, but yes' : 'yep';
        }

        bot.reply(message, text);
      }
    }.bind(this));
  },

  setUpBot: function (bot, isNew) {
    bot.startRTM(function(err, bot, payload) {
      if (bot) {
        bot.allUsers = [];
        bot.allChannels = [];
        bot.deadChannels = [];
        bot.hourlyActivity = {};
        bot.dailyActiveChannels = [];
        bot.recentActiveChannels = [];

        if (payload) {
          if (payload.channels) {
            payload.channels.forEach(function(channel) {
              if (!channel.is_archived) {
                bot.allChannels.push(channel);
              }
            }.bind(this));
          }

          if (payload.users) {
            bot.allUsers = payload.users;
          }
        }

        if (err === "account_inactive") {
          bot.closeRTM();
          bot.destroy();
        }

        if (!err) {
          this.trackBot(bot);
          this.startInterval(bot);
          if (isNew) {
            bot.sendWebhook({text: `Thanks for adding Firebot! Invite <@${bot.config.bot.user_id}> to a channel so I can start posting about activity`, channel: bot.config.incoming_webhook.channel });
          }
        }
      }
    }.bind(this));
  },

  startInterval: function (bot) {
    /* Clears interval if it already exists */
    if (bot.checkInterval) {
      clearInterval(bot.checkInterval);
      bot.checkInterval = null;
    }

    /* Checks level of activity every 10 minutes (600000ms)*/
    var _this = this;
    bot.checkInterval = setInterval( function () {
      bot.recentActiveChannels = [];

      _this.getChannelActivity(bot, 'recent', function (channel, isLast) {
        if (channel) {
          bot.recentActiveChannels.push(channel);

          if (!bot.hourlyActivity[channel.name] || bot.hourlyActivity[channel.name] === 5) {
            bot.hourlyActivity[channel.name] = 1;
          } else {
            bot.hourlyActivity[channel.name] += 1;
          }
        }

        if (isLast) {
          /* Only announces channels that haven't been announced in the last hour */
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
            var text = _this.formatBotText(bot, filteredChannels, "lit");
            bot.send({ text, channel: bot.config.incoming_webhook.channel });
          }
        }
      }.bind(_this));

    }, 600000);
  },

  getChannelList: function(bot, callback) {
    /* Slack API call to get list of channels */
    if (bot.allChannels && bot.allChannels.length) {
      callback(bot.allChannels);
    } else {
      bot.api.channels.list({ token: bot.config.bot.app_token }, function (err, res) {
        if (res && res.ok) {
          bot.allChannels = res.channels;
          callback(res.channels);
        }
      }.bind(this));
    }
  },

  getChannelHistory: function(bot, channel, isLast, type, callback) {
    /* milliseconds in a day === 86400000 */
    /* milliseconds in 15 minutes === 900000 */

    var offset = type === 'daily' ? 86400000 : type === 'dead' ? 86400000 * 7 : 900000;
    var oldestTime = (new Date().getTime() - offset) / 1000;
    var messageMinimum = type === 'daily' ? 19 : type === 'dead' ? null : 9;

    bot.api.channels.history({
      token: bot.config.bot.app_token,
      channel: channel.id,
      oldest: oldestTime,
      count: 50,
    }, function(err, res) {
      if (res && res.ok && res.messages && ((!messageMinimum && !res.messages.length) || (messageMinimum && this.channelIsActive(res.messages, messageMinimum)))) {
        callback(channel, isLast);
      } else if (isLast) {
        callback(false, isLast)
      }
    }.bind(this));
  },

  getChannelActivity: function(bot, type, callback) {
    /* Gets list of channels with more than X messages in the last day */

    this.getChannelList(bot, function (channels) {
      if (channels) {
        for (var i = 0; i < channels.length; i++) {
          var isLast = i === channels.length - 1;
          this.getChannelHistory(bot, channels[i], isLast, type, callback);
        }
      }
    }.bind(this));
  },

  channelIsDead: function (bot, channel) {
    return bot.deadChannels.find(function(ch) { return ch.id === channel.id });
  },

  channelIsActive: function (messages, minimum) {
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
  },

  formatBotText: function (bot, channelList, type) {
    var text = 'The ';
    var pastTense = type === 'daily' || type === 'revived';
    var channelName;

    for (var i = 0; i < channelList.length; i++) {
      channelName = this.formatChannelName(bot, channelList[i].name);
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
  },

  formatChannelName: function(bot, channelName) {
    if (bot.allChannels && bot.allChannels.length) {
      var chan = bot.allChannels.find(function(channel) {
        return channel.name === channelName;
      });

      if (chan) {
        return '<#' + chan.id + '|' + channelName + '>';
      }
    }

    return channelName;
  }
};

module.exports = Firebot;
