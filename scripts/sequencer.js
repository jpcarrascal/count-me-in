// Am I a sequencer?
var isSeq = location.pathname.includes("sequencer");
var initials = "";
var session = findGetParameter("session") || DEFAULT_ROOM;
var method = findGetParameter("method") || "random";
var extClock = findGetParameter("extclock") || false;
var experimentSwitch = document.getElementById("experiment-switch");
var role = "secondary";
var stepSequencer = new Sequencer(NUM_TRACKS, NUM_STEPS);
var audioPlay = true;
if(isSeq) {
  initials = "SQ";
  var hideInfo = findGetParameter("hideinfo");
  document.getElementById("session-name").innerText = session;
  var info = document.getElementById("session-info");
  var trackURL = document.location.origin +
                "/track?session=" + session +
                "&lang=" + lang;
  //var qrcodeURL = 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data='+trackURL;
  let qrcodeURL = "https://qrcode.azurewebsites.net/qr?width=300&margin=1&string=" + encodeURIComponent(trackURL);
  var qrcode = document.createElement("img");
  qrcode.setAttribute("src",qrcodeURL);
  qrcode.setAttribute("id","qrcode");
  document.getElementById("qrcode-wrapper").appendChild(qrcode);
  updateTrackURL(trackURL);
  document.getElementById("copy").addEventListener("click", function(e) {
    copyURL("url-copy");
    this.innerText = "COPIED!";
    p=setTimeout( function() { document.getElementById("copy").innerText = "COPY TO CLIPBOARD" }, 2000);
    console.log(p)
  });

  experimentSwitch.addEventListener("click", function(e) {
    if(this.checked) {
      //window.location.href = "/sequencer?session=" + session + "&experiment=true";
      trackURL += "&experiment=true";
      updateTrackURL(trackURL);
    } else {
      //window.location.href = "/sequencer?session=" + session;
      //trackURL += "&experiment=true";
      trackURL = removeAllSubstrings(trackURL, "&experiment=true");
      updateTrackURL(trackURL);
    }
  });
  
  function updateTrackURL(url) {
    document.getElementById("track-url").setAttribute("href",url);
    document.getElementById("track-url").innerText = url;
    document.getElementById("url-copy").innerText
  }

  if(hideInfo || extClock) {
    audioPlay = false;
    document.getElementById("play-audio").checked = false;
    info.style.display = "none";
  } else {
    info.style.display = "flex";
  }
  
} else {
  console.log("not a sequencer...");
  initials = findGetParameter("initials") || "?";
}
var counting = false;

// Node stuff:
var socket = io("", {query:{initials:initials, session:session, sequencer:isSeq, lang:lang, method:method, sounds: soundParam}});
var mySocketID;
socket.on("connect", () => {
  console.log("Connected, my socketid: " + socket.id);
  mySocketID = socket.id;
});

socket.on('play', function(msg) {
  veilPlay();
  console.log("Remote play!" + msg.socketID);
});

socket.on('stop', function(msg) {
  console.log("Remote stop!" + msg.socketID);
  //updateCursor(-1);
  veilStop();
});

socket.on('veil-play', function(msg) {
  veilPlay();
});

socket.on('veil-stop', function(msg) {
  veilStop();
});

socket.on('veil-up', function(msg) {
  hideAndPLay();
});

socket.on('step tick', function(msg) {
  updateCursor(msg.counter);
});

socket.on('track volume', function(msg) {
  trackGain[msg.track].gain.value = msg.value;
});

socket.on('track mute', function(msg) {
  trackMute[msg.track].gain.value = 1 - msg.value;
});

socket.on('step update', function(msg) {
  var stepID = "track"+msg.track+"-step"+msg.step;
  var step = document.getElementById(stepID);
  if(step) {
    var fader = document.getElementById(stepID+"fader");
    var kb = document.getElementById(stepID+"kb");
    var value = msg.value;
    var note = msg.note;
    step.setAttribute("value", value);
    step.setAttribute("note", note);
    step.style.backgroundColor = valueToBGColor(value);
    var swColor = step.firstChild.getAttribute("color");
    step.firstChild.style.backgroundColor = valueToSWColor(value, swColor);
    fader.value = value;
    if(value) kb.setNote(note);
    else kb.unsetNote();
    if(stepSequencer) {
      stepSequencer.tracks[msg.track].notes[msg.step].vel = value;
      stepSequencer.tracks[msg.track].notes[msg.step].note = note;
    }
  }
});

// UI stuff:
var matrix = document.getElementById("matrix");
createHeader(matrix);

