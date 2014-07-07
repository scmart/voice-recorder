(function(window){

	var WORKER_PATH = 'recorderWorker.js';
	
	var Recorder = function(source, cfg){
		var config = cfg || {};
		var bufferLen = config.bufferLen || 4096;
		this.context = source.context;
		this.node = (this.context.createScriptProcessor ||
					 this.context.createJavaScriptNode).call(this.context,
															 bufferLen, 2, 2);
		
		
		// build the worker here rather than an external file for better 
		// support for frameworks like Meteor
		var blobURL = URL.createObjectURL(
			new Blob([ '(',
					   function(){
						   var recLength = 0,
						   recBuffersL = [],
						   recBuffersR = [],
						   sampleRate;
						   
						   this.onmessage = function(e){
							   switch(e.data.command){
							   case 'init':
								   init(e.data.config);
								   break;
							   case 'record':
								   record(e.data.buffer);
								   break;
							   case 'exportWAV':
								   exportWAV(e.data.type);
								   break;
							   case 'getBuffer':
								   getBuffer();
								   break;
							   case 'clear':
								   clear();
								   break;
							   }
						   };

						   function init(config){
							   sampleRate = config.sampleRate;
						   }

						   function record(inputBuffer){
							   recBuffersL.push(inputBuffer[0]);
							   recBuffersR.push(inputBuffer[1]);
							   recLength += inputBuffer[0].length;
						   }

						   function exportWAV(type){
							   var bufferL = mergeBuffers(recBuffersL, recLength);
							   var bufferR = mergeBuffers(recBuffersR, recLength);
							   var interleaved = interleave(bufferL, bufferR);
							   var dataview = encodeWAV(interleaved);
							   var audioBlob = new Blob([dataview], { type: type });

							   this.postMessage(audioBlob);
						   }

						   function getBuffer() {
							   var buffers = [];
							   buffers.push( mergeBuffers(recBuffersL, recLength) );
							   buffers.push( mergeBuffers(recBuffersR, recLength) );
							   this.postMessage(buffers);
						   }

						   function clear(){
							   recLength = 0;
							   recBuffersL = [];
							   recBuffersR = [];
						   }

						   function mergeBuffers(recBuffers, recLength){
							   var result = new Float32Array(recLength);
							   var offset = 0;
							   for (var i = 0; i < recBuffers.length; i++){
								   result.set(recBuffers[i], offset);
								   offset += recBuffers[i].length;
							   }
							   return result;
						   }

						   function interleave(inputL, inputR){
							   var length = inputL.length + inputR.length;
							   var result = new Float32Array(length);

							   var index = 0,
							   inputIndex = 0;

							   while (index < length){
								   result[index++] = inputL[inputIndex];
								   result[index++] = inputR[inputIndex];
								   inputIndex++;
							   }
							   return result;
						   }

						   function floatTo16BitPCM(output, offset, input){
							   for (var i = 0; i < input.length; i++, offset+=2){
								   var s = Math.max(-1, Math.min(1, input[i]));
								   output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
							   }
						   }

						   function writeString(view, offset, string){
							   for (var i = 0; i < string.length; i++){
								   view.setUint8(offset + i, string.charCodeAt(i));
							   }
						   }

						   function encodeWAV(samples){
							   var buffer = new ArrayBuffer(44 + samples.length * 2);
							   var view = new DataView(buffer);

							   /* RIFF identifier */
							   writeString(view, 0, 'RIFF');
							   /* file length */
							   view.setUint32(4, 32 + samples.length * 2, true);
							   /* RIFF type */
							   writeString(view, 8, 'WAVE');
							   /* format chunk identifier */
							   writeString(view, 12, 'fmt ');
							   /* format chunk length */
							   view.setUint32(16, 16, true);
							   /* sample format (raw) */
							   view.setUint16(20, 1, true);
							   /* channel count */
							   view.setUint16(22, 2, true);
							   /* sample rate */
							   view.setUint32(24, sampleRate, true);
							   /* byte rate (sample rate * block align) */
							   view.setUint32(28, sampleRate * 4, true);
							   /* block align (channel count * bytes per sample) */
							   view.setUint16(32, 4, true);
							   /* bits per sample */
							   view.setUint16(34, 16, true);
							   /* data chunk identifier */
							   writeString(view, 36, 'data');
							   /* data chunk length */
							   view.setUint32(40, samples.length * 2, true);

							   floatTo16BitPCM(view, 44, samples);

							   return view;
						   }
					   }.toString(),
					   ')()' ],
					 {type: 'application/javascript'} ));


		var worker = new Worker(blobURL);
		worker.postMessage({
			command: 'init',
			config: {
				sampleRate: this.context.sampleRate
			}
		});
		var recording = false,
		currCallback;

		this.node.onaudioprocess = function(e){
			if (!recording) return;
			worker.postMessage({
				command: 'record',
				buffer: [
					e.inputBuffer.getChannelData(0),
					e.inputBuffer.getChannelData(1)
				]
			});
		}

		this.configure = function(cfg){
			for (var prop in cfg){
				if (cfg.hasOwnProperty(prop)){
					config[prop] = cfg[prop];
				}
			}
		}

		this.record = function(){
			recording = true;
		}

		this.stop = function(){
			recording = false;
		}

		this.clear = function(){
			worker.postMessage({ command: 'clear' });
		}

		this.getBuffer = function(cb) {
			currCallback = cb || config.callback;
			worker.postMessage({ command: 'getBuffer' })
		}

		this.exportWAV = function(cb, type){
			currCallback = cb || config.callback;
			type = type || config.type || 'audio/wav';
			if (!currCallback) throw new Error('Callback not set');
			worker.postMessage({
				command: 'exportWAV',
				type: type
			});
		}

		this.playBuffer = function(loc, onEnd) {
			loc = loc || 0;
			var audioContext = new AudioContext();
			var newSource = audioContext.createBufferSource();
			this._currentBufferSource = newSource;

			this.getBuffer(_.bind(function(buffers) {
				var newBuffer = audioContext.createBuffer( 2, buffers[0].length, audioContext.sampleRate );
				newBuffer.getChannelData(0).set(buffers[0]);
				newBuffer.getChannelData(1).set(buffers[1]);
				newSource.buffer = newBuffer;

				newSource.onended = onEnd;
				newSource.connect( audioContext.destination );
				if (!newSource.start)
					newSource.start = newSource.noteOn;
				newSource.start(loc);
				this._currentBufferSource = newSource;
				console.log(newSource);
			}), this);
		}

		this.pauseBuffer = function() {
			var source = this._currentBufferSource;
			if (source) {
				if (!source.stop)
					source.stop = source.noteOff;
				console.log(source.stop());
				//this._currentBufferSource = null;
			}
			console.log(source);
		}

		this._playingAudioSource;

		this.playWAV = function(context, wav, loc) {
			loc = loc || 0;
			if (this._playingAudioSource) {
				this._playingAudioSource.start(loc);
			} else {
				var newSource = context.createBufferSource();
				context.decodeAudioData(window.URL.createObjectURL(wav), _.bind(function(buffer) {
					newSource.buffer = buffer;
					if (!newSource.start)
						newSource.start = newSource.noteOn;
					newSource.connect(context.destination);
					newSource.start(loc);
					this._playingAudioSource = newSource;
				}, this));
			}
		}
	
		this.pauseWAV = function(context) {
			var curSource = this._playingaudioSource;
			var time = context.currentTime;
			if (curSource) {
				if (!curSource.stop)
					curSource.stop = curSource.noteOff;
				curSource.stop();
				return time;
			}
		}

		worker.onmessage = function(e){
			var blob = e.data;
			currCallback(blob);
		}

		source.connect(this.node);
		this.node.connect(this.context.destination);    //this should not be necessary
	};

	Recorder.forceDownload = function(blob, filename){
		var url = (window.URL || window.webkitURL).createObjectURL(blob);
		var link = window.document.createElement('a');
		link.href = url;
		link.download = filename || 'output.wav';
		var click = document.createEvent("Event");
		click.initEvent("click", true, true);
		link.dispatchEvent(click);
	}

	window.Recorder = Recorder;

})(window);
