var subtypeWhitelist = ['file_comment', 'file_mention', 'file_share', 'message_replied', 'reply_broadcast'];
var negative = ['no', 'no.', 'nope', 'not at all', 'no, only hales', 'uh..', 'lol', 'sorry man', 'meh', 'nah', 'ha', 'never', 'definitely not'];
var positive = ['very much so', 'absolutely', 'def', 'ya'];
var indifferent =['fine', 'meh', 'sure', 'hm', 'no'];
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
  subtypeWhitelist,
  responses: { negative, positive, indifferent },
  peopleTypes: { good, bad, meh, custom },
};

module.exports = constants;
