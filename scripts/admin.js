var query = new URLSearchParams(window.location.search);
var session = (query.get("session") || "").trim();

var socket = io("", {
  query: {
    session: session,
    admin: "true",
  },
});

var sessionNameElem = document.getElementById("session-name");
var sessionStatusElem = document.getElementById("session-status");
var adminMessageElem = document.getElementById("admin-message");
var clientsCountElem = document.getElementById("clients-count");
var clientsBody = document.getElementById("clients-body");

var playPauseButton = document.getElementById("play-pause");
var clearAllButton = document.getElementById("clear-all");
var tempoInput = document.getElementById("tempo");
var setTempoButton = document.getElementById("set-tempo");
var randomTempoButton = document.getElementById("random-tempo");
var refreshClientsButton = document.getElementById("refresh-clients");
var disconnectAllButton = document.getElementById("disconnect-all");

var isPlaying = false;
var controls = [
  playPauseButton,
  clearAllButton,
  tempoInput,
  setTempoButton,
  randomTempoButton,
  refreshClientsButton,
  disconnectAllButton,
];

function setControlsEnabled(enabled) {
  controls.forEach(function(control) {
    control.disabled = !enabled;
  });
}

function setMessage(message) {
  adminMessageElem.innerText = message || "";
}

function updatePlayPauseLabel() {
  playPauseButton.innerText = isPlaying ? "Pause" : "Play";
}

function renderClients(clients) {
  clientsBody.innerHTML = "";
  clientsCountElem.innerText = clients.length;

  if(clients.length === 0) {
    var emptyRow = document.createElement("tr");
    var emptyCell = document.createElement("td");
    emptyCell.colSpan = 3;
    emptyCell.innerText = "No active track clients.";
    emptyRow.appendChild(emptyCell);
    clientsBody.appendChild(emptyRow);
    return;
  }

  clients.forEach(function(client) {
    var row = document.createElement("tr");

    var trackCell = document.createElement("td");
    trackCell.innerText = client.track;

    var initialsCell = document.createElement("td");
    initialsCell.innerText = client.initials;

    var socketCell = document.createElement("td");
    socketCell.innerText = client.socketID;

    row.appendChild(trackCell);
    row.appendChild(initialsCell);
    row.appendChild(socketCell);
    clientsBody.appendChild(row);
  });
}

function refreshState() {
  if(!session) return;
  socket.emit("admin request state");
  socket.emit("admin request clients");
}

function applyState(state) {
  if(!state) return;

  sessionNameElem.innerText = state.session || session || "(missing)";
  isPlaying = !!state.playing;
  updatePlayPauseLabel();
  tempoInput.value = state.tempo || 98;

  if(!state.exists) {
    sessionStatusElem.innerText = "Session not found";
    setControlsEnabled(false);
    return;
  }

  if(!state.ready) {
    sessionStatusElem.innerText = "Session exists but sequencer is not connected";
    setControlsEnabled(false);
    return;
  }

  sessionStatusElem.innerText = isPlaying ? "Playing" : "Stopped";
  setControlsEnabled(true);
}

if(!session) {
  sessionNameElem.innerText = "(missing)";
  sessionStatusElem.innerText = "Add ?session=<name> to the URL";
  setMessage("Example: /admin?session=my-session");
  setControlsEnabled(false);
}

socket.on("connect", function() {
  setMessage("");
  if(!session) return;
  refreshState();
});

socket.on("disconnect", function() {
  sessionStatusElem.innerText = "Disconnected";
  setControlsEnabled(false);
});

socket.on("admin state", function(state) {
  applyState(state);
  if(Array.isArray(state.clients)) {
    renderClients(state.clients);
  }
});

socket.on("admin clients", function(msg) {
  renderClients(msg.clients || []);
});

socket.on("admin error", function(msg) {
  setMessage(msg.reason || "Admin request failed");
});

socket.on("play", function() {
  isPlaying = true;
  updatePlayPauseLabel();
  sessionStatusElem.innerText = "Playing";
});

socket.on("stop", function() {
  isPlaying = false;
  updatePlayPauseLabel();
  sessionStatusElem.innerText = "Stopped";
});

playPauseButton.addEventListener("click", function() {
  if(!session) return;
  setMessage("");
  if(isPlaying) {
    socket.emit("admin stop");
  } else {
    socket.emit("admin play");
  }
});

setTempoButton.addEventListener("click", function() {
  if(!session) return;
  var tempo = parseInt(tempoInput.value);
  if(Number.isNaN(tempo)) {
    setMessage("Tempo must be a number");
    return;
  }
  if(tempo < 60) tempo = 60;
  if(tempo > 250) tempo = 250;
  tempoInput.value = tempo;
  setMessage("");
  socket.emit("admin set tempo", {tempo: tempo});
});

randomTempoButton.addEventListener("click", function() {
  if(!session) return;
  var tempo = Math.floor(Math.random() * (115 - 80 + 1)) + 80;
  tempoInput.value = tempo;
  setMessage("");
  socket.emit("admin set tempo", {tempo: tempo});
});

clearAllButton.addEventListener("click", function() {
  if(!session) return;
  setMessage("");
  socket.emit("admin clear all");
});

refreshClientsButton.addEventListener("click", function() {
  if(!session) return;
  setMessage("");
  refreshState();
});

disconnectAllButton.addEventListener("click", function() {
  if(!session) return;
  var ok = window.confirm("Disconnect all active track clients from this session?");
  if(!ok) return;
  setMessage("");
  socket.emit("admin disconnect all");
});

setInterval(function() {
  if(!session) return;
  if(socket.connected) {
    socket.emit("admin request clients");
  }
}, 3000);
