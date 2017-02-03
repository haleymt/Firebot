/* Main Firebot functionality */

if (!process.env.token) {
    console.log('Error: Specify token in environment');
    process.exit(1);
}

var Botkit = require('botkit');
var { subtypeWhitelist, responses, peopleTypes } = require('./constants');

var Firebot = {
  allUsers: [],
  allChannels: [],
  deadChannels: [],
  dailyActiveChannels: [],
  recentActiveChannels: [],
  hourlyActivity: {},

  run: function () {
    var controller = Botkit.slackbot({
        debug: true,
        retry: Infinity,
    });

    this.attachListeners(controller);

    this.bot = controller.spawn({
        token: process.env.token
    }).startRTM(function(err, bot, payload) {
      if (payload) {
        this.setUpBot(payload);
      }
      this.startInterval();
    }.bind(this));
  },

  attachListeners: function(controller) {
    controller.hears(['which channels(.*)'], 'ambient,direct_message,direct_mention,mention', function(bot, message) {
      var question = message.match[1];

      if (question === ' are dead') {
        this.deadChannels = [];

        this.getDeadChannels(function(channel, isLast) {
          if (channel) {
            this.deadChannels.push(channel);
          }

          if (isLast) {
            var deadText;
            if (this.deadChannels.length) {
              deadText = this.formatBotText(this.deadChannels, "dead");
            } else {
              deadText = "No dead channels right now."
            }
            bot.reply(message, deadText);
          }
        }.bind(this));
      } else {
        this.dailyActiveChannels = [];

        this.getActivity(true, function (channel, isLast) {
          if (channel) {
            this.dailyActiveChannels.push(channel);
          }

          if (isLast) {
            var text;
            if (this.dailyActiveChannels.length) {
              text = this.formatBotText(this.dailyActiveChannels, "daily");
            } else {
              text = "No channels have been busy lately."
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
            if (!this.allUsers) {
              this.allUsers = [];
            }

            channel = channel.slice(2, channel.length - 1);
            for (var i = 0; i < this.allUsers.length; i++) {
              if (this.allUsers[i].id === channel) {
                channel = this.allUsers[i].name;
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

        if (this.hourlyActivity[channel]) {
          var text = channel === 'politics' ? 'no, but yes' : 'yep';
        }

        bot.reply(message, text);
      }
    }.bind(this));


    this.controller = controller;
  },

  setUpBot: function (payload) {
    if (payload) {
      if (payload.channels) {
        payload.channels.forEach(function(channel) {
          if (!channel.is_archived) {
            this.allChannels.push(channel);
          }
        }.bind(this));
      }

      if (payload.users) {
        this.allUsers = payload.users;
      }
    }
  },

  startInterval: function () {
    /* Clears interval if it already exists */
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    /* Checks level of activity every 10 minutes (600000ms)*/
    var _this = this;
    _this.checkInterval = setInterval( function () {
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
            var text = _this.formatBotText(filteredChannels, "lit");
            _this.send({text: text, channel: "#isitlit"});
          }
        }
      });

    }, 600000);
  },

  getChannelList: function(callback) {
    /* Slack API call to get list of channels */
    var _this = this;
    if (this.allChannels && this.allChannels.length) {
      callback(this.allChannels);
    } else {
      this.bot.api.channels.list({ token: this.bot.token }, function (err, res) {
        if (res && res.ok) {
          _this.allChannels = res.channels;
          callback(res.channels);
        }
      });
    }
  },

  getChannelHistory: function(channel, isLast, daily, callback) {
    /* milliseconds in a day === 86400000 */
    /* milliseconds in 15 minutes === 900000 */
    var offset = daily ? 86400000 : 900000;
    var messageMinimum = daily ? 19 : 9;
    var oldestTime = (new Date().getTime() - offset) / 1000;

    this.bot.api.channels.history({
      token: this.bot.token,
      channel: channel.id,
      oldest: oldestTime,
      count: 50,
    }, function(err, res) {
      if (res && res.ok && res.messages && this.channelIsActive(res.messages, messageMinimum)) {
        callback(channel, isLast);
      } else if (isLast) {
        callback(false, isLast)
      }
    }.bind(this));
  },

  getDeadChannelHistory: function (channel, isLast, callback) {
    var weekAgo = (new Date().getTime() - (86400000 * 7)) / 1000;

    this.bot.api.channels.history({
      token: this.bot.token,
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
  },

  getActivity: function(daily, callback) {
    /* Gets list of channels with more than X messages in the last day */

    this.getChannelList(function (channels) {
      if (channels) {
        for (var i = 0; i < channels.length; i++) {
          var isLast = i === channels.length - 1;
          this.getChannelHistory(channels[i], isLast, daily, callback);
        }
      }
    }.bind(this));
  },

  getDeadChannels: function(callback) {
    this.getChannelList(function (channels) {
      if (channels) {
        for (var i = 0; i < channels.length; i++) {
          var isLast = i === channels.length - 1;
          this.getDeadChannelHistory(channels[i], isLast, callback);
        }
      }
    }.bind(this));
  },

  checkForChannelRevival: function (channel) {
    return this.deadChannels.find(function(ch) { return ch.id === channel.id });
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

  formatBotText: function (channelList, type) {
    var text = 'The ';
    var channelName;

    if (type === 'daily' || type === 'revived') {
      for (var i = 0; i < channelList.length; i++) {
        channelName = this.getChannelText(channelList[i].name);
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
        channelName = this.getChannelText(channelList[i].name);
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
  },

  getChannelText: function(channelName) {
    if (this.allChannels && this.allChannels.length) {
      var chan = this.allChannels.find(function(channel) {
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
