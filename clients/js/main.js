'use strict';

// ok

let isChannelReady = false;
let isInitiator = false;
let isStarted = false;

let config_file_size = 5642623
let config_file_name = 'webrtc_filetransfer_test.mp4'

let is_sender = false

let localConnection;
let sendChannel;
let receiveChannel;
let fileReader;
const bitrateDiv = document.querySelector('div#bitrate');
const fileInput = document.querySelector('input#fileInput');
const abortButton = document.querySelector('button#abortButton');
const downloadAnchor = document.querySelector('a#download');
const sendProgress = document.querySelector('progress#sendProgress');
const receiveProgress = document.querySelector('progress#receiveProgress');
const statusMessage = document.querySelector('span#status');
const sendFileButton = document.querySelector('button#sendFile');

let receiveBuffer = [];
let receivedSize = 0;

let bytesPrev = 0;
let timestampPrev = 0;
let timestampStart;
let statsInterval = null;
let bitrateMax = 0;

sendFileButton.addEventListener('click', () => sendData());
fileInput.addEventListener('change', handleFileInputChange, false);
abortButton.addEventListener('click', () => {
  if (fileReader && fileReader.readyState === 1) {
    // console.log('Abort read!');
    fileReader.abort();
  }
});

/////////////////////////////////////////////////////////

function onReceiveMessageCallback(event) {
  console.log('onReceiveMessageCallback')
  // console.log(`Received Message ${event.data.byteLength}`);
  receiveBuffer.push(event.data);
  receivedSize += event.data.byteLength;

  receiveProgress.value = receivedSize;

  // we are assuming that our signaling protocol told
  // about the expected file size (and name, hash, etc).
  const file = fileInput.files[0];
  if (receivedSize === config_file_size) {
    const received = new Blob(receiveBuffer);
    receiveBuffer = [];

    downloadAnchor.href = URL.createObjectURL(received);
    downloadAnchor.download = config_file_name;
    downloadAnchor.textContent =
      `Click to download '${config_file_name}' (${config_file_size} bytes)`;
    downloadAnchor.style.display = 'block';

    const bitrate = Math.round(receivedSize * 8 /
      ((new Date()).getTime() - timestampStart));
    bitrateDiv.innerHTML = `<strong>Average Bitrate:</strong> ${bitrate} kbits/sec (max: ${bitrateMax} kbits/sec)`;

    if (statsInterval) {
      clearInterval(statsInterval);
      statsInterval = null;
    }

    closeDataChannels();
  }
}


async function handleFileInputChange() {
  console.log('handleFileInputChange')
  let file = fileInput.files[0];
  if (!file) {
    // console.log('No file chosen');
  } else {
    sendFileButton.disabled = false;
  }
}

function sendMessage(message) {
  console.log('sendMessage: ', message.type ? message.type : message)
  // console.log('Client sending message: ', message);
  socket.emit('message', message);
}

function sendData() {
  console.log('sendData')
  is_sender = true
  abortButton.disabled = false;
  sendFileButton.disabled = true;

  fileInput.disabled = true;

  const file = fileInput.files[0];
  // console.log(`File is ${[file.name, file.size, file.type, file.lastModified].join(' ')}`);

  // Handle 0 size files.
  statusMessage.textContent = '';
  downloadAnchor.textContent = '';
  if (file.size === 0) {
    bitrateDiv.innerHTML = '';
    statusMessage.textContent = 'File is empty, please select a non-empty file';
    closeDataChannels();
    return;
  }
  sendProgress.max = config_file_size;
  receiveProgress.max = config_file_size;
  const chunkSize = 16384;
  fileReader = new FileReader();
  let offset = 0;
  fileReader.addEventListener('error', error => console.error('Error reading file:', error));
  fileReader.addEventListener('abort', event => {
    // console.log('File reading aborted:', event)
  });
  fileReader.addEventListener('load', e => {
    // console.log('FileRead.onload ', e);
    sendChannel.send(e.target.result);
    offset += e.target.result.byteLength;
    sendProgress.value = offset;
    if (offset < config_file_size) {
      readSlice(offset);
    }
  });
  const readSlice = o => {
    // console.log('readSlice ', o);
    const slice = file.slice(offset, o + chunkSize);
    fileReader.readAsArrayBuffer(slice);
  };
  readSlice(0);
}

