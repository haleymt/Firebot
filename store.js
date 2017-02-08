var firebase = require('firebase');
var { firebaseConfig } = require('./constants');

var firebase_store = {
  config: function(cb) {
    firebase.initializeApp(firebaseConfig);
    var database = firebase.database();

    this.users.database = database;
    this.channels.database = database;
    this.teams.database = database;
    cb();
  },

  users: {
    save: function (user, cb) {
      if (user.id) {
        /* ADMIN version */
        // this.database.child("users").set({ user.id: user });

        this.database.ref('users/' + user.id).set(user);
        cb(null, user);
      } else {
        cb('No ID specified');
      }
    },

    get: function(userId, cb) {
      this.database.ref('users/' + userId).once('value').then(
        function(snapshot) {
          cb(null, snapshot.val());
        }
      );
    },

    delete: function(userId, cb) {
      this.database.ref('users/' + userId).remove();
      cb(null, userId);
    },

    all: function(cb) {
      this.database.ref('users').once('value').then(
        function(snapshot) {
          var users = snapshot.val() || [];
          cb(null, users);
        }
      );
    }
  },

  channels: {
    save: function (channel, cb) {
      if (channel.id) {
        this.database.ref('channels/' + channel.id).set(channel);
        cb(null, channel);
      } else {
        cb('No ID specified');
      }
    },

    get: function(channelId, cb) {
      this.database.ref('channels/' + channelId).once('value').then(
        function(snapshot) {
          cb(null, snapshot.val());
        }
      );
    },

    delete: function(channelId, cb) {
      this.database.ref('channels/' + channelId).remove();
      cb(null, channelId);
    },

    all: function(cb) {
      this.database.ref('channels').once('value').then(
        function(snapshot) {
          var channels = snapshot.val() || [];
          cb(null, channels);
        }
      );
    }
  },

  teams: {
    save: function (team, cb) {
      console.log('SAVING');
      if (team.id) {
        this.database.ref('teams/' + team.id).set(team);
        cb(null, team);
      } else {
        cb('No ID specified');
      }
    },

    get: function(teamId, cb) {
      console.log('GETTING');
      this.database.ref('teams/' + teamId).on('value', function(snapshot) {
        var val =  snapshot.val() || false;
        cb(null, val);
      }, function(err) {
        if (err) {
          cb(null, false);
        }
      });
    },

    delete: function(teamId, cb) {
      this.database.ref('teams/' + teamId).remove();
      cb(null, teamId);
    },

    all: function(cb) {
      console.log('GETTING ALL');
      this.database.ref('teams').once('value').then(
        function(snapshot) {
          var teams = snapshot.val() || [];
          cb(null, teams);
        }
      );
    }
  }
};

module.exports = firebase_store;
