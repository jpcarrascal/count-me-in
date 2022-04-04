if (navigator.requestMIDIAccess) {
  console.log('Browser supports MIDI. Yay!');
  navigator.requestMIDIAccess().then(success, failure);
}

function success(midi) {
    var outList = document.getElementById("select-midi-out");
    var inList  = document.getElementById("select-midi-in");
    var chList  = document.getElementById("select-midi-channel");
    var selectedOut = getCookie("MIDIout");
    var selectedIn  = getCookie("MIDIin");
    var selectedCh = getCookie("MIDIch");
    var outputs = midi.outputs.values();
    var inputs  = midi.inputs.values();
    var numOuts = 0;
    var numIns  = 0;
    // outputs is an Iterator
    if(selectedCh) chList.value = selectedCh;

    for (var output = outputs.next(); output && !output.done; output = outputs.next()) {
        var option = document.createElement("option");
        option.value = output.value.id;
        option.text = output.value.name;
        if(selectedOut == output.value.id) option.selected = true;
        outList.appendChild(option);
        numOuts++;
    }

    for (var input = inputs.next(); input && !input.done; input = inputs.next()) {
        var option = document.createElement("option");
        option.value = input.value.id;
        option.text = input.value.name;
        if(selectedIn == input.value.id) option.selected = true;
        inList.appendChild(option);
        numIns++;
    }
    
    outList.addEventListener("change", function(e) {
        if(this.value != 0) {
            console.log("MIDI out: " + this.options[this.selectedIndex].text + " selected.");
            setCookie("MIDIout",this.value,1000);
        } else {
            console.log("Internal sounds selected.");
            setCookie("MIDIout",0,1000);
        }
    });

    inList.addEventListener("change", function(e) {
        if(this.value != 0) {
            console.log("MIDI clock in: " + this.options[this.selectedIndex].text + " selected.");
            setCookie("MIDIin",this.value,1000);
        } else {
            console.log("Internal clock selected.");
            setCookie("MIDIin",0,1000);
        }
    });

    chList.addEventListener("change", function(e) {
        console.log("MIDI channel: " + this.options[this.selectedIndex].text);
        setCookie("MIDIch",this.value,1000);
    });

    if(numOuts == 0) {
        console.log("No MIDI OUT devices found...");
        setCookie("MIDIout",0,1000);
    }

    if(numIns == 0) {
        console.log("No MIDI IN devices found...");
        setCookie("MIDin",0,1000);
    }
}

function failure(){ console.log("MIDI not supported :(")};