function closeDataChannels() {
  console.log('closeDataChannels')
  // console.log('Closing data channels');
  sendChannel.close();
  // console.log(`Closed data channel with label: ${sendChannel.label}`);
  if (receiveChannel) {
    receiveChannel.close();
    // console.log(`Closed data channel with label: ${receiveChannel.label}`);
  }
  localConnection.close();
  localConnection = null;
  // console.log('Closed peer connections');

  // re-enable the file select
  fileInput.disabled = false;
  abortButton.disabled = true;
  sendFileButton.disabled = false;
}

function createPeerConnection() {
  console.log('createPeerConnection')
  try {
    localConnection = new RTCPeerConnection(JSON.parse(
      '{"iceServers":[{"urls":["stun:stun.l.google.com:19302"]}],"iceTransportPolicy":"all","iceCandidatePoolSize":"0"}'
    ));
    sendChannel = localConnection.createDataChannel('sendDataChannel')
    sendChannel.binaryType = 'arraybuffer';
    localConnection.ondatachannel = receiveChannelCallback
    localConnection.onicecandidate = handleIceCandidate;
    // console.log('Created RTCPeerConnnection');
  } catch (e) {
    // console.log('Failed to create PeerConnection, exception: ' + e.message);
    // console.log('Cannot create RTCPeerConnection object.');
    return;
  }
}

function handleIceCandidate(event) {
  console.log('handleIceCandidate')
  // console.log('icecandidate event: ', event);
  if (event.candidate) {
    sendMessage({
      type: 'candidate',
      label: event.candidate.sdpMLineIndex,
      id: event.candidate.sdpMid,
      candidate: event.candidate.candidate
    });
  } else {
    // console.log('End of candidates.');
  }
}

function handleCreateOfferError(event) {
  console.log('handleCreateOfferError')
  // console.log('createOffer() error: ', event);
}

function doCall() {
  console.log('doCall')
  // console.log('Sending offer to peer');
  localConnection.createOffer(setLocalAndSendMessage, handleCreateOfferError, {
    offerToReceiveAudio: 0,
    offerToReceiveVideo: 0
  });
}

function doAnswer() {
  console.log('doAnswer')
  // console.log('Sending answer to peer.');
  localConnection.createAnswer({
    offerToReceiveAudio: 0,
    offerToReceiveVideo: 1
  }).then(
    setLocalAndSendMessage,
    onCreateSessionDescriptionError
  );
}

function setLocalAndSendMessage(sessionDescription) {
  console.log('setLocalAndSendMessage')
  localConnection.setLocalDescription(sessionDescription)
  // console.log('setLocalAndSendMessage sending message', sessionDescription);
  sendMessage(sessionDescription);
}

function onCreateSessionDescriptionError(error) {
  console.log('onCreateSessionDescriptionError')
  trace('Failed to create session description: ' + error.toString());
}

function hangup() {
  console.log('hangup')
  // console.log('Hanging up.');
  stop();
  sendMessage('bye');
}

function handleRemoteHangup() {
  console.log('handleRemoteHangup')
  // console.log('Session terminated.');
  stop();
  isInitiator = false;
}

function stop() {
  console.log('stop')
  isStarted = false;
  localConnection.close();
  localConnection = null;
}
















////////////////////////////////////////////////////


function maybeStart() {
  console.log('maybeStart')
  // console.log('>>>>>>> maybeStart() ', isStarted, isChannelReady);
  if (!isStarted && isChannelReady) {
    // console.log('>>>>>> creating peer connection');
    createPeerConnection();
    isStarted = true;
    // console.log('isInitiator', isInitiator);
    if (isInitiator) {
      doCall();
    }
  }
}

window.onbeforeunload = function() {
  console.log('onbeforeunload')
  sendMessage('bye');
};














/////////////////////////////////////////////

