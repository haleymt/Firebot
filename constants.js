/* Development vs production hostname */
var hostName = process.env.IS_DEV ? 'http://localhost:' + process.env.port : 'http://firebot-dev.us-west-2.elasticbeanstalk.com';

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


var good = ['hales', 'haley', 'firebot'];
var meh = ['rev', 'st_rev'];
var bad = [
  'shreeda',
  'freeshreeda',
  'curry.ove',
  'voidfraction',
  'akira',
  'sol',
  'tao',
  'turrible_tao',
  'jamesmcn',
  'ksim',
  'jsf',
  'ema',
  'othercriteria',
  'cwage',
  'alt',
  'meaningness',
  'andrew',
  'asquidislove',
  'ctrl',
  'black_dwarf',
  'blue_traveler',
  'byrne',
  'pamela',
  'bookoftamara',
  'chamber_of_heart',
  'cobuddha',
  'contemplationist',
  'drethelin',
  'grumplessgrinch',
  'joelgrus',
  'julespitt',
  'keffie',
  'mattsimpson',
  'niftierideology',
  'simplicio',
  'suchaone',
  'svigalae',
  'the_langrangian',
  'tipsycaek'
];

var custom = {
  'sarah': 'they are a banana',
  'sarahsloth': 'they are a banana',
  'beiser': 'lol fuck off',
  'gabe': ':hankey:'
};

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
    emptyListText: 'No channels have been busy lately',
  },
  'recent': {
    timeOffset: 900000,
    messageMinimum: 9,
    channelList: 'recentActiveChannels'
  },
  'dead': {
    timeOffset: 86400000 * 7,
    messageMinimum: null,
    channelList: 'deadChannels',
    emptyListText: 'No dead channels right now',
  },
};

/*
  Defines the default interval for how often firebot should detect activity
  Milliseconds in 10 minutes: 600000
*/

var defaultInterval = 600000;

var constants = {
  historyConfig,
  hostName,
  subtypeWhitelist,
  defaultInterval,
  responses: { negative, positive, indifferent, grabBag },
  peopleTypes: { good, bad, meh, custom },
};

module.exports = constants;