if(isSeq) {
  socket.on('sequencer role', function(msg) {
    console.log("Role: " + msg.role);
    if(msg.role == "main") {
      role = "main";
      console.log("I'm the main sequencer!");
      console.log("Reseting steps...");
      try{
        for(var i=0; i<num_tracks; i++) {
          var track = stepSequencer.tracks[i];
          for(var j=0; j<NUM_STEPS; j++) {
            window.max.outlet("step_update", i, j, 63, 0);
          }
        }
      } catch(e) {
        console.log("Max not loaded");
      }
    } else {
      extClock = true;
      stopButton.style.display = "none";
      playButton.style.display = "none";
      document.querySelectorAll(".play-audio").forEach(e => e.style.display = "none");
      tempoBox.setAttribute("readonly", true);
    }
  });
  
  socket.on('clear track', function(msg) {
    var trackName = document.getElementById("track"+msg.track+"-name");
    var track = document.getElementById("track"+msg.track);
    if(track) {
      track.style.backgroundColor = EMPTY_COLOR;
      trackName.innerText = "---";
      if(getColor(msg.track) == "black") {
        document.getElementById("track" + msg.track + "-name").style.color = "black";
        document.getElementById("track" + msg.track + "-icon").style.filter = "";
      }
    }
  });

  socket.on('track joined', function(msg) {
    //socket.emit('track notes', { track: msg.track, socketid: msg.socketid, notes:stepSequencer.tracks[msg.track].notes } );
    var trackName = document.getElementById("track" + msg.track+"-name");
    var track = document.getElementById("track" + msg.track);
    trackName.innerText = msg.initials;
    var color = getColor(msg.track);
    track.style.backgroundColor = color;
    if(color == "black") {
      document.getElementById("track" + msg.track + "-name").style.color = "white";
      document.getElementById("track" + msg.track + "-icon").style.filter = "invert(1)";
    }
    stepSequencer.setTrackInitials(msg.track, msg.initials);
    //clearTrack(msg.track);
  });

  socket.on('give me my notes', function(msg) {
    console.log(msg.socketid + " asked for their notes. sending them... ");
    socket.emit('track notes', { track: msg.track, socketid: msg.socketid, notes:stepSequencer.tracks[msg.track].notes } );
  });

  socket.on('sequencer exists', function(msg) {
    //removeTrack();
    var reason = "";
    if(msg.reason)
        reason = "?exitreason=" + msg.reason;
    window.location.href = "/sequencer"+reason;
  });

  var closeInfo = document.getElementById("close-info");
  
  closeInfo.addEventListener("click", function() {
    hideAndPLay();
  });

  document.getElementById("backdrop").addEventListener("click", event => {
    var clickme = document.getElementById("click-me-first");
    var logo = document.getElementById("logo-image");
    if(clickme.style.display != "none") {
      clickme.style.color = "white";
      clickme.innerText = "Thank you!"
      setTimeout(function() {
        clickme.style.display = "none";
        logo.style.display = "block";
      }, 500);
    }
    console.log("Resuming audio...");
    audioContext.resume();
    console.log("Entering fullscreen.");
    enterFullscreen();
  });

  document.addEventListener("keydown", event => {
    console.log("resuming audio...");
    audioContext.resume();
    if (event.code == "Space" && !extClock) {
      event.preventDefault();
      e = new Event("click");
      if(playing)
        document.querySelector("#stop").dispatchEvent(e);
      else
        document.querySelector("#play").dispatchEvent(e);
    } else if (event.code == "KeyA") {
      event.preventDefault();
      hideAndPLay();
    } else if (event.code == "KeyQ") {
      document.getElementById("backdrop").removeAttribute("style")
      document.getElementById("backdrop").classList.toggle("slide-top");
    }
  });

  function hideAndPLay() {
    enterFullscreen();
    var info = document.getElementById("session-info");
    if(info.style.display == "flex") {
      info.style.display = "none";
      if(!playing && !extClock) document.getElementById("play").click();
    } else {
      info.style.display = "flex";
    }
  }

  // Seq stuff:
  var tempoBox = document.getElementById("tempo")
  var tempo = tempoBox.value;
  var playing = false;
  var interval = 60000/(4*tempo);
  var timer;
  var counter = 0;

  tempoBox.addEventListener("change",function(e){
    this.setAttribute('value', this.value);
    tempo = this.value;
    interval = 60000/(4*tempo);
  });

  document.getElementById("show-session-link").addEventListener("click",function(e){
    document.getElementById("session-info").style.display = "flex";
  });
}

function clearTrack(track) {
  stepSequencer.clearTrack(track);
  var trackClass = ".track"+track;
  var steps = document.querySelectorAll(trackClass);
  steps.forEach(step =>{
    step.setAttribute("value",0);
    step.style.backgroundColor = offColor;
    step.firstChild.style.backgroundColor = "transparent";
  });
}


function updateCursor(counter) {
  var prev = counter - 1;
  if(prev < 0) prev = NUM_STEPS-1;
  if(counter >=0) {
    var stepPos = document.querySelectorAll(".step"+counter);
    var prevPos = document.querySelectorAll(".step"+prev);
    prevPos.forEach(step => {
      step.parentElement.classList.remove("cursor");
      step.style.backgroundColor = valueToBGColor(step.getAttribute("value"));
      step.style.borderRadius = "10%";
    });
    stepPos.forEach(step => {
      var c = parseInt(step.getAttribute("track"));
      var hlColor = getColor(c);
      step.parentElement.classList.add("cursor");
      if(step.getAttribute("value") > 0){
        step.style.backgroundColor = hlColor;
        step.style.borderRadius = "50%";
      }
    });
  } else {
    var all = document.querySelectorAll(".step");
    all.forEach(step => {
      step.parentElement.classList.remove("cursor");
      step.style.backgroundColor = valueToBGColor(step.getAttribute("value"));
      step.style.borderRadius = "10%";
    })
  }
}
