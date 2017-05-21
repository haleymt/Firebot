/* Main Firebot functionality */


if (!process.env.clientId || !process.env.clientSecret || !process.env.port) {
  console.log('Error: Specify clientId clientSecret and port in environment');
  process.exit(1);
}

var Bot = require('./bot');
var Botkit = require('botkit');
var router = require('../routes/index');
var {
  responses,
  hostName,
  historyConfig,
  isProduction,
} = require('./constants');

var Firebot = {
  bots: {},

  trackBot: function(bot) {
    this.bots[bot.bot_token] = bot;
  },

  configureBot: function(bot, isNew) {
    bot = Object.assign(bot, new Bot({ bot, isNew }));

    bot.setUpBot( function() {
      this.trackBot(bot);
    }.bind(this));
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
      scopes: ['incoming-webhook','team:read','users:read','channels:read', 'channels:history', 'chat:write:bot', 'bot']
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

    controller.storage.teams.all(function(err, teams) {
      if (err) {
        throw new Error(err);
      }

      /* Connect all teams with bots up to slack */
      for (var t in teams) {
        console.log(t);
        if (teams[t].bot) {
          this.configureBot(controller.spawn(teams[t]));
        }
      }
    }.bind(this));

    this.attachEventListeners();
    this.attachConversationListeners();
  },

  attachEventListeners: function() {
    var { controller } = this;
    controller.on('create_team', function(team) {
      this.configureBot(controller.spawn(teams[t]));
    }.bind(this));

    controller.on('create_bot', function(bot,config) {
      if (!this.bots[bot.config.token]) {
        this.configureBot(controller.spawn(teams[t]), true);
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

      if (question === ' are dead' || question === 'are dead?') {
        type = 'dead';
      } else if (question === ' are active' || question === 'are dead?') {
        type = 'daily';
      }

      if (type) {
        var { channelList, emptyListText } = historyConfig[type];

        bot[channelList] = [];
        bot.getChannelActivity(bot, type, function(channel, isComplete) {
          if (channel) {
            bot[channelList].push(channel);
          }

          if (isComplete) {
            var text;
            if (bot[channelList].length) {
              bot.sendReply(message, bot[channelList], type);
            } else {
              bot.sendReply(message, emptyListText);
            }
          }
        });
      }
    });

    controller.hears(['who is lit', 'who is lit?'], 'ambient,direct_message,direct_mention,mention', function(bot, message) {
      console.log(bot);
      // bot.reply(message, 'firebot is pretty lit');
      bot.sendReply(message, 'firebot is pretty lit');
    });

    controller.hears(['am i lit'], 'ambient,direct_message,direct_mention,mention', function(bot, message) {
      bot.sendReply(message, 'nope');
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

        bot.sendReply(message, text);
      }
    });

    controller.hears(['help'], 'direct_message,direct_mention,mention', function(bot, message) {
      bot.startConversation(message, function(response, convo) {
        convo.ask(bot.formatMessage("Did you have a question? If you'd like to see the list of questions you can ask Firebot, reply to this message with *yes*. If you'd like to contact Firebot support, send an email to firebot.help@gmail.com. See fervidbot.com for an FAQ."), function(response, convo) {
          if (response.text === 'yes') {
            convo.say(bot.formatMessage("You can ask Firebot the following things:\n1. *Which channels are active?* will return a list of channels that have had at least 20 messages made by at least 2 people in the last day.\n2. *Which channels are dead?* will return a list of channels that have not had any new messages in the last week.\n3. *Is #channel_name lit?* will return a positive response if the channel has had at least 10 new messages made by at least 2 people in the last 15 minutes.\n4.*@firebot help* will pull up this help chat again."));
          } else if (response.text === 'no' || response.text === 'n' || response.text === 'nevermind') {
            convo.say(bot.formatMessage("No worries. Goodbye!"));
          }
          convo.next();
        });
      });
    });
  }
};



module.exports = Firebot;
