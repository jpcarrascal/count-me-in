
if(isSeq) {
    var drumSamples = ["BD.WAV",
                "SD.WAV",
                "CP.WAV",
                "HC.WAV",
                "LC.WAV",
                "LT.WAV",
                "CH.WAV",
                "OH.WAV"];
    /*
                "CY.WAV",
                "HT.WAV",
                "CB.WAV",
                "MT.WAV",
    */
    var drums = new Array();
    for(var i=0; i<drumSamples.length; i++) {
        drums[i] = new Audio('sounds/' + drumSamples[i]);
    }

    function AudioPlayDrum(i, vel) {
        drums[7-i].currentTime = 0
        drums[7-i].volume = vel/127;
        drums[7-i].play();
    }

}