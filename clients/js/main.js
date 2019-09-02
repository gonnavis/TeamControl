
var isChannelReady = false;
var isInitiator = false;
var isStarted = false;
var pc;
var dataSendChannel
var dataReceiveChannel

/////////////////////////////////////////////

var room = prompt('Enter room name:');

var socket = io.connect();

if (room !== '') {
  socket.emit('create or join', room);
  console.log('Attempted to create or  join room', room);
}

socket.on('created', function(room) {
  console.log('Created room ' + room);
  isInitiator = true;
});

socket.on('full', function(room) {
  console.log('Room ' + room + ' is full');
});

socket.on('join', function(room) {
  console.log('Another peer made a request to join room ' + room);
  console.log('This peer is the initiator of room ' + room + '!');
  isChannelReady = true;
});

socket.on('joined', function(room) {
  console.log('joined: ' + room);
  isChannelReady = true;
  sendMessage('let us connect webrtc')
});

socket.on('log', function(array) {
  console.log.apply(console, array);
});

////////////////////////////////////////////////

function sendMessage(message) {
  console.log('Client sending message: ', message);
  socket.emit('message', message);
}

// This client receives a message
socket.on('message', function(message) {
  console.log('Client received message:', message);
  if (message === 'let us connect webrtc') {
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
    var candidate = new RTCIceCandidate(JSON.parse(message.candidate));
    pc.addIceCandidate(candidate);
  } else if (message === 'bye' && isStarted) {
    handleRemoteHangup();
  }
});

////////////////////////////////////////////////////


function maybeStart() {
  console.log('>>>>>>> maybeStart() ', isStarted, isChannelReady);
  if (!isStarted && isChannelReady) {
    console.log('>>>>>> creating peer connection');
    createPeerConnection();
    isStarted = true;
    console.log('isInitiator', isInitiator);
    if (isInitiator) {
      doCall();
    }
  }
}

window.onbeforeunload = function() {
  sendMessage('bye');
};

/////////////////////////////////////////////////////////

function createPeerConnection() {
  try {
    pc = new RTCPeerConnection(null);
    dataSendChannel = pc.createDataChannel('sendDataChannel')
    pc.ondatachannel = function(event) {
      dataReceiveChannel = event.channel;
      dataReceiveChannel.onmessage = function(event) {
        console.log(event.data)
      }
    }
    pc.onicecandidate = handleIceCandidate;
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
    // sendMessage({
    //   type: 'candidate',
    //   label: event.candidate.sdpMLineIndex,
    //   id: event.candidate.sdpMid,
    //   candidate: event.candidate.candidate
    // });
    sendMessage({
      type: 'candidate',
      candidate: event.candidate
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