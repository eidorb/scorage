Ractive.DEBUG = false;

// Retrieve data from local storage if present.
var players = store.get('players');
var rules = store.get('rules');
var view = store.get('view');
if (!players) {
  console.log('No players in storage, using defaults.');
  players = [{
    name: 'Player 1',
    bids: [null],
    tricks: [null]
  }];
}
if (!rules) {
  console.log('No rules in storage, using default rules.');
  rules = 'shing';
}
if (!view) {
  console.log('No view in storage, using default view.');
  view = 'setup';
}

var ractive = new Ractive({
  el: '#ractive-container',

  template: '#template',

  data: {
    view: view,

    players: players,

    rules: rules,

    ruleSets: {
      regular: {
        name: 'Regular',
        details: [
          '+1 point for each trick',
          '+10 points for taking the exact number of tricks bid (for non-zero bids)',
          '+5 points for taking zero tricks (for bids of zero)',
        ],
        scoreFunc: function(round, bid, tricks) {
          // Avoid implicit conversion of null to 0.
          if (bid === null || tricks === null) {
            return null;
          }
          if (bid === tricks) {
            if (bid > 0) {
              return tricks + 10;
            } else {
              return tricks + 5;
            }
          } else {
            return tricks;
          }
        }
      },
      alternate: {
        name: 'Alternate',
        details: [
          '+1 point for each trick',
          '+10 points for taking the exact number of tricks bid (including bids of zero)',
          '-5 points for missing your bid',
        ],
        scoreFunc: function(round, bid, tricks) {
          // Avoid implicit conversion of null to 0.
          if (bid === null || tricks === null) {
            return null;
          }
          if (bid === tricks) {
            return tricks + 10;
          } else {
            return tricks - 5;
          }
        }
      },
      shing: {
        name: "Shing's house rules",
        details: [
          '+1 point for each trick',
          '+10 points for taking the exact number of tricks bid (for non-zero bids)',
          'The greater of 5 points or the round number for taking zero tricks (for bids of zero)',
          '-5 points for missing your bid',
        ],
        scoreFunc: function(round, bid, tricks) {
          // Avoid implicit conversion of null to 0.
          if (bid === null || tricks === null) {
            return null;
          }
          if (bid === tricks) {
            if (bid > 0) {
              return tricks + 10;
            } else {
              // Successful zero bids get points equal to the maximum of 5
              // or the current round number.
              var points;
              if ((round + 1) > 5) {
                points = round + 1;
              } else {
                points = 5;
              }
              return points;
            }
          } else {
            return tricks - 5;
          }
        }
      }
    },

    // Compute data for the table.
    createTable: function() {
      var players = this.get('players');
      var numRounds = this.get('numRounds');
      var calcPoints = this.get('ruleSets')[this.get('rules')].scoreFunc;
      var table = {};
      table.rounds = [];
      table.scores = [];
      // The total score for each player is initially set to zero.
      table.scores = players.map(function() {return 0});
      // Create player-wise bids, tricks and points for each round.
      for (var round = 0; round < numRounds; round++) {
        var bids = [];
        var tricks = [];
        var pointsArray = [];
        var totalBids = 0;
        var totalTricks = 0;
        // Retrieve each player's bid and tricks for the round and calculate points.
        for (var index = 0; index < players.length; index++) {
          var bid = players[index].bids[round];
          var trick = players[index].tricks[round];
          var points = calcPoints(round, bid, trick);
          bids.push(bid);
          tricks.push(trick);
          pointsArray.push(points);
          // Add points to the player's score (null points will be converted
          // to 0 - not a drama).
          table.scores[index] += points;
          totalBids += bid;
          totalTricks += trick;
        }
        table.rounds.push({
          bids: bids,
          tricks: tricks,
          points: pointsArray,
          totalBids: totalBids,
          totalTricks: totalTricks,
        });
      }
      return table;
    }
  },

  computed: {
    playerNames: function() {
      return this.get('players').map(function(player) {
        return player.name;
      });
    },

    shortenedNames: function() {
      return uniquePrefixes(this.get('playerNames'));
    },

    // Number of rounds, calculated from the first player's bids.
    numRounds: function() {
      return this.get('players')[0].bids.length;
    }
  }
});

