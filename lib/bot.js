/* EXPERIMENTAL BOT MODULE */

/*
  Ideally can be shared between both the App and the CI versions of Firebot
*/

var { subtypeWhitelist, iconUrl } = require('./constants');

var Bot = function(options) {
  this = options.bot;
  this.controller = options.controller;
  this.token = options.bot.config.bot.app_token;
  this.botId = options.bot.config.bot.user_id;
  this.isNew = options.isNew;
  this.allUsers = [];
  this.allChannels = [];
  this.deadChannels = [];
  this.hourlyActivity = {};
  this.dailyActiveChannels = [];
  this.recentActiveChannels = [];
  this.memberChannels = [];
  this.is_active = false;

  this.setUpBot();
};

Bot.prototype = {
  setUpBot: function() {
    this.startRTM(function(err, bot, payload) {
      if (bot) {
        this.allUsers = [];
        this.allChannels = [];
        this.deadChannels = [];
        this.hourlyActivity = {};
        this.dailyActiveChannels = [];
        this.recentActiveChannels = [];
        this.memberChannels = [];

        if (payload) {
          if (payload.channels) {
            this.setUpChannels(payload.channels);
          }

          if (payload.users) {
            this.setUpUsers(payload.users);
          }
        }

        if (err === "account_inactive") {
          this.stop();
        }

        if (!err) {
          this.controller.trackBot(this);
          this.is_active = true;
          this.startInterval();

          if (this.isNew) {
            this.isNew = false;
            this.sendWebhook({
              text: `Thanks for adding Firebot! Invite <@${bot.config.bot.user_id}> to a channel so it can start posting about activity. We recommend having a dedicated channel for Firebot announcements.`,
              channel: this.config.incoming_webhook.channel
            });
          }
        }
      }
    }.bind(this));
  },

  setUpChannels: function(channels) {
    channels.forEach(function(channel) {
      if (!channel.is_archived) {
        this.allChannels.push(channel);
        if (channel.members && channel.members.indexOf(this.botId) > -1 && bot.memberChannels.indexOf(channel.id) < 0) {
          this.memberChannels.push(channel.id);
        }
      }
    });
  },

  setUpUsers: function(users) {
    this.allUsers = [];
    for (var u in users) {
      var user = users[u];
      if (!user.deleted) {
        this.allUsers.push(user);
      }
    }
  },

  stop: function() {
    this.stopInterval();
    this.closeRTM();
    this.isActive = false;
  },

  restart: function() {
    if (!this.is_active) {
      this.setUpBot();
    } else {
      console.log('Firebot is already active');
    }
  },

  stopInterval: function() {
    clearInterval(this.checkInterval);
    this.checkInterval = null;
  },

  startInterval: function() {
    /* Clears interval if it already exists */
    if (this.checkInterval) {
      this.stopInterval();
    }

    /* Checks level of activity every 10 minutes (600000ms)*/
    var _this = this;
    this.checkInterval = setInterval( function () {
      _this.recentActiveChannels = [];

      getChannelActivity(bot, 'recent', function (channel, isLast) {
        if (channel) {
          _this.recentActiveChannels.push(channel);

          if (!_this.hourlyActivity[channel.name] || _this.hourlyActivity[channel.name] === 5) {
            _this.hourlyActivity[channel.name] = 1;
          } else {
            _this.hourlyActivity[channel.name] += 1;
          }
        }

        if (isLast) {
          /* Only announces channels that haven't been announced in the last half hour */
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
            var text = _this.formatMessage(filteredChannels, "lit");
            for (var c in _this.memberChannels) {
              text = Object.assign(text, { channel: _this.memberChannels[c] });
              _this.send(text);
            }
          }
        }
      });

    }, defaultInterval);
  },

  getChannelList: function(callback) {
    /* Slack API call to get list of channels */
    if (this.allChannels && this.allChannels.length) {
      callback(this.allChannels);
    } else {
      this.api.channels.list({ token: this.token }, function (err, res) {
        if (res && res.ok) {
          this.setUpChannels(res.channels);
          callback(res.channels);
        }
      }.bind(this));
    }
  },

  getChannelHistory: function(channel, type, callback) {
    var { timeOffset, messageMinimum } = historyConfig[type];
    var oldestTime = (new Date().getTime() - timeOffset) / 1000;

    this.api.channels.history({
      token: this.token,
      channel: channel.id,
      oldest: oldestTime,
      count: 50,
    }, function(err, res) {
      var isValid = res && res.ok && res.messages && ((!messageMinimum && !res.messages.length) || (messageMinimum && this.channelIsActive(res.messages, messageMinimum)));
      callback(isValid);
    }.bind(this));
  },

  getChannelActivity: function(type, callback) {
    /* Gets list of channels with more than X messages in the last day */

    this.getChannelList(function (channels) {
      /*
        Only fetches the next channel's information once the previous one is fetched.
        A lot of nested callbacks. Cleaner way to do it?
      */
      var idx = 0;

      var loopArray = function(arr) {
        this.getChannelHistory(bot, channels[idx], type, function(isValid) {
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
      }.bind(this);

      if (channels) {
        loopArray(channels);
      }
    }.bind(this));
  },

  channelIsDead: function(channel) {
    return this.deadChannels.find(function(ch) { return ch.id === channel.id });
  },

  channelIsActive: function(messages, minimum) {
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
  },

  sendMessage: function(text) {
    this.send(this.formatMessage(text));
  },

  sendReply: function(message, channelList, type) {
    this.reply(message, this.formatMessage(channelList, type));
  },

  formatMessage: function(channelList, type) {
    /* Use this to force bot message appearance */
    var text;
    if (typeof channelList === 'string'){
      text = channelList;
    } else {
      text = this.formatBotText(channelList, type);
    }

    return {
      text,
      username: 'firebot',
      icon_url: iconUrl
    };
  },

  formatBotText: function(channelList, type) {
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

  formatChannelName: function(channelName) {
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

module.exports = Bot;
