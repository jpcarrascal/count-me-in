// From: https://gist.github.com/drmikecrowe/4bf0938ea73bf704790f
'use strict';
// Change both NUM_TRACKS and the soundset json to change the number of tracks:
(function(window){
    var config = {
        NUM_TRACKS      : 10,
        NUM_DRUMS      : 8,
        NUM_STEPS       : 16,
        MAX_NUM_ROUNDS  : 16,
    };
    if ( typeof module === 'object' && module && typeof module.exports === 'object' ) {
        module.exports = config;
    } else {
        window.config = config;
    }
})( this );