ractive.on({
  addPlayer: function(event) {
    // The new player's bids and tricks arrays are filled with as many nulls
    // as there are rounds.
    var numRounds = this.get('numRounds');
    var bids = [];
    for (var i = 0; i < numRounds; i++) {
      bids.push(null);
    }
    // Tricks is a copy of bids.
    var tricks = bids.slice();
    this.push('players', {
      name: event.node.value.trim(),
      bids: bids,
      tricks: tricks
    });
    // Clear the new player input.
    event.node.value = '';
  },

  removePlayer: function(event, index) {
    this.splice('players', index, 1);
  },

  editPlayerName: function(event, index) {
    this.set('players[' + index + '].name', event.node.value.trim());
  },

  editBid: function(event, round, index) {
    var parsed = parseString(event.node.value.trim());
    this.set('players[' + index + '].bids[' + round + ']', parsed);
  },

  editTrick: function(event, round, index) {
    var parsed = parseString(event.node.value.trim());
    this.set('players[' + index + '].tricks[' + round + ']', parsed);
  },

  addRound: function(event) {
    // Adding a round pushes a null on to all players' bids and tricks arrays.
    for (var index = 0; index < this.get('players').length; index++) {
      this.push('players[' + index + '].bids', null);
      this.push('players[' + index + '].tricks', null);
    }
  },

  removeRound: function(event, round) {
    for (var index = 0; index < this.get('players').length; index++) {
      this.splice('players[' + index + '].bids', round, 1);
      this.splice('players[' + index + '].tricks', round, 1);
    }
  },

  removeAllRounds: function(event) {
    // Set all player's bids and tricks arrays to an array with a single null.
    for (var index = 0; index < this.get('players').length; index++) {
      this.set('players[' + index + '].bids', [null]);
      this.set('players[' + index + '].tricks', [null]);
    }
  }
});

// If storage is enabled, observe for change and write to storage.
if (store.enabled) {
  ractive.observe({
    players: function() {
      store.set('players', this.get('players'));
    },

    rules: function() {
      store.set('rules', this.get('rules'));
    },

    view: function() {
      store.set('view', this.get('view'));
    }
  }, {
    // Don't call the functions initially.
    init: false
  });
}

// Return the shortest unique prefixes from an array of strings.
function uniquePrefixes(strings) {
  return strings.map(function(string, index, strings) {
    // Create incrementally longer prefixes of string.
    for (var prefixLength = 1; prefixLength <= string.length; prefixLength++) {
      // Uniqueness flag initially set true.
      var unique = true;
      // Create a prefix which increases in length each iteration.
      var prefix = string.substr(0, prefixLength);
      // Compare prefix to the same length prefix of each other string.
      for (var stringIndex = 0; stringIndex < strings.length; stringIndex++) {
        // Don't compare a prefixes of the same string.
        if (index === stringIndex) {
          continue;
        }
        var comparisonPrefix = strings[stringIndex].substr(0, prefixLength);
        // If a match is found, then the prefix is not unique. Do not
        // bother comparing the prefix with the remaining strings.
        if (prefix.toLowerCase() === comparisonPrefix.toLowerCase()) {
          unique = false;
          break;
        }
      }
      // Prefixes have been compared, return the prefix if unique.
      if (unique === true) {
        return prefix;
      }
    }
    // If no unique prefix was found, just return the string.
    return string;
  });
}

// Return a parsed base-10 integer or null if parse result was NaN.
function parseString(string) {
  var parsed = parseInt(string, 10);
  return isNaN(parsed) ? null : parsed;
}
