  // MIDI Stuff:
  var MIDIport = null;
  if (navigator.requestMIDIAccess) {
    console.log('Browser supports MIDI!');
    navigator.requestMIDIAccess().then(success, failure);
  }

  function success(midi) {
    var selectList = document.getElementById("device-select");
    selectList.addEventListener("change", function(e) {
      if(this.value != 0) {
        MIDIport = midi.outputs.get(this.value);
        console.log(MIDIport.name + " selected.");
        setCookie("MIDIdevice",this.value,1000);
      } else {
        MIDIport = null;
        console.log("Internal sounds selected.");
        setCookie("MIDIdevice",0,1000);
      }
    });
    var selectedDevice = getCookie("MIDIdevice");
    var outputs = midi.outputs.values();
    var numDevices = 0;
    // outputs is an Iterator
    for (var output = outputs.next(); output && !output.done; output = outputs.next()) {
        var option = document.createElement("option");
        option.value = output.value.id;
        option.text = output.value.name;
        if(selectedDevice == output.value.id) option.selected = true;
        selectList.appendChild(option);
        numDevices++;
    }
    let changeEvent = new Event('change');
    selectList.dispatchEvent(changeEvent);

    if(numDevices == 0) {
      console.log("No MIDI devices found...");
      /*
      var option = document.createElement("option");
      option.value = "";
      option.text = "No MIDI devices found...";
      selectList.appendChild(option);
      */
    }
  }
  function failure(){ console.log("MIDI not supported :(")};

  function MIDIplayNote (note, vel, out) {
    out.send([NOTE_ON, note, vel]);
    setTimeout(out.send([NOTE_OFF, note, 0x00]), NOTE_DURATION);
  }