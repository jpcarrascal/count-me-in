const NUM_DRUMS = config.NUM_DRUMS;
const NUM_STEPS = config.NUM_STEPS;
const MAX_NUM_ROUNDS = config.MAX_NUM_ROUNDS;
const lang = findGetParameter("lang") || "EN";
const soundParam = findGetParameter("sounds") || "tr808";
const soundFolder = "/sounds/" + soundParam + "/";
const soundsJson = soundFolder + "index.json";

const NOTE_ON = 0x90;
const NOTE_OFF = 0x80;
const NOTE_DURATION = 300;
const DEFAULT_ROOM = 999;
const EMPTY_COLOR = "#AAA";
const MAX_OCTAVE = 8;
const MIN_OCTAVE = 3;
const MID_OCTAVE = 4;
const SYNTH_DEFAULT_VEL = 63;
var stepSequencer;
const colors = ["cyan","chartreuse","dodgerblue","darkorchid","magenta","red","orange","gold","black"];
function getColor(index) {
  while (index >= colors.length)
    index = index - colors.length;
  return colors[index];
}
/*
36. Kick Drum
38. Snare Drum
39. Hand Clap
41. Floor Tom 2
42. Hi-Hat Closed
43. Floor Tom 1
45. Low Tom
46. Hi-Hat Open
49. Crash Cymbal
*/

/*

*/

const drumNotes = [36, 38, 39, 41, 43, 45, 42, 46];
const onColor = "rgb(128,128,128)";
const offColor = "white";
var mouseStepDownVal = 0;

function createHeader(table) {
  // Header
  var tr = document.createElement("tr");
  tr.classList.add("track-header-tr");
  var th = document.createElement("th");
  th.classList.add("name-header");
  tr.appendChild(th);
  th = document.createElement("th");
  th.classList.add("name-header");
  var text = document.createTextNode("☺");
  th.append(text);
  tr.appendChild(th);
  for(var j=0; j<NUM_STEPS; j++) {
    var th = document.createElement("th");
    th.classList.add("step-header");
    var text = document.createTextNode(j+1);
    th.append(text);
    tr.appendChild(th);
  }
  table.appendChild(tr);
}

function createTrack(i, sound) {
  var imageURL = soundFolder + "images/" + sound.image;
  var tr = document.createElement("tr");
  var trackID = "track"+i;
  tr.setAttribute("id",trackID);
  tr.setAttribute("note",drumNotes[i]);
  tr.classList.add("track");
  if(sound.type == "synth") tr.classList.add("synth-track");
  var td = document.createElement("td");
  var img = document.createElement("img");
  img.setAttribute("src",imageURL);
  img.setAttribute("track",trackID);
  img.setAttribute("id",trackID+"-icon");
  img.classList.add("track-icon");
  img.addEventListener("click", showStepControls);
  td.appendChild(img);
  td.classList.add("track-icon-td");
  td.classList.add("track-meta");
  tr.appendChild(td);

  td = document.createElement("td");
  var text = document.createTextNode("---");
  td.classList.add("track-name-td");
  td.classList.add("track-meta");
  td.setAttribute("id",trackID+"-name");
  td.setAttribute("track",trackID);
  td.addEventListener("dblclick", clearSteps);
  td.append(text);
  tr.appendChild(td);
  for(var j=0; j<NUM_STEPS; j++) {
    var stepID = trackID+"-step"+j;
    var td = document.createElement("td");
    td.classList.add("step-td");
    var step = document.createElement("div");
    step.classList.add("step");
    step.classList.add("step"+j);
    step.classList.add(trackID);
    step.setAttribute("id",stepID);
    step.setAttribute("track",i);
    step.setAttribute("step",j);
    step.setAttribute("value",0);
    if(sound.type == "sampler") step.setAttribute("note",drumNotes[i]);
    else {
      var oct = 0;
      if(sound.params.oct) oct = sound.params.oct*12;
      step.setAttribute("note",48+oct);
    }
    step.addEventListener('mousedown', stepClick);
    step.addEventListener('mouseover', stepHover);
    var sw = document.createElement("div");
    var swColor = getColor(i);
    sw.setAttribute("color",swColor);
    sw.classList.add("sw");
    step.appendChild(sw);
    td.appendChild(step);
    var keyboard = createKeyboard(i,j, sound.params);
    td.appendChild(keyboard);
    var fader = createFader(i, j);
    td.appendChild(fader);
    tr.appendChild(td);
  }
  return(tr);
}

