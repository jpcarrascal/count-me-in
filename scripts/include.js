const NUM_TRACKS = 8;
const NUM_STEPS = 16;
const NOTE_ON = 0x90;
const NOTE_OFF = 0x80;
const NOTE_DURATION = 300;
const DEFAULT_ROOM = 999;
colors = ["cyan","chartreuse","dodgerblue","darkorchid","magenta","red","orange","gold"];
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
notes = [36, 38, 39, 41, 43, 45, 42, 46];
onColor = "#444";
offColor = "white";

function createHeader(table) {
  // Header
  var tr = document.createElement("tr");
  var th = document.createElement("th");
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

function createTrack(i) {
    var tr = document.createElement("tr");
    var trackID = "track"+i;
    tr.setAttribute("id",trackID);
    tr.setAttribute("note",notes[i]);
    tr.classList.add("track");
    tr.style.backgroundColor = colors[i];

    var td = document.createElement("td");
    var img = document.createElement("img");
    img.setAttribute("src","images/"+i+".png");
    img.classList.add("track-icon");
    td.appendChild(img);
    td.classList.add("track-icon-td");
    tr.appendChild(td);

    td = document.createElement("td");
    var text = document.createTextNode("---");
    td.classList.add("track-name");
    td.setAttribute("id","track"+i+"-name");
    td.append(text);
    tr.appendChild(td);
    for(var j=0; j<NUM_STEPS; j++) {
      var td = document.createElement("td");
      var step = document.createElement("div");
      step.classList.add("step");
      step.classList.add("step"+j);
      step.classList.add(trackID);
      step.setAttribute("id",trackID+"-step"+j);
      step.setAttribute("track",i);
      step.setAttribute("step",j);
      step.setAttribute("value","0");
      step.addEventListener('click', stepClick);
      td.appendChild(step);
      tr.appendChild(td);
    }
    return(tr);
  }

  function stepClick(e) {
    var track = this.getAttribute("track");
    var step = this.getAttribute("step");
    var value = this.getAttribute("value");
    var sendValue = -1;
    if(value == 0) {
        this.setAttribute("value",1);
        this.style.backgroundColor = onColor;
        sendValue = 1;
    } else {
        this.setAttribute("value",0);
        this.style.backgroundColor = offColor;
        sendValue = 0;
    }
    console.log({ track: track, step: step, value: sendValue });
    socket.emit('step value', { track: track, step: step, value: sendValue } );
    }

  function cleartrack(track) {
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
