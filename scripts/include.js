const NUM_TRACKS = config.NUM_TRACKS;
const NUM_STEPS = config.NUM_STEPS;
const MAX_NUM_ROUNDS = config.MAX_NUM_ROUNDS;

const NOTE_ON = 0x90;
const NOTE_OFF = 0x80;
const NOTE_DURATION = 300;
const DEFAULT_ROOM = 999;
const EMPTY_COLOR = "#AAA"
const colors = ["cyan","chartreuse","dodgerblue","darkorchid","magenta","red","orange","gold","black"];
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
const notes = [36, 38, 39, 41, 43, 45, 42, 46];
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

function createDrumTrack(i) {
  var tr = document.createElement("tr");
  var trackID = "track"+i;
  tr.setAttribute("id",trackID);
  tr.setAttribute("note",notes[i]);
  tr.classList.add("track");

  var td = document.createElement("td");
  var img = document.createElement("img");
  img.setAttribute("src","images/"+i+".png");
  img.setAttribute("track",trackID);
  img.classList.add("track-icon");
  img.addEventListener("click", showFaders);
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
    step.setAttribute("value","0");
    step.addEventListener('mousedown', stepClick);
    step.addEventListener('mouseover', stepHover);

    var sw = document.createElement("div");
    sw.setAttribute("color",colors[i]);
    sw.classList.add("sw");
    step.appendChild(sw);

    td.appendChild(step);
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
    td.appendChild(fader);
    tr.appendChild(td);
  }
  return(tr);
}

function stepClick(e) {
  var value = this.getAttribute("value");
  if(value == 0) {
      value = 63;
  } else {
      value = 0;
  }
  updateStep(this, value);
  mouseStepDownVal = value;
}

function stepHover(e) {
  if(e.buttons == 1 || e.buttons == 3) {
    value = mouseStepDownVal;
    updateStep(this, value);
  }
}

function faderDrag(e) {
  //if(!counting) counting = true;
  var stepID = this.getAttribute("stepID");
  var value = parseInt(this.value);
  var stepElem = document.getElementById(stepID);
  updateStep(stepElem, value);
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
      updateStep(step, valueHover);
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

function updateStep(stepElem, value) {
  var oldValue = stepElem.getAttribute("value");
  if(value != oldValue) {
    if(!counting) counting = true;
    var track = stepElem.getAttribute("track");
    var fader = document.getElementById(stepElem.getAttribute("id") + "fader");
    var step = stepElem.getAttribute("step");
    stepElem.setAttribute("value",value);
    fader.value = value;
    stepElem.style.backgroundColor = valueToBGColor(value);
    var swColor = stepElem.firstChild.getAttribute("color");
    stepElem.firstChild.style.backgroundColor = valueToSWColor(value, swColor);
    socket.emit('step value', { track: track, step: step, value: value, socketID: mySocketID } );
  }
}

function clearSteps(e) {
  var track = this.getAttribute("track");
  document.querySelectorAll(".step."+track).forEach(elem => {
    updateStep(elem, 0);
  });
}

function showFaders(e) {
  var track = this.getAttribute("track");
  document.querySelectorAll(".fader."+track).forEach(elem => {
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


// Cookies, from: https://stackoverflow.com/questions/14573223/set-cookie-and-get-cookie-with-javascript
function setCookie(name,value,days) {
    var expires = "";
    if (days) {
        var date = new Date();
        date.setTime(date.getTime() + (days*24*60*60*1000));
        expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + (value || "")  + expires + "; path=/";
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
