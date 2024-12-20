socket.on('reload track sample', function(msg) {
    document.querySelectorAll("audio").forEach((elem) => {
        var t = elem.getAttribute("track");
        if(parseInt(msg.track) == parseInt(t)) {
            console.log("Reloading track " + t + " sample: " + msg.sample);
            elem.src = msg.sample;
            elem.load();
        }
    });
    
});

socket.on('reload sample notice', function(msg) {
    console.log("Track " + t + "requested new sample with prompt: " + msg.prompt);
});

