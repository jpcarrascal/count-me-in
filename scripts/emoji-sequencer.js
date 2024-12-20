socket.on('reload track sample', function(msg) {
    /* 
    fetch('https://huggingface.co/spaces/stardate69/StableAudioOpenEndpoint/predict', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: 'techno kick' }),
        mode: 'no-cors',
    })
    .then(response => response.text())
    .then(data => console.log(data))
    .catch(error => console.error('Error:', error));
    */
    
    document.querySelectorAll("audio").forEach((elem) => {
        var t = elem.getAttribute("track");
        if(parseInt(msg.track) == parseInt(t)) {
            console.log("Reloading track " + t + " sample: " + msg.sample);
            elem.src = msg.sample;
            elem.load();
        }
    });
    
});

socket.on('reload track sample', function(msg) {
    console.log("Track " + t + "requested new sample with prompt: " + msg.prompt);
});