var room = prompt('Enter room name:');

var socket = io.connect();

if (room !== '') {
  socket.emit('create or join', room);
  // console.log('Attempted to create or  join room', room);
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
  // console.log.apply(console, array);
});

////////////////////////////////////////////////

// This client receives a message
socket.on('message', function(message) {
  console.log('Client received message:', message.type ? message.type : message);
  if (message === 'let us connect webrtc') {
    maybeStart();
  } else if (message.type === 'offer') {
    if (!isInitiator && !isStarted) {
      maybeStart();
    }
    let sessionDescription = new RTCSessionDescription(message)
    localConnection.setRemoteDescription(sessionDescription)
    doAnswer();
  } else if (message.type === 'answer' && isStarted) {
    let sessionDescription = new RTCSessionDescription(message)
    localConnection.setRemoteDescription(sessionDescription)
  } else if (message.type === 'candidate' && isStarted) {
    var candidate = new RTCIceCandidate({
      sdpMLineIndex: message.label,
      candidate: message.candidate
    });
    localConnection.addIceCandidate(candidate);
  } else if (message === 'bye' && isStarted) {
    handleRemoteHangup();
  }
});


















async function gotLocalDescription(desc) {
  console.log('gotLocalDescription')
  await localConnection.setLocalDescription(desc);
  // console.log(`Offer from localConnection\n ${desc.sdp}`);
  await remoteConnection.setRemoteDescription(desc);
  try {
    const answer = await remoteConnection.createAnswer();
    await gotRemoteDescription(answer);
  } catch (e) {
    // console.log('Failed to create session description: ', e);
  }
}

async function gotRemoteDescription(desc) {
  console.log('gotRemoteDescription')
  await remoteConnection.setLocalDescription(desc);
  // console.log(`Answer from remoteConnection\n ${desc.sdp}`);
  await localConnection.setRemoteDescription(desc);
}

function receiveChannelCallback(event) {
  console.log('receiveChannelCallback')
  // console.log('Receive Channel Callback');
  receiveChannel = event.channel;
  receiveChannel.binaryType = 'arraybuffer';
  receiveChannel.onmessage = onReceiveMessageCallback;
  // receiveChannel.onopen = onReceiveChannelStateChange;
  // receiveChannel.onclose = onReceiveChannelStateChange;

  receivedSize = 0;
  bitrateMax = 0;
  downloadAnchor.textContent = '';
  downloadAnchor.removeAttribute('download');
  if (downloadAnchor.href) {
    URL.revokeObjectURL(downloadAnchor.href);
    downloadAnchor.removeAttribute('href');
  }
}

async function onReceiveChannelStateChange() {
  console.log('onReceiveChannelStateChange')
  const readyState = receiveChannel.readyState;
  // console.log(`Receive channel state is: ${readyState}`);
  if (readyState === 'open') {
    timestampStart = (new Date()).getTime();
    timestampPrev = timestampStart;
    statsInterval = setInterval(displayStats, 500);
    await displayStats();
  }
}

// display bitrate statistics.
async function displayStats() {
  console.log('displayStats')
  if (remoteConnection && remoteConnection.iceConnectionState === 'connected') {
    const stats = await remoteConnection.getStats();
    let activeCandidatePair;
    stats.forEach(report => {
      if (report.type === 'transport') {
        activeCandidatePair = stats.get(report.selectedCandidatePairId);
      }
    });
    if (activeCandidatePair) {
      if (timestampPrev === activeCandidatePair.timestamp) {
        return;
      }
      // calculate current bitrate
      const bytesNow = activeCandidatePair.bytesReceived;
      const bitrate = Math.round((bytesNow - bytesPrev) * 8 /
        (activeCandidatePair.timestamp - timestampPrev));
      bitrateDiv.innerHTML = `<strong>Current Bitrate:</strong> ${bitrate} kbits/sec`;
      timestampPrev = activeCandidatePair.timestamp;
      bytesPrev = bytesNow;
      if (bitrate > bitrateMax) {
        bitrateMax = bitrate;
      }
    }
  }
}