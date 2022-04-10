**Count-Me-In** is a collaborative music sequencer that uses a distributed Web architecture to promote audience participation in music performances, installations, and other similar contexts. Audience members take control of individual sequencer tracks using their mobile phones (or any networked device), collaboratively building a music loop or phrase. This dialog represents a disruption in the traditional role played by the audience in a music performance: instead of being passive listeners, attendees become active performers.

Count-Me-In features a music sequencer that can be synchronized with any DAW or hardware device that generates MIDI Clock messages.

![image](https://user-images.githubusercontent.com/1902661/160303272-272b6496-3829-451b-bb03-e5f96321e3b2.png)
*A Count-Me-In session.*

## Architecture

Count-Me-In uses a distributed cloud architecture featuring a cloud-based back-end server (running Node.js, Express and Socket.io) and two types of Web applications.

![architecture-website](https://user-images.githubusercontent.com/1902661/162585332-9b5872bb-2805-4133-95da-a5eb153dd4e7.jpg) 
*Count-Me-In architecture.*

The Web applications are:

![image](https://user-images.githubusercontent.com/1902661/162634895-5c6fa649-5f65-4982-9f90-277f49dcd841.png)
*Left to right: the Sequencer, the Drum Track app, the Synth Track app.*


* __The Sequencer__ should be run on an "Orchestration" computer and its user interface is meant to be displayed on a large screen for the audience. The Sequencer app also does all the audio rendering, so the audio output of the Orchestration computer should be amplified. The Sequencer features 10 tracks and 16 steps by default (these parameters can be easily configured). It also includes Play and Stop buttons, Tempo value in beats per minute, a selector to switch between internal or external sounds, and a button to display the current session information. Session information helps participants connecting to the session by means of a QR code. 


* __The Track__ applications run on each participant's device (mobile phone, tablets, computers, etc.). They can be either Drum or Synth tracks. The former features 16 switches to turn individual steps on or off, and 16 slider controls to adjust the velocity of each step. The Synth Track features a 1-octave keyboard per step centered at the C2-B2 octave (C2 = 65.41Hz), with switches to transpose an octave up or down.

Count-Me-In can be synchronized to any DAW or hardware sequencer capable of generating MIDI Clock messages. It can also be configured to send note output to an external MIDI device. A typical scenario comprises a DAW generating a master MIDI clock and several MIDI tracks. Transport is controlled from the DAW, with the Count-Me-In sequencer synched to follow the DAW and sending MIDI note data to the DAW's MIDI tracks. A performer controls the DAWs, while MIDI notes from Count-Me-In depend on the interactions from audience participants.


