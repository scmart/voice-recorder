voice-recorder
==============

Version .1


Voice Recorder is built upon:

Wami Recorder (for Flash fallback)
https://code.google.com/p/wami-recorder/

and 

Recorderjs
https://github.com/mattdiamond/Recorderjs




Voice Recorder provides a simple voice recorder solution with a flash fallback for older browsers that don't support the Web Audo API's.  Voicerecorder requires the underscrore framework (you could remove that requirement with very little work if you dont already use underscore).  The was primarily designed to work with the Meteor framework, but it will work just fine anywhere.


To use Voice Recorder, include the following files:

<script type="text/javascript" src="recorderjs/recorder.js"></script>
<script type="text/javascript" src="wami/swfobject/swfobject.js"></script>
<script type="text/javascript" src="wami/recorder.js"></script>
<script type="text/javascript" src="voicerecord.js"></script>


Then create and setup a voicerecorder object:

var vr = new VoiceRecorder();

vr.setup();


Then you can start recording with:

vr.start();


And stop with:

vr.stop();


Voicerecorder passes the audio data back to a the callback onFinish, that can be configured in two ways:

First you can include the callback in a call to setup:

vr.setup({callbacks: {onFinish: function(data) {...}}});


second you can pass the callback to the start function:

vr.start({onFinish: function(data) {...}});

