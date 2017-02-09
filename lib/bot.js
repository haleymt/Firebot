/* BOT */

var Bot = function(options) {
  this.controller = options.controller;
  this.allUsers = [];
  this.allChannels = [];
  this.deadChannels = [];
  this.hourlyActivity = {};
  this.dailyActiveChannels = [];
  this.recentActiveChannels = [];
  this.memberChannels = [];

}

Bot.prototype = {

};

module.exports = Bot;
