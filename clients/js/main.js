'use strict';
let name;
let connectedUser;
let file_size
let file_name
let is_first_data = true
let offset = 0;
const chunkSize = 10000; // max 65536
let fileReader = new FileReader();
let file
let callPage = document.querySelector('#callPage');
let callToUsernameInput = document.querySelector('#callToUsernameInput');
let callBtn = document.querySelector('#callBtn');
let hangUpBtn = document.querySelector('#hangUpBtn');
let msgInput = document.querySelector('#msgInput');
let sendMsgBtn = document.querySelector('#sendMsgBtn');
let chatArea = document.querySelector('#chatarea');
let rtcconn;
let sendChannel;
let receiveChannel;
callPage.style.display = "none";
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
let is_sender = false;
//connecting to our signaling server 
let wsconn
all()
wsconn.onopen = function() { all('wsconn_onopen') };
//when we got a message from a signaling server 
wsconn.onmessage = function(msg) { all('wsconn_onmessage', msg) };
wsconn.onerror = function(err) { console.log("Got error", err); };
fileInput.addEventListener('change', function() { all('fileInput_onchange') }, false);
sendFileButton.addEventListener('click', function() { all('sendFileButton_onclick') });
hangUpBtn.addEventListener("click", function() { all('hangUpBtn_onclick') });
//initiating a call 
callBtn.addEventListener("click", function() { all('callBtn_onclick') });

function handleLeave() {
  connectedUser = null;
  rtcconn.close();
  rtcconn.onicecandidate = null;
};
//alias for sending JSON encoded messages 
function send(message) {
  //attach the other peer username to our messages
  if (connectedUser) {
    message.name = connectedUser;
  }
  wsconn.send(JSON.stringify(message));
};

function sendData() {
  console.log('sendData')

  is_sender = true
  abortButton.disabled = false;
  sendFileButton.disabled = true;

  fileInput.disabled = true;

  file = fileInput.files[0];
  file_name = file.name
  file_size = file.size
  console.log(`File is ${[file.name, file.size, file.type, file.lastModified].join(' ')}`);

  if (is_first_data) {
    let obj = { file_name, file_size }
    sendChannel.send(JSON.stringify(obj));
    is_first_data = false
  }

  // Handle 0 size files.
  statusMessage.textContent = '';
  downloadAnchor.textContent = '';
  if (file.size === 0) {
    bitrateDiv.innerHTML = '';
    statusMessage.textContent = 'File is empty, please select a non-empty file';
    closeDataChannels();
    return;
  }
  sendProgress.max = file_size;
  fileReader.addEventListener('error', error => console.error('Error reading file:', error));
  fileReader.addEventListener('abort', event => {
    console.log('File reading aborted:', event)
  });
  fileReader.addEventListener('load', e => {
    // console.log('FileRead.onload ', e);
    sendChannel.send(e.target.result);
    console.warn('sended one')
    offset += e.target.result.byteLength;
    sendProgress.value = offset;
    if (offset < file_size) {
      readSlice();
    }
  });
  readSlice();
}

function readSlice() {
  const slice = file.slice(offset, offset + chunkSize);
  fileReader.readAsArrayBuffer(slice);
};