function createKeyboard (i, j, params) {
  var mid_octave = MID_OCTAVE;
  if(params.oct) mid_octave = params.oct;
  var trackID = "track"+i;
  var stepID = trackID+"-step"+j;
  //td.appendChild(document.createTextNode("Oct"));
  var keyboard = document.createElement("div");
  keyboard.setAttribute("track",trackID);
  keyboard.setAttribute("stepID",stepID);
  keyboard.classList.add("keyboard");
  keyboard.classList.add(trackID);
  keyboard.setAttribute("id",stepID+"kb");
  keyboard.setAttribute("octave",mid_octave);
  var oct = document.createElement("div");
  oct.classList.add("oct-controls");
  var plus = document.createElement("div");
  var minus = document.createElement("div");
  plus.classList.add("oct-button");
  minus.classList.add("oct-button");
  plus.setAttribute("direction","+");
  minus.setAttribute("direction","-");
  plus.appendChild(document.createTextNode("+"));
  minus.appendChild(document.createTextNode("-"));
  plus.setAttribute("stepID",stepID);
  minus.setAttribute("stepID",stepID);
  plus.setAttribute("id",stepID+"plus");
  minus.setAttribute("id",stepID+"minus");
  plus.addEventListener("mousedown",octaveClick);
  minus.addEventListener("mousedown",octaveClick);
  oct.appendChild(minus);
  oct.appendChild(plus);
  keyboard.appendChild(oct);
  var noteNumber;
  for(var k=0; k<12; k++) {
    noteNumber = 11-k;
    var key = document.createElement("div");
    key.classList.add("key");
    key.classList.add(stepID);
    key.setAttribute("note",noteNumber);
    key.setAttribute("stepID",stepID);
    key.addEventListener("mousedown", keyClick);
    if([1,3,5,8,10].includes(k)) {
      key.classList.add("black-key");
    }
    keyboard.appendChild(key);
  }
  keyboard.setNote = function(note) {
    var children = this.children;
    var stepID = this.getAttribute("stepID");
    var stepElem = document.getElementById(stepID);
    stepElem.setAttribute("note",note)
    var octave = (note-(note%12))/12;
    var butUp = document.getElementById(stepID+"plus");
    var butDown = document.getElementById(stepID+"minus");
    if(octave > mid_octave) butUp.style.backgroundColor = colors[1];
    else butUp.style.backgroundColor = "white";
    if(octave < mid_octave) butDown.style.backgroundColor = colors[1];
    else butDown.style.backgroundColor = "white";
    this.setAttribute("octave",octave);
    note -= (octave*12);
    for(var k=0; k<children.length; k++) {
      var childNote = parseInt(children[k].getAttribute("note"));
      if(childNote == note)
        children[k].classList.add("key-on");
      else
        children[k].classList.remove("key-on");
    }
  }
  keyboard.unsetNote = function() {
    var children = this.children;
    for(var k=0; k<children.length; k++) {
        children[k].classList.remove("key-on");
    }
    var butUp = document.getElementById(stepID+"plus");
    var butDown = document.getElementById(stepID+"minus");
    butUp.style.backgroundColor = "white";
    butDown.style.backgroundColor = "white";
  }
  return keyboard;
}

