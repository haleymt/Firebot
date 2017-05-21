var firebase = require('firebase');

var FirebaseStore = function() {
  this.database = {};
};

FirebaseStore.prototype.config = function(cb) {
  var {
    apiKey_FB,
    authDomain_FB,
    databaseURL_FB,
    storageBucket_FB,
    messagingSenderId_FB
  } = process.env;

  firebase.initializeApp({
    apiKey: apiKey_FB,
    authDomain: authDomain_FB,
    databaseURL: databaseURL_FB,
    storageBucket: storageBucket_FB,
    messagingSenderId: messagingSenderId_FB
  });

  this.database = firebase.database();
  cb(this.getStore());
};


FirebaseStore.prototype.getStore = function() {
  var _this = this;
  function get_item(type, itemId, cb) {
    _this.database.ref(type + '/' + itemId).once('value').then(
      function(snapshot) {
        cb(null, snapshot.val());
      }
    );
  };

  function save_item(type, item, cb) {
    if (item.id) {
      _this.database.ref(type + '/' + item.id).set(item);
      cb(null, item);
    } else {
      cb('No ID specified');
    }
  };

  function delete_item(type, itemId, cb) {
    _this.database.ref(type + '/' + itemId).remove();
    cb(null, itemId);
  };

  function all_items(type, cb) {
    _this.database.ref(type).once('value').then(
      function(snapshot) {
        var items = snapshot.val() || [];
        cb(null, items);
      }, (err) => { console.log(err) }
    );
  };

  return {
    users: {
      save: function (user, cb) {
        return save_item('users', user, cb);
      },

      get: function (userId, cb) {
        return get_item('users', userId, cb);
      },

      delete: function (userId, cb) {
        return delete_item('users', userId, cb);
      },

      all: function (cb) {
        return all_items('users', cb);
      }
    },

    channels: {
      save: function (channel, cb) {
        return save_item('channels', channel, cb);
      },

      get: function (channelId, cb) {
        return get_item('channels', channelId, cb);
      },

      delete: function (channelId, cb) {
        return delete_item('channels', channelId, cb);
      },

      all: function (cb) {
        return all_items('channels', cb);
      }
    },

    teams: {
      save: function (team, cb) {
        return save_item('teams', team, cb);
      },

      get: function (teamId, cb) {
        return get_item('teams', teamId, cb);
      },

      delete: function (teamId, cb) {
        return delete_item('teams', teamId, cb);
      },

      all: function (cb) {
        return all_items('teams', cb);
      }
    }
  };
};

module.exports = FirebaseStore;
