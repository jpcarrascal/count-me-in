socket.on('reload track sample', function(msg) {
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
    /*
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
    */
});



async function fetchPrediction(prompt) {
    const apiURL = "https://huggingface.co/spaces/stardate69/StableAudioOpenEndpoint/api/predict";
    
    const requestBody = {
        prompt: prompt,
        api_name: "/predict"
    };

    try {
        const response = await fetch(apiURL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const result = await response.json();
        console.log(result);
        return result;

    } catch (error) {
        console.error("Error making API call:", error.message);
    }
}


