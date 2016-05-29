var latestDataVersion = 1,
  dataVersion = store.get('dataVersion'),
  view = store.get('view'),
  rules = store.get('rules'),
  playerMap = store.get('playerMap'),
  playerOrder = store.get('playerOrder'),
  rounds = store.get('rounds');

if (!dataVersion || dataVersion < latestDataVersion) {
  console.log('Local storage is stale, using default values.');
  var id = Math.random().toString().slice(2);

  view = 'setup';
  rules = 'shing';
  playerMap = {};
  playerOrder = [id];
  rounds = [{
    hands: 1,
    bids: {},
    tricks: {}
  }],
  playerMap[id] = 'Player 1'
  store.set('dataVersion', latestDataVersion);
  store.set('view', view);
  store.set('rules', rules);
  store.set('playerMap', playerMap);
  store.set('playerOrder', playerOrder);
  store.set('rounds', rounds);
}


/**
 * Return an integer if a base-10 integer could be parsed from string.
 */
function parseIntegerString(string) {
  var integer = parseInt(string, 10);
  if (!isNaN(integer)) {
    return integer;
  }
}


/**
 * Return true if value is an integer.
 */
function isInteger(value) {
  return typeof value === "number" && isFinite(value) && Math.floor(value) === value;
};


/**
 * Return the shortest unique prefixes of an array of strings.
 * strings - array of strings
 */
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


/**
 * Predict the number of hands for the next round given the previous two rounds' hands.
 * The prediction behaves as follows:
 *  - One more than last round if there has only been one round.
 *  - One more than last round if hands are increasing,
 *    but one less if there were 10 hands last round.
 *  - One less than last round if hands are decreasing
 *    and there was more than one hand last round.
 *  - Same as last round otherwise.
 * last - hands in the last round
 * secondLast - hands in the second last round, or null if no second last round
 * Returns the predicted number of hands.
 */
function predictHands(last, secondLast) {
  // Guess one more than the last if there has only been one round.
  if (secondLast === undefined) {
    return last + 1;
  }

  if (last > secondLast) {
    // If the number of hands is increasing...
    if (last === 10) {
      // ...but there were 10 hands last round, guess one less than last.
      return last - 1;
      // ...guess one more than last.
    } else {
      return last + 1;
    }
  }

  // Guess one less than the last if hands are decreasing and there was more than
  // one hand last round..
  if (last < secondLast && last > 1) {
      return last - 1;
  }

  // Otherwise guess the same as the last number of hands.
  return last;
}


Ractive.DEBUG = false;

var ractive = new Ractive({
  el: '#ractive-container',
  template: '#template',
  data: {
    view: view,
    rules: rules,
    playerMap: playerMap,
    playerOrder: playerOrder,
    rounds: rounds,

    /**
     * Sum a round's bids or tricks.
     * index - round index
     * key - key to sum ('bids' or 'tricks')
     */
    sumRound: function(index, key) {
      var values = this.get('rounds.' + index + '.' + key),
        sum = null;

      this.get('playerOrder').forEach(function(id) {
        if (values[id] != null) {
          sum += values[id];
        }
      });
      return sum;
    },

    /**
     * Calculate player's points for a round if bid and tricks don't equate to null.
     * A player's bid and tricks undefined initially and also when an input is
     * is cleared or invalid.
     * round - Round object
     * id - player's id
     */
    calculatePoints: function(round, id) {
      var calculatePoints = this.get('rulesSet')[this.get('rules')].calculatePoints;
        bid = round.bids[id],
        tricks = round.tricks[id];

      if (bid != null && tricks != null) {
        return calculatePoints(bid, tricks, round.hands);
      }
    },
    rulesSet: {
      regular: {
        name: 'Regular',
        details: [
          '+1 point for each trick',
          '+10 points for a successful non-zero bid',
          '+5 points for a successful zero bid',
        ],
        calculatePoints: function(bid, tricks) {
          if (bid === tricks) {
            // Successful...
            if (bid > 0) {
              // ...non-zero bid.
              return tricks + 10;
            } else {
              // ...zero bid
              return tricks + 5;
            }
          } else {
            // Unsuccessful bid.
            return tricks;
          }
        }
      },
      alternate: {
        name: 'Alternate',
        details: [
          '+1 point for each trick',
          '+10 points for a successful bid',
          '-5 points for an unsuccessful bid',
        ],
        calculatePoints: function(bid, tricks) {
          if (bid === tricks) {
            // Successful bid.
            return tricks + 10;
          } else {
            // Unsuccessful bid.
            return tricks - 5;
          }
        }
      },
      shing: {
        name: "Shing's house rules",
        details: [
          '+1 point for each trick',
          '+10 points for a successful non-zero bid)',
          'Greater of the number of hands or 5 points for a successful zero bid',
          '-5 points for an unsuccessful bid',
        ],
        calculatePoints: function(bid, tricks, hands) {
          if (bid === tricks) {
            // Successful...
            if (bid > 0) {
              // ...non-zero bid.
              return tricks + 10;
            } else {
              // ...zero bid.
              // Return the greater of the number of hands or 5.
              if (hands > 5) {
                return hands;
              } else {
                return 5;
              }
            }
          } else {
            // Unsuccessful bid.
            return tricks - 5;
          }
        }
      }
    }
  },
  computed: {
    players: function() {
      var playerMap = this.get('playerMap'),
        playerOrder = this.get('playerOrder'),
        shortNames = uniquePrefixes(playerOrder.map(function(id) {
          return playerMap[id];
        }));

      return playerOrder.map(function(id, index) {
        return {
          id: id,
          name: playerMap[id],
          shortName: shortNames[index]
        };
      });
    },

    /**
     * Return a object of player scores (sum of points).
     */
    scores: function() {
      var ractive = this,
        rounds = this.get('rounds'),
        playerOrder = this.get('playerOrder'),
        calculatePoints = this.get('calculatePoints'),
        scores = {};

      // Calculate the score for each player.
      playerOrder.forEach(function(id) {
        var score = null;

        // Score is the sum a player's points for each round.
        rounds.forEach(function(round, index) {
          var points = calculatePoints.call(ractive, round, id);

          if (points != null) {
            score += points;
          }
        });

        if (score != null) {
          scores[id] = score;
        }
      });
      return scores;
    }
  }
});