function keyClick(e) {
  var vel;
  if(this.classList.contains("key-on")) vel = 0;
  else vel = SYNTH_DEFAULT_VEL;
  var stepID = this.getAttribute("stepID");
  var kb = document.getElementById(stepID+"kb");
  var stepElem = document.getElementById(stepID);
  var note = parseInt(this.getAttribute("note")) + (12 * kb.getAttribute("octave"));
  updateStep(stepElem, note, vel, "keyClick");
}

function octaveClick(e) {
  var kb = this.parentNode.parentNode;
  var curOct = parseInt(kb.getAttribute("octave"));
  var stepID = this.getAttribute("stepID");
  var stepElem = document.getElementById(stepID);
  var note = parseInt(stepElem.getAttribute("note"));
  var direction = this.getAttribute("direction");
  if(direction == "+" && curOct < MAX_OCTAVE) {
    curOct++;
    kb.setAttribute("octave", curOct);
    note += 12;
    updateStep(stepElem, note, SYNTH_DEFAULT_VEL, "octUp");
  } else if(direction == "-" && curOct > MIN_OCTAVE) {
    curOct--;
    kb.setAttribute("octave", curOct);
    note -= 12;
    updateStep(stepElem, note, SYNTH_DEFAULT_VEL, "octDown");
  }
}

function createFader(i, j) {
  var trackID = "track"+i;
  var stepID = trackID+"-step"+j;
  var fader = document.createElement("input");
  fader.classList.add("fader");
  fader.classList.add(trackID);
  fader.setAttribute("type","range");
  fader.setAttribute("min","0");
  fader.setAttribute("max","127");
  fader.setAttribute("value","0");
  fader.setAttribute("track",trackID);
  fader.setAttribute("stepID",stepID);
  fader.setAttribute("id",stepID+"fader");
  fader.addEventListener("mouseup",faderDrag);
  fader.addEventListener("touchend",faderDrag);
  fader.addEventListener("input",faderWhileDragging);
  fader.addEventListener("mousemove",faderHover);
  return fader;
}

function stepClick(e) {
  var value = this.getAttribute("value");
  if(value == 0) {
      value = SYNTH_DEFAULT_VEL;
  } else {
      value = 0;
  }
  updateStep(this, false, value, "stepClick");
  mouseStepDownVal = value;
}

function stepHover(e) {
  if(e.buttons == 1 || e.buttons == 3) {
    value = mouseStepDownVal;
    updateStep(this, false, value, "stepHover");
  }
}

function faderDrag(e) {
  //if(!counting) counting = true;
  var stepID = this.getAttribute("stepID");
  var value = parseInt(this.value);
  var stepElem = document.getElementById(stepID);
  updateStep(stepElem, false, value, "faderDrag");
}

// From: https://stackoverflow.com/questions/62892560/change-the-value-of-input-range-when-hover-or-mousemove
var valueHover = 0;
function calcSliderPos(e) {
    return (e.offsetX / e.target.clientWidth) *  parseInt(e.target.getAttribute('max'),10);
}

function faderHover(e) {
  if(e.buttons == 1 || e.buttons == 3) {
    valueHover = Math.floor(calcSliderPos(e).toFixed(2));
    if(valueHover != this.value) {
      var step = document.getElementById(this.getAttribute("stepid"));
      updateStep(step, false, valueHover, "faderHover");
    }
  }
}

function faderWhileDragging(e) {
  var stepID = this.getAttribute("stepID");
  var value = parseInt(this.value);
  var stepElem = document.getElementById(stepID);
  var swColor = stepElem.firstChild.getAttribute("color");
  stepElem.firstChild.style.backgroundColor = valueToSWColor(value, swColor);
  stepElem.style.backgroundColor = valueToBGColor(value);
}

