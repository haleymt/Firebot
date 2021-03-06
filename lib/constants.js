
/* Get environment */
var isProduction = process.env.NODE_ENV === 'production';
var isDevProduction = process.env.NODE_ENV === 'testproduction';


/* Development vs production hostname */
var hostName = isProduction ? 'https://fervidbot.com' : isDevProduction ? 'https://dev.fervidbot.com' : 'http://localhost:' + process.env.port;

/* Icon for the bot */
var iconUrl = '/images/fireEmoji_small.png';


/*
  List of message subtypes that count as 'real messages' for measuring activity.
  Default messages do not have a subtype.
*/
var subtypeWhitelist = [
  'file_comment',
  'file_mention',
  'file_share',
  'message_replied',
  'reply_broadcast',
  'bot_message'
];


/* Default firebot responses by type */
var negative = ['no', 'no.', 'nope', 'not at all', 'uh..', 'lol', 'sorry man', 'meh', 'nah', 'ha', 'never', 'definitely not'];
var positive = ['very much so', 'absolutely', 'def', 'ya'];
var indifferent =['fine', 'meh', 'sure', 'hm'];
var grabBag = negative.concat(positive).concat(indifferent);


/*
  Defines the settings for each of the different types of channel history API calls.
  Milliseconds in a day: 86400000
  Milliseconds in 15 minutes: 900000
*/

var historyConfig = {
  'daily': {
    timeOffset: 86400000,
    messageMinimum: 19,
    channelList: 'dailyActiveChannels',
    emptyListText: 'No channels have been busy lately.',
  },
  'recent': {
    timeOffset: 600000,
    messageMinimum: 9,
    channelList: 'recentActiveChannels',
    emptyListText: 'No lit channels right now.',
  },
  'dead': {
    timeOffset: 86400000 * 7,
    messageMinimum: null,
    channelList: 'deadChannels',
    emptyListText: 'No dead channels right now.',
  }
};

/*
  Defines the default interval for how often firebot should detect activity
  Milliseconds in 10 minutes: 600000
*/

var defaultInterval = 600000;

var constants = {
  isProduction,
  historyConfig,
  hostName,
  iconUrl,
  subtypeWhitelist,
  defaultInterval,
  responses: { negative, positive, indifferent, grabBag },
};

module.exports = constants;