ractive.on({
  /**
   * Map unique (hopefully) id to player name, append id to player order array.
   */
  addPlayer: function(event) {
    var name = event.node.value.trim(),
      // players = this.get('players'),
      //playerOrder = this.get('playerOrder'),
      id = Math.random().toString().slice(2);

    this.set('playerMap.' + id, name);
    this.push('playerOrder', id);
    // Clear the new player input field.
    event.node.value = '';
  },

  /**
   * Remove player from players map and player order array.
   * The player's bids and tricks are removed from each round.
   * id - id of player to remove
   */
  removePlayer: function(event, id) {
    var playerMap = this.get('playerMap'),
      playerOrder = this.get('playerOrder'),
      rounds = this.get('rounds');

    delete playerMap[id];
    playerOrder.splice(playerOrder.indexOf(id), 1);
    this.set({playerMap: playerMap, playerOrder: playerOrder});

    // Remove player properties from each round's bids and tricks.
    rounds.forEach(function(round, index) {
      var bids = this.get('rounds.' + index + '.bids.' + id),
        tricks = this.get('rounds.' + index + '.tricks.' + id);

      delete bids[id];
      delete tricks[id];
      this.set('rounds.' + index + '.bids.' + id, bids);
      this.set('rounds.' + index + '.tricks.' + id, tricks);
    });
  },

  /**
   * Change the player's name to the input value.
   * id - id of player
   */
  editPlayerName: function(event, id) {
    var name = event.node.value.trim();

    this.set('playerMap.' + id, name);
  },

  /**
   * Add a new round to the rounds array. Predict the number of hands in the
   * next round.
   */
  addRound: function(event) {
    var rounds = this.get('rounds'),
      lastRound = rounds[rounds.length - 1],
      secondLastRound = rounds[rounds.length - 2];

    this.push('rounds', {
      hands: predictHands(lastRound.hands, secondLastRound && secondLastRound.hands),
      bids: {},
      tricks: {}
    });
  },

  /**
   * Remove round from a rounds array.
   * index - index of round
   */
  removeRound: function(event, index) {
    this.splice('rounds', index, 1);
  },

  /**
   * Replace all rounds with a default first round.
   */
  removeAllRounds: function(event) {
    this.splice('rounds', 0, this.get('rounds').length, {
      hands: 1,
      bids: {},
      tricks: {}
    });
  },

  /**
   * Change player's bid to input value for given round.
   * index - index of round
   * id - player id
   */
  editBid: function(event, index, id) {
    var integer = parseIntegerString(event.node.value.trim());
    this.set('rounds.' + index + '.bids.' + id, integer);
  },

  /**
   * Change player's tricks to input value for given round.
   * index - index of round
   * id - player id
   */
  editTrick: function(event, index, id) {
    var integer = parseIntegerString(event.node.value.trim());
    this.set('rounds.' + index + '.tricks.' + id, integer);
  }
});


if (store.enabled) {
  ractive.observe({
    view: function() {
      store.set('view', this.get('view'));
    },
    rules: function() {
      store.set('rules', this.get('rules'));
    },
    playerMap: function() {
      store.set('playerMap', this.get('playerMap'));
    },
    playerOrder: function() {
      store.set('playerOrder', this.get('playerOrder'));
    },
    rounds: function() {
      store.set('rounds', this.get('rounds'));
    }
  }, {
    // Don't call the functions initially.
    init: false
  });
}
