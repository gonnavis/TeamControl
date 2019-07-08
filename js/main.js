'use strict';

var isChannelReady = false;
var isInitiator = false;
var isStarted = false;
var localStream;
var pc;
var remoteStream;
var maxBandwidth=64
var isControllee = location.href.indexOf('controllee') >= 0
 var mediaConstraints = {
   'mandatory': {
     'OfferToReceiveAudio': true,
     'OfferToReceiveVideo': true
   }
 };

var pcConfig = {
  'iceServers': [{
      'urls': 'stun:stun.l.google.com:19302'
    },
    {
      'urls': 'turn:numb.viagenie.ca@gonnavis@gmail.com',
      'credential': 'WebRTC',
    }
  ]
};

/////////////////////////////////////////////

var room = prompt('Enter room name:');

var socket = io.connect();

if (room !== '') {
  socket.emit('create or join', room);
  console.log('Attempted to create or  join room', room);
}

socket.on('created', function (room) {
  console.log('Created room ' + room);
  isInitiator = true;
});

socket.on('full', function (room) {
  console.log('Room ' + room + ' is full');
});

socket.on('join', function (room) {
  console.log('Another peer made a request to join room ' + room);
  console.log('This peer is the initiator of room ' + room + '!');
  isChannelReady = true;
});

socket.on('joined', function (room) {
  console.log('joined: ' + room);
  isChannelReady = true;
});

socket.on('log', function (array) {
  console.log.apply(console, array);
});

////////////////////////////////////////////////

function sendMessage(message) {
  console.log('Client sending message: ', message);
  socket.emit('message', message);
}

// This client receives a message
socket.on('message', function (message) {
  console.log('Client received message:', message);
  if (message === 'got user media') {
    maybeStart();
  } else if (message.type === 'offer') {
    if (!isInitiator && !isStarted) {
      maybeStart();
    }
    let sessionDescription=new RTCSessionDescription(message)
    pc.setRemoteDescription({
      type: sessionDescription.type,
      sdp: updateBandwidthRestriction(sessionDescription.sdp, maxBandwidth)
    });
    doAnswer();
  } else if (message.type === 'answer' && isStarted) {
    let sessionDescription= new RTCSessionDescription(message)
    pc.setRemoteDescription({
      type: sessionDescription.type,
      sdp: updateBandwidthRestriction(sessionDescription.sdp, maxBandwidth)
    });
  } else if (message.type === 'candidate' && isStarted) {
    var candidate = new RTCIceCandidate({
      sdpMLineIndex: message.label,
      candidate: message.candidate
    });
    pc.addIceCandidate(candidate);
  } else if (message === 'bye' && isStarted) {
    handleRemoteHangup();
  }
});

////////////////////////////////////////////////////

var localVideo = document.querySelector('#localVideo');
var remoteVideo = document.querySelector('#remoteVideo');

if (isControllee) {
  getScreenStream()
    .then(gotStream)
    .catch(function (e) {
      console.log('getUserMedia() error: ' + e.name);
    });
} else {
  // createPeerConnection();
  navigator.mediaDevices.getUserMedia({
      audio: false,
      video: true
    })
    .then(gotStream)
    .catch(function (e) {
      console.log('getUserMedia() error: ' + e.name);
    });
}

function getScreenStream() {
  if (navigator.getDisplayMedia) {
    return navigator.getDisplayMedia({
      video: true
    });
  } else if (navigator.mediaDevices.getDisplayMedia) {
    return navigator.mediaDevices.getDisplayMedia({
      video: true
    });
  } else {
    return navigator.mediaDevices.getUserMedia({
      video: {
        mediaSource: 'screen'
      }
    });
  }
}

function gotStream(stream) {
  console.log('Adding local stream.');
  localStream = stream;
  localVideo.srcObject = stream;
  sendMessage('got user media');
  if (isInitiator) {
    maybeStart();
  }
}

function maybeStart() {
  console.log('>>>>>>> maybeStart() ', isStarted, localStream, isChannelReady);
  if (!isStarted && typeof localStream !== 'undefined' && isChannelReady) {
    console.log('>>>>>> creating peer connection');
    createPeerConnection();
    pc.addStream(localStream);
    isStarted = true;
    console.log('isInitiator', isInitiator);
    if (isInitiator) {
      doCall();
    }
  }
}

window.onbeforeunload = function () {
  sendMessage('bye');
};

/////////////////////////////////////////////////////////

function createPeerConnection() {
  try {
    pc = new RTCPeerConnection(null);
    pc.onicecandidate = handleIceCandidate;
    pc.onaddstream = handleRemoteStreamAdded;
    pc.onremovestream = handleRemoteStreamRemoved;
    console.log('Created RTCPeerConnnection');
  } catch (e) {
    console.log('Failed to create PeerConnection, exception: ' + e.message);
    console.log('Cannot create RTCPeerConnection object.');
    return;
  }
}

