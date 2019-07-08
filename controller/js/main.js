'use strict';

var isChannelReady = false;
var isInitiator = false;
var isStarted = false;
var localStream;
var pc;
var remoteStream;
// var maxBandwidth = 64
var videoWidth = 1024
var isControllee = location.href.indexOf('controllee') >= 0
var dataSendChannel
var dataReceiveChannel
var remoteVideo=document.getElementById('remoteVideo')

/////////////////////////////////////////////

var room = prompt('Enter room name:');

var socket = io.connect();

if (room !== '') {
  socket.emit('create or join', room);
  console.log('Attempted to create or  join room', room);
}

remoteVideo.addEventListener('mousemove', e => {
  dataSendChannel.send(JSON.stringify({
    x: e.offsetX/remoteVideo.offsetWidth,
    y: e.offsetY/remoteVideo.offsetHeight,
  }));
})

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
    let sessionDescription = new RTCSessionDescription(message)
    pc.setRemoteDescription(sessionDescription)
    doAnswer();
  } else if (message.type === 'answer' && isStarted) {
    let sessionDescription = new RTCSessionDescription(message)
    pc.setRemoteDescription(sessionDescription)
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
  navigator.mediaDevices.getDisplayMedia({
      audio: false,
      video: {
        width: videoWidth
      },
    })
    .then(gotStream)
    .catch(function (e) {
      console.log('getUserMedia() error: ' + e.name);
    });
} else {
  // createPeerConnection();
  navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        width: videoWidth
      },
    })
    .then(gotStream)
    .catch(function (e) {
      console.log('getUserMedia() error: ' + e.name);
    });
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
    dataSendChannel = pc.createDataChannel('sendDataChannel')
    pc.ondatachannel=function(event){
      dataReceiveChannel = event.channel;
      dataReceiveChannel.onmessage = function (event) {
        console.log(event.data)
      }
    }
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
  pc.createOffer(setLocalAndSendMessage, handleCreateOfferError, {
    offerToReceiveAudio: 0,
    offerToReceiveVideo: 0
  });
}

function doAnswer() {
  console.log('Sending answer to peer.');
  pc.createAnswer({
    offerToReceiveAudio: 0,
    offerToReceiveVideo: 1
  }).then(
    setLocalAndSendMessage,
    onCreateSessionDescriptionError
  );
}

function setLocalAndSendMessage(sessionDescription) {
  pc.setLocalDescription(sessionDescription)
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