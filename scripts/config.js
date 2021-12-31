'use strict';

/* jshint ignore:start */
(function(window){
    var config = {
        NUM_TRACKS      : 8,
        NUM_STEPS       : 16,
        MAX_NUM_ROUNDS  : 20,
    };
    if ( typeof module === 'object' && module && typeof module.exports === 'object' ) {
        module.exports = config;
    } else {
        window.config = config;
    }
})( this );
/* jshint ignore:end */