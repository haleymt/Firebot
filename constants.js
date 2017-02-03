var subtypeWhitelist = ['file_comment', 'file_mention', 'file_share', 'message_replied', 'reply_broadcast'];
var negative = ['no', 'no.', 'nope', 'not at all', 'no, only hales', 'uh..', 'lol', 'sorry man', 'meh', 'nah', 'ha', 'never', 'definitely not'];
var positive = ['very much so', 'absolutely', 'def', 'ya'];
var indifferent =['fine', 'meh', 'sure', 'hm', 'no'];
var badPeople = [
  'shreeda',
  'freeshreeda',
  'curry.ove',
  'beiser',
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
  'gabe',
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

var constants = {
  subtypeWhitelist,
  responses: { negative, positive, indifferent },
  badPeople
};

module.exports = constants;
