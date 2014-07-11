(function(window, _) {
	var VoiceRecorder = function() {
		this._sampleRate = 16000;
		this._flashSetupParams = {
			id: 'flashRecorder',
			swfUrl: 'wami/Wami.swf'
		};
		this._flashParams = {
			sampleRate: this._sampleRate,
			passBack: true
		};

		this._callbacks = {
			onReady: null,
			onStart: null,
			onFinish: null,
			onError: null
		};
		
		this._flashReady = false;
		this._flash = window.Wami;

		this._recording = false;
	};

	VoiceRecorder.prototype.setup = function(params) {
		var useFlash = this._useFlash;

		//test for and shim for webkit native audio support
		window.AudioContext = window.AudioContext || window.webkitAudioContext;
		navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;
 
		if (window.AudioContext && navigator.getUserMedia) {
			useFlash = false;
		} else {
			useFlash = true;
		}

		if (params) {
			if (params.callbacks) {
				_.extend(this._callbacks, params.callbacks);
			}
			if (params.flashDiv) {
				_.extend(this._flashSetupParams, {
					id: params.flashDiv
				});
			}
			if (params.flashURL) {
				_.extend(this._flashSetupParams, {
					swfUrl: params.flashURL
				});
			}
			if (params.forceNative) {
				useFlash = false;
			}
			if (params.forceFlash) {
				useFlash = true;
			}
			if (params.flashParams) {
				_.extend(this._flashParams, params.flashParams);
			}
			if (params.sampleRate) {
				this._sampleRate = params.sampleRate;
				this._flashParams.sampleRate = params.sampleRate;
			}
			if (params.onReady) {
				this._callbacks.onReady = params.onReady;
			}
		}

		if (this._useFlash) {
			if (!useFlash) {
				//switch to not using flash
				//in case we are switching from flash to not
				this._flashReady = false;
				this._flash.cleanup();

				this._useFlash = false;

				this._setupNative();
			}
		} else {
			if (useFlash) {
				// setup flash, was previously native
				var postSetup = _.bind(function(){
					this._flash.setSettings(this._flashParams);
					this._useFlash = true;
					this._flashReady = true;
					if (this._callbacks.onReady) {
						this._callbacks.onReady();
					}
				}, this);
				
				this._flash.setup(_.extend(this._flashSetupParams, {
					onReady: postSetup
				}));
								  
			} else {
				// first time setup for native audio
				this._setupNative();
				this._useFlash = false;
				if (this._callbacks.onReady) {
					this._callbacks.onReady();
				}
			}
		}
	};

	VoiceRecorder.prototype._setupNative = function() {
		//the following call will prompt the user to allow
		if (this._callbacks.onAccessDialogOpen) {
			this._callbacks.onAccessDialogOpen();
		}
		navigator.getUserMedia({audio: true}, _.bind(function(stream) {
			if (this._callbacks.onAccessDialogAccepted) {
				this._callbacks.onAccessDialogAccepted();
			}
			//setup native recording
			if (!this._native_audio_context) {
				this._native_audio_context = new AudioContext();
			}
			var input = this._native_audio_context.createMediaStreamSource(stream);
			//input.connect(audio_context.destination);
			this._native = new Recorder(input);
		}, this), _.bind(function(e) {
			//denied
			if (this._callbacks.onAccessDialogDenied) {
				this._callbacks.onAccessDialogDenied();
			}
			console.log(e);
		}, this));
	};

	VoiceRecorder.prototype.playBuffer = function(loc, onEnd) {
		if (this._useFlash) {
		} else {
			this._native.playBuffer(loc, onEnd);
		}
	};

	VoiceRecorder.prototype.pauseBuffer = function() {
		if (this._useFlash) {
		} else {
			var temp = this._native.pauseBuffer();
		}
		console.log(temp);
	};

	VoiceRecorder.prototype._decode64 = function() {
		
	};

	VoiceRecorder.prototype.start = function(callbacks) {
		if (callbacks) {
			_.extend(this._callbacks, callbacks);
		}
		if (!this._recording) {
			if (this._useFlash) {
				if (this._flashReady) {
					var Wami = this._flash;
					Wami.startRecording("",
										Wami.nameCallback(this._callbacks.onStart),
										Wami.nameCallback(_.bind(function(data) {
											// setup conversion to wav file here
											var audioObj = {};
											audioObj.data = data[0];
											audioObj.length = 500;
											this._callbacks.onFinish(audioObj);
										},this)),
										Wami.nameCallback(this._callbacks.onError)
									   );
					this._recording = true;
				}
			} else {
				if (this._native) {
					this._native.clear();
					this._native.record();
					this._recording = true;
					if (this._callbacks.onStart) {
						this._callbacks.onStart();
					}
				}
			}
		}
	};

	VoiceRecorder.prototype.stop = function() {
		var callback = this._callback;
		if (this._recording) {
			if (this._useFlash) {
				this._flash.stopRecording();
				this._recording = false;
			} else {
				this._native.stop();
				this._recording = false;
				this._native.exportWAV(_.bind(function(data) {
					var audioObj = {};
					audioObj.length = 500;
					var reader = new FileReader();
					var self = this;
					reader.addEventListener("loadend", function() {
						// want to remove this -- data:audio/wav;base64
						audioObj.data = reader.result.slice(22);
						self._callbacks.onFinish(audioObj);
					});
					reader.readAsDataURL(data);
				}, this));
			}
		}
	};
	window.VoiceRecorder = VoiceRecorder;
})(window, _);
