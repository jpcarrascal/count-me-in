var promptContainer = document.getElementById("prompt-container");
var emojiContainer = document.getElementById("emoji-container")

setTimeout(function(){
  document.getElementById("restart").style.display = "none";
  document.getElementById("expert-controls").style.display = "none";

  var isSynth = document.querySelectorAll(".synth-track").length;
  console.log(isSynth);
  if(isSynth > 0) {
    emojiContainer.style.display = "block";
    promptContainer.style.display = "none";
  } else {
    emojiContainer.style.display = "none";
    promptContainer.style.display = "block";
  }
  
}, 500);



// Create the grid
const rows = 7;
const cols = 7;
const minV = -1;
const maxV = 1;
const stepV = (maxV - minV) / (cols - 1);
const maxA = 1;
const minA = -1;
const stepA = (maxA - minA) / (rows - 1);

const table = document.getElementById('grid');
for (let r = 0; r < rows; r++) {
    const row = table.insertRow();
    for (let c = 0; c < cols; c++) {
        const cell = row.insertCell();
        const vValue = (minV + c * stepV).toFixed(2);
        const aValue = (maxA - r * stepA).toFixed(2);
        cell.className = 'grid-cell';
        cell.setAttribute('v', c);
        cell.setAttribute('a', rows-r-1);
        //cell.textContent = `v:${vValue}, a:${aValue}`;
        if(r == 3 || c == 3) {
            cell.classList.add('axis');
            cell.style.backgroundColor = "rgba(255, 255, 255, 0.4)";
        }
        if(r == 0 && c == 0) {
            cell.textContent = '😩';
        } else if(r == 0 && c == 6) {
            cell.textContent = '🤩 ';
        } else if(r == 3 && c == 3) {
            cell.textContent = '😐';
        } else if(r == 6 && c == 0) {
            cell.textContent = '🙁';
        } else if(r == 6 && c == 6) {
            cell.textContent = '🙂';
        }
    }
}

var gridCell = document.querySelectorAll('.grid-cell');
var grid = document.querySelector('#grid');
var emojiTable = document.querySelector('#emojis');
var preload = document.querySelector('#pre-loader');

gridCell.forEach(cell => {
    cell.addEventListener('mouseup', function(){
        grid.style.display = 'none';
        preload.style.display = 'flex';
        gridCell.forEach(emoji => {
            emoji.classList.remove('selected');
            emoji.style.backgroundColor = "rgba(255, 255, 255, 0.3)";
            if(emoji.classList.contains('axis')) {
                emoji.style.backgroundColor = "rgba(255, 255, 255, 0.4)";
            }
        });
        const v = cell.getAttribute('v');
        const a = cell.getAttribute('a');
        const data = {'v': v, 'a': a};
        //sendMsg('emotion', data);
        //fetch('https://raw.githubusercontent.com/jpcarrascal/count-me-in/refs/heads/main/experiments/data.txt')
        //fetch('http://localhost:3000/randommock')
        //fetch('https://count-me-in.azurewebsites.net/randommock')
        fetch('/randommock?v=' + v + '&a=' + a)
          .then(response => response.text())
          .then(data => {console.log(data)
            cell.classList.add('selected');
            cell.style.backgroundColor = myColor;
            //var newNotes = randomizeNotes(myNotes);
            var newNotes = updateNotes(myNotes, JSON.parse(data));
            //var scale = determineTonality(newNotes);
            //newNotes = transposeMelody(newNotes, scale, "C_major");
            //console.log(newNotes);
            var track = myTrack;
            socket.emit('update all track notes', { track: track, socketid: mySocketID, notes: newNotes } );
            grid.style.display = 'block';
            preload.style.display = 'none';
          })
          .catch(error => console.error('Error:', error));
    });

    var tmpColor;

    cell.addEventListener('mouseover', function(){
      tmpColor = cell.style.backgroundColor;
      if(cell.classList.contains('selected')) {
        cell.style.backgroundColor = "rgba(0, 0, 0, 0.2)";
      } else
        cell.style.backgroundColor = "rgba(255, 255, 255, 0.5)";
    });

    cell.addEventListener('mouseout', function(){
      cell.style.backgroundColor = tmpColor;
    });
    
});

function randomizeNotes(notes) {
    for(var i=0; i<notes.length; i++) {
      if(Math.random() > 0.5) {
        notes[i].note = Math.floor(Math.random() * 80) + 20;
      }
      if(Math.random() > 0.5) notes[i].vel = 100;
        else notes[i].vel = 0;
    }
    return notes;
}

function updateNotes(notes, array) {
    for(var i=0; i<notes.length; i++) {
      if(array[i] > 0) {
        notes[i].note = array[i];
        notes[i].vel = 100;
      } else {
        notes[i].note = 0;
        notes[i].vel = 0;
      }
    }
    return notes;
}


document.querySelector("#prompt-submit").addEventListener('click', function(){
  var prompt = document.querySelector("#prompt");
  if(prompt.value != "") {
    socket.emit('reload my sample', { track: myTrack, socketid: mySocketID, value: prompt.value } );
    prompt.value = "";
    prompt.setAttribute("placeholder", "Thanks! prompt sent. Another one?");
  } else {
    prompt.setAttribute("placeholder", "Don't be shy, type a prompt!!!");
    console.log(prompt.getAttribute("placeholder"));
  }
});