function onReceiveMessageCallback(event) {
  console.log('onReceiveMessageCallback', event)
  if (is_first_data) {
    let obj = JSON.parse(event.data)
    file_name = obj.file_name
    file_size = obj.file_size
    receiveProgress.max = file_size;
    is_first_data = false
    return
  }

  // console.log(`Received Message ${event.data.byteLength}`);
  receiveBuffer.push(event.data);
  receivedSize += event.data.byteLength;

  receiveProgress.value = receivedSize;

  // we are assuming that our signaling protocol told
  // about the expected file size (and name, hash, etc).
  const file = fileInput.files[0];
  if (receivedSize === file_size) {
    const received = new Blob(receiveBuffer);
    receiveBuffer = [];

    downloadAnchor.href = URL.createObjectURL(received);
    downloadAnchor.download = file_name;
    downloadAnchor.textContent =
      `Click to download '${file_name}' (${file_size} bytes)`;
    downloadAnchor.style.display = 'block';

    const bitrate = Math.round(receivedSize * 8 /
      ((new Date()).getTime() - timestampStart));
    bitrateDiv.innerHTML = `<strong>Average Bitrate:</strong> ${Math.round(bitrate/8)} KB/sec (max: ${Math.round(bitrateMax/8)} KB/sec)`;

    if (statsInterval) {
      clearInterval(statsInterval);
      statsInterval = null;
    }

    // closeDataChannels();
  }
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
  rtcconn.close();
  rtcconn = null;
  // console.log('Closed peer connections');

  // re-enable the file select
  fileInput.disabled = false;
  abortButton.disabled = true;
  sendFileButton.disabled = false;
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
  if (rtcconn && rtcconn.iceConnectionState === 'connected') {
    const stats = await rtcconn.getStats();
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
      bitrateDiv.innerHTML = `<strong>Current Bitrate:</strong> ${Math.round(bitrate/8)} KB/sec`;
      timestampPrev = activeCandidatePair.timestamp;
      bytesPrev = bytesNow;
      if (bitrate > bitrateMax) {
        bitrateMax = bitrate;
      }
    }
  }
}
async function all(etype, arg) {
  if (!etype) {
    if (config.env === 'formalsite') {
      wsconn = new WebSocket(`ws://www.gonnavis.com:9091`);
    } else if (config.env === 'testsite') {
      wsconn = new WebSocket(`ws://www.gonnavis.com:9092`);
    } else if (config.env === 'localsite') {
      wsconn = new WebSocket(`ws://${location.hostname}:9091`);
    }
  } else if (etype === 'fileInput_onchange') {
    console.log('handleFileInputChange')
    let file = fileInput.files[0];
    if (!file) {
      // console.log('No file chosen');
    } else {
      sendFileButton.disabled = false;
    }
  } else if (etype === 'sendFileButton_onclick') {
    sendData()
  } else if (etype === 'hangUpBtn_onclick') {
    send({ type: "leave" });
    handleLeave();
  } else if (etype === 'callBtn_onclick') {
    let callToUsername = callToUsernameInput.value;

    if (callToUsername.length > 0) {
      connectedUser = callToUsername;
      // create an offer 
      rtcconn.createOffer(function(offer) {
        send({
          type: "offer",
          offer: offer
        });
        rtcconn.setLocalDescription(offer);
      }, function(error) {
        alert("Error when creating an offer");
      });
    }
  } else if (etype === 'wsconn_onopen') {
    console.log("Connected to the signaling server");
    name = uuidv4()
    input_uuid.value = name
    if (name.length > 0) {
      send({ type: "login", name: name });
    }
  } else if (etype === 'wsconn_onmessage') {
    let msg = arg
    console.log("Got message", msg.data);
    let data = JSON.parse(msg.data);

    if (data.type === 'login') {
      let success = data.success
      if (success === false) {
        alert("Ooops...try a different username");
      } else {
        callPage.style.display = "block";
        let configuration = {
          "iceServers": [
            { "urls": ["stun:stun.l.google.com:19302"] },
            { "urls": ["turn:numb.viagenie.ca  "], "username": "gonnavis@gmail.com", "credential": "WebRTC" },
          ],
          "iceTransportPolicy": "all",
          "iceCandidatePoolSize": "0"
        }
        rtcconn = new RTCPeerConnection(configuration);
        // Setup ice handling 
        rtcconn.onicecandidate = function(event) { all('rtcconn_onicecandidate', event) };
        rtcconn.ondatachannel = function(event) { all('rtcconn_ondatachannel', event) }
        //creating data channel 
        sendChannel = rtcconn.createDataChannel("channel1", { reliable: true });
        sendChannel.binaryType = 'arraybuffer';
        sendChannel.onopen = function() { all('sendChannel_onopen') };
        sendChannel.onerror = function() { all('sendChannel_onerror') };
        sendChannel.onclose = function() { all('sendChannel_onclose') };
      }
    } else if (data.type === 'offer') {
      //when somebody sends us an offer 
      let offer = data.offer
      let name = data.name
      connectedUser = name;
      rtcconn.setRemoteDescription(new RTCSessionDescription(offer));

      //create an answer to an offer 
      let answer = await rtcconn.createAnswer();
      rtcconn.setLocalDescription(answer);
      send({ type: "answer", answer: answer });
    } else if (data.type === 'answer') {
      //when we got an answer from a remote user 
      let answer = data.answer
      rtcconn.setRemoteDescription(new RTCSessionDescription(answer));
    } else if (data.type === 'candidate') {
      //when we got an ice candidate from a remote user 
      let candidate = data.candidate
      // console.warn('handleCandidate', candidate)
      if (candidate) {
        rtcconn.addIceCandidate(new RTCIceCandidate(candidate));
      }
    } else if (data.type === 'leave') {
      handleLeave()
    }

  } else if (etype === 'rtcconn_onicecandidate') {
    let event = arg
    send({
      type: "candidate",
      candidate: event.candidate
    });
  } else if (etype === 'rtcconn_ondatachannel') {
    let event = arg
    receiveChannel = event.channel;
    receiveChannel.binaryType = 'arraybuffer';
    receiveChannel.onmessage = onReceiveMessageCallback;
    receiveChannel.onopen = onReceiveChannelStateChange;
    receiveChannel.onclose = onReceiveChannelStateChange;

    receivedSize = 0;
    bitrateMax = 0;
    downloadAnchor.textContent = '';
    downloadAnchor.removeAttribute('download');
    if (downloadAnchor.href) {
      URL.revokeObjectURL(downloadAnchor.href);
      downloadAnchor.removeAttribute('href');
    }
  } else if (etype === 'sendChannel_onopen') {
    dom_file_wrap.style.display = 'block'
  } else if (etype === 'sendChannel_onerror') {
    console.log("Ooops...error:", error);
  } else if (etype === 'sendChannel_onclose') {
    console.log("data channel is closed");
  }
}