function handleIceCandidate(event) {
  console.log('icecandidate event: ', event);
  if (event.candidate) {
    sendMessage({
      type: 'candidate',
      label: event.candidate.sdpMLineIndex,
      id: event.candidate.sdpMid,
      candidate: event.candidate.candidate
    });
  } else {
    console.log('End of candidates.');
  }
}

function handleCreateOfferError(event) {
  console.log('createOffer() error: ', event);
}

function doCall() {
  console.log('Sending offer to peer');
  pc.createOffer(mediaConstraints).then(
    setLocalAndSendMessage,
    onCreateSessionDescriptionError
  );
}

function doAnswer() {
  console.log('Sending answer to peer.');
  pc.createAnswer(mediaConstraints).then(
    setLocalAndSendMessage,
    onCreateSessionDescriptionError
  );
}

function setLocalAndSendMessage(sessionDescription) {
  // Set Opus as the preferred codec in SDP if Opus is present.
  sessionDescription.sdp = preferOpus(sessionDescription.sdp);
  pc.setLocalDescription(sessionDescription);
  console.log('setLocalAndSendMessage sending message', sessionDescription);
  sendMessage(sessionDescription);
}

function onCreateSessionDescriptionError(error) {
  trace('Failed to create session description: ' + error.toString());
}

function handleRemoteStreamAdded(event) {
  console.log('Remote stream added.');
  remoteStream = event.stream;
  remoteVideo.srcObject = remoteStream;
}

function handleRemoteStreamRemoved(event) {
  console.log('Remote stream removed. Event: ', event);
}

function hangup() {
  console.log('Hanging up.');
  stop();
  sendMessage('bye');
}

function handleRemoteHangup() {
  console.log('Session terminated.');
  stop();
  isInitiator = false;
}

function stop() {
  isStarted = false;
  pc.close();
  pc = null;
}



function updateBandwidthRestriction(sdp, bandwidth) {
  let modifier = 'AS';
  if (adapter.browserDetails.browser === 'firefox') {
    bandwidth = (bandwidth >>> 0) * 1000;
    modifier = 'TIAS';
  }
  if (sdp.indexOf('b=' + modifier + ':') === -1) {
    // insert b= after c= line.
    sdp = sdp.replace(/c=IN (.*)\r\n/, 'c=IN $1\r\nb=' + modifier + ':' + bandwidth + '\r\n');
  } else {
    sdp = sdp.replace(new RegExp('b=' + modifier + ':.*\r\n'), 'b=' + modifier + ':' + bandwidth + '\r\n');
  }
  return sdp;
}

  // Set Opus as the default audio codec if it's present.
  function preferOpus(sdp) {
    var sdpLines = sdp.split('\r\n');

    // Search for m line.
    for (var i = 0; i < sdpLines.length; i++) {
      if (sdpLines[i].search('m=audio') !== -1) {
        var mLineIndex = i;
        break;
      }
    }
    if (mLineIndex === null)
      return sdp;

    // If Opus is available, set it as the default in m line.
    for (var i = 0; i < sdpLines.length; i++) {
      if (sdpLines[i].search('opus/48000') !== -1) {
        var opusPayload = extractSdp(sdpLines[i], /:(\d+) opus\/48000/i);
        if (opusPayload)
          sdpLines[mLineIndex] = setDefaultCodec(sdpLines[mLineIndex], opusPayload);
        break;
      }
    }

    // Remove CN in m line and sdp.
    sdpLines = removeCN(sdpLines, mLineIndex);

    sdp = sdpLines.join('\r\n');
    return sdp;
  }

  function extractSdp(sdpLine, pattern) {
    var result = sdpLine.match(pattern);
    return (result && result.length == 2) ? result[1] : null;
  }

  // Set the selected codec to the first in m line.
  function setDefaultCodec(mLine, payload) {
    var elements = mLine.split(' ');
    var newLine = new Array();
    var index = 0;
    for (var i = 0; i < elements.length; i++) {
      if (index === 3) // Format of media starts from the fourth.
        newLine[index++] = payload; // Put target payload to the first.
      if (elements[i] !== payload)
        newLine[index++] = elements[i];
    }
    return newLine.join(' ');
  }

  // Strip CN from sdp before CN constraints is ready.
  function removeCN(sdpLines, mLineIndex) {
    var mLineElements = sdpLines[mLineIndex].split(' ');
    // Scan from end for the convenience of removing an item.
    for (var i = sdpLines.length - 1; i >= 0; i--) {
      var payload = extractSdp(sdpLines[i], /a=rtpmap:(\d+) CN\/\d+/i);
      if (payload) {
        var cnPos = mLineElements.indexOf(payload);
        if (cnPos !== -1) {
          // Remove CN payload from m line.
          mLineElements.splice(cnPos, 1);
        }
        // Remove CN line in sdp
        sdpLines.splice(i, 1);
      }
    }

    sdpLines[mLineIndex] = mLineElements.join(' ');
    return sdpLines;
  }