function updateStep(stepElem, note, value, action) {
  var oldValue = stepElem.getAttribute("value");
  var oldNote = stepElem.getAttribute("note");
  if(value != oldValue || ( note && note != oldNote) ) {
    if(!counting) counting = true;
    var track = stepElem.getAttribute("track");
    var fader = document.getElementById(stepElem.getAttribute("id") + "fader");
    var kb = document.getElementById(stepElem.getAttribute("id") + "kb");
    var step = stepElem.getAttribute("step");
    stepElem.setAttribute("value", value);
    if(note) {
      stepElem.setAttribute("note", note);
      kb.setNote(note);
    } else note = stepElem.getAttribute("note");
    fader.value = value;
    stepElem.style.backgroundColor = valueToBGColor(value);
    var swColor = stepElem.firstChild.getAttribute("color");
    stepElem.firstChild.style.backgroundColor = valueToSWColor(value, swColor);
    socket.emit('step update', { track: track, step: step, note: note, value: value, action: action, socketID: mySocketID } );
  }
}

function clearSteps(e) {
  var track = this.getAttribute("track");
  document.querySelectorAll(".step."+track).forEach(elem => {
    updateStep(elem, false, 0, "clearSteps");
  });
}

function showStepControls(e) {
  var track = this.getAttribute("track");
  var isSynth = this.parentNode.parentNode.classList.contains("synth-track");
  var selector = ".fader."+track;
  if(isSynth) selector = ".keyboard."+track;
  document.querySelectorAll(selector).forEach(elem => {
    if(elem.style.display == "block")
      elem.style.display = "none";
    else
      elem.style.display = "block";
  });
}

function valueToBGColor(value) {
  var tmp = 255 - value*2;
  return "rgb("+[tmp,tmp,tmp].join(",")+")";
}

function valueToSWColor(value, c) {
  if(value == 0)
    return "transparent";
  else
    return c;
}

function pad(num) {
  num = num.toString();
  while (num.length < 2) num = "0" + num;
  return num;
}


function playNote (note, out) {
  out.send([NOTE_ON, note, 0x7f]);
  setTimeout(out.send([NOTE_OFF, note, 0x00]), NOTE_DURATION);
}

// Language options:
function translate(lang, text) {
  var result = text;
  if (lang == "ES") {
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
      case "Hello":
        result = "Hola";
        break;
      case "The session will start in a bit.":
        result = "La sesión empezará en un momento."
        break;
      case "Sequencer disconnected!":
        result = "El secuenciador se ha desconectado!"
        break;
      case "No available tracks! Please wait a bit...":
        result = "No hay pistas disponibles! Por favor espera un poco..."
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


// Cookies, from: https://stackoverflow.com/questions/14573223/set-cookie-and-get-cookie-with-javascript
function setCookie(name, val, days) {
    var expires = "";
    if (days) {
        var date = new Date();
        date.setTime(date.getTime() + (days*24*60*60*1000));
        expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + (val || "")  + expires + "; path=/";
}
function getCookie(name) {
    var nameEQ = name + "=";
    var ca = document.cookie.split(';');
    for(var i=0;i < ca.length;i++) {
        var c = ca[i];
        while (c.charAt(0)==' ') c = c.substring(1,c.length);
        if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length,c.length);
    }
    return null;
}
function eraseCookie(name) {   
    document.cookie = name +'=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
}

// GET parameter access, from: https://stackoverflow.com/questions/5448545/how-to-retrieve-get-parameters-from-javascript

function findGetParameter(parameterName) {
  var result = null,
      tmp = [];
  location.search
      .substr(1)
      .split("&")
      .forEach(function (item) {
        tmp = item.split("=");
        if (tmp[0] === parameterName) result = decodeURIComponent(tmp[1]);
      });
  return result;
}

function copyURL(id) {
  var copyText = document.getElementById(id); /* Needs to be text area or input */
  copyText.select();
  copyText.setSelectionRange(0, 99999); /* For mobile devices */
  navigator.clipboard.writeText(copyText.value);
}

function enterFullscreen() {
  let elem = document.querySelector("body");

  if (!document.fullscreenElement) {
    elem.requestFullscreen().catch((err) => {
      alert(
        `Error attempting to enable fullscreen mode: ${err.message} (${err.name})`,
      );
    });
  }/* else {
    document.exitFullscreen();
  }*/
}