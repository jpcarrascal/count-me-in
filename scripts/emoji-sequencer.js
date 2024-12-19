socket.on('reload track sample', function(msg) {
    console.log(msg)
    fetch('/audiomock?prompt=' + msg.value)
    .then(response => response.json())
    .then(data => {
        document.querySelectorAll("audio").forEach((elem) => {
            var t = elem.getAttribute("track");
            if(parseInt(msg.track) == parseInt(t)) {
                console.log("Reloading track " + t + " sample");
                elem.src = data.sound;
                elem.load();
            }
        });
    })
    .catch(error => console.error('Error:', error));
});

