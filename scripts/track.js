var counter = document.getElementById("counter");
var rounds = 0;
socket.on('step tick', function(msg) {
    if(msg.counter == 15 && counting) {
        rounds--;
        if(rounds >= 0)
            counter.innerText = rounds;
        else
            counter.innerText = ":o";
    }
});

socket.on('hide toggle track', function(msg) {
    if(msg.value > 63)
        document.getElementById("matrix").classList.toggle("invisible");
});

var restart = document.getElementById("restart");
restart.addEventListener("click", function(e){
    restartSession();
});


function removeTrack() {
    console.log("Lost my track :(");
    document.querySelectorAll(".track").forEach(track => {
        track.remove();
    });
}

socket.on('create track', function(msg) {
    removeTrack();
    console.log("Got my track: " + (msg.track));
    var track = msg.track;
    var icon = document.getElementById("big-instrument-icon");
    fetch(soundsJson)
        .then((response) => response.json())
        .then((soundPreset) => {
            var sound = soundPreset[track];
            var imageURL = soundFolder + "images/" + sound.image;
            icon.setAttribute("src",imageURL);
            counter.innerText = msg.maxNumRounds;
            var color = getColor(track);
            counter.style.color = color;
            rounds = msg.maxNumRounds;
            var tr = createTrack(track, sound);
            document.getElementById("track-header").style.backgroundColor = color;
            if(track>7) {
                document.getElementById("track-header").style.color = "white";
                document.getElementById("big-instrument-icon").style.filter = "invert(1)";
            }
            var matrix = document.getElementById("matrix");
            matrix.appendChild(tr);
            tr.style.backgroundColor = color;
            var trackName = document.getElementById("track"+msg.track+"-name");
            var bigInitials = document.getElementById("big-initials");
            trackName.innerText = initials;
            bigInitials.innerText = initials;
            var selector = ".fader";
            if(track>7) selector = ".keyboard"
            document.querySelectorAll(selector).forEach(element => {
                element.style.display = "block";
            });
        });
});

socket.on('update track', function(msg) {
    var notes = msg.notes;
    var trackID = "track"+msg.track;
    for(var i=0; i<notes.length; i++) {
        if(notes[i].vel > 0) {
            var stepID = trackID+"-step"+i;
            var value = notes[i].vel;
            var stepElem = document.getElementById(stepID);
            var fader = document.getElementById(stepID+"fader");
            var kb = document.getElementById(stepID+"kb");
            var swColor = stepElem.firstChild.getAttribute("color");
            stepElem.setAttribute("value", value);
            stepElem.style.backgroundColor = valueToBGColor(value);
            stepElem.firstChild.style.backgroundColor = valueToSWColor(value, swColor);
            fader.value = value;
            kb.setNote(notes[i].note);
        }
    }
});

socket.on('exit session', function(msg) {
    var reason = translate(lang, msg.reason);
    restartSession(reason);
});


function restartSession(r) {
    var reason = "";
    if(r && r!== "") reason = "&exitreason=" + r;
    window.location.href = "/track?room=" + room +
    "&sounds=" + findGetParameter("sounds")+
    "&lang=" + findGetParameter("lang") + reason;
}

// Language options:
console.log("lang: " + lang)
function translate(lang, text) {
    var result = text;
    if(lang == "ES") {
        switch (text) {
            case "Join again?":
                    result = "¿Quieres entrar de nuevo?"
                break;
            case "Session has not started...":
                    result = "La sesión aún no ha empezado..."
                break;
                case "Remaining rounds":
                result = "Vueltas restantes";
                break;
            case "Exit":
                result = "Salir";            
                break;
            case "Enter your initials":
                result = "Digita tus iniciales";
                break;
            case "Session name":
                result = "Nombre de la sessión";
                break;
            case "Go":
                result = "OK";
                break;
            case "Exit":
                    result = "Salir";
                    break;
            default:
                break;
        } 
    }
    return result;
}

document.querySelectorAll(".translate").forEach(elem => {
    elem.innerText = translate(lang, elem.innerText);
});