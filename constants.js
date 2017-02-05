var hostname = process.env.port === '3000' ? 'localhost' : 'firebot-dev.us-west-2.elasticbeanstalk.com';

var subtypeWhitelist = ['file_comment', 'file_mention', 'file_share', 'message_replied', 'reply_broadcast'];
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

custom = {
  'sarah': 'they are a banana',
  'sarahsloth': 'they are a banana',
  'beiser': 'lol fuck off',
  'gabe': ':hankey:'
};

var constants = {
  hostname,
  subtypeWhitelist,
  responses: { negative, positive, indifferent, grabBag },
  peopleTypes: { good, bad, meh, custom },
};

module.exports = constants;
