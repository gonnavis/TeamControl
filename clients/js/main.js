'use strict';

//our username 
let name;
let connectedUser;

let file_size
let file_name
let is_first_data = true

//****** 
//UI selectors block 
//****** 

let loginPage = document.querySelector('#loginPage');
let usernameInput = document.querySelector('#usernameInput');
let loginBtn = document.querySelector('#loginBtn');

let callPage = document.querySelector('#callPage');
let callToUsernameInput = document.querySelector('#callToUsernameInput');
let callBtn = document.querySelector('#callBtn');

let hangUpBtn = document.querySelector('#hangUpBtn');
let msgInput = document.querySelector('#msgInput');
let sendMsgBtn = document.querySelector('#sendMsgBtn');

let chatArea = document.querySelector('#chatarea');
let yourConn;
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

let fileReader;
let receiveBuffer = [];
let receivedSize = 0;

let bytesPrev = 0;
let timestampPrev = 0;
let timestampStart;
let statsInterval = null;
let bitrateMax = 0;

let is_sender = false;



//connecting to our signaling server 
let conn
if (location.hostname.indexOf('localhost') > -1 || location.hostname.indexOf('172.') > -1 || location.hostname.indexOf('192.') > -1) {
  conn = new WebSocket(`ws://www.gonnavis.com:9091`);
} else {
  conn = new WebSocket(`ws://${location.hostname}:9091`);
}

conn.onopen = function() {
  console.log("Connected to the signaling server");
};

//when we got a message from a signaling server 
conn.onmessage = function(msg) {
  console.log("Got message", msg.data);
  let data = JSON.parse(msg.data);

  switch (data.type) {
    case "login":
      handleLogin(data.success);
      break;
      //when somebody wants to call us 
    case "offer":
      handleOffer(data.offer, data.name);
      break;
    case "answer":
      handleAnswer(data.answer);
      break;
      //when a remote peer sends an ice candidate to us 
    case "candidate":
      handleCandidate(data.candidate);
      break;
    case "leave":
      handleLeave();
      break;
    default:
      break;
  }
};

conn.onerror = function(err) {
  console.log("Got error", err);
};

//alias for sending JSON encoded messages 
function send(message) {

  //attach the other peer username to our messages
  if (connectedUser) {
    message.name = connectedUser;
  }

  conn.send(JSON.stringify(message));
};

// Login when the user clicks the button 
loginBtn.addEventListener("click", function(event) {
  name = usernameInput.value;

  if (name.length > 0) {
    send({
      type: "login",
      name: name
    });
  }

});

fileInput.addEventListener('change', handleFileInputChange, false);
sendFileButton.addEventListener('click', () => sendData());

function handleLogin(success) {

  if (success === false) {
    alert("Ooops...try a different username");
  } else {
    loginPage.style.display = "none";
    callPage.style.display = "block";

    //********************** 
    //Starting a peer connection 
    //********************** 

    let configuration = {
      "iceServers": [
        { "urls": ["stun:stun.l.google.com:19302"] },
        { "urls": ["turn:numb.viagenie.ca  "], "username": "gonnavis@gmail.com", "credential": "WebRTC" },
      ],
      "iceTransportPolicy": "all",
      "iceCandidatePoolSize": "0"
    }

    yourConn = new RTCPeerConnection(configuration);

    // Setup ice handling 
    yourConn.onicecandidate = function(event) {
      // if (event.candidate && event.candidate.candidate) console.warn('onicecandidate', event.candidate.candidate)
      // if (event.candidate && event.candidate.candidate && event.candidate.candidate.indexOf('relay') > -1) {
      send({
        type: "candidate",
        candidate: event.candidate
      });
      // }
    };

    yourConn.ondatachannel = function(event) {
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
    }

    //creating data channel 
    sendChannel = yourConn.createDataChannel("channel1", { reliable: true });
    sendChannel.binaryType = 'arraybuffer';

    sendChannel.onopen = function(error) {
      dom_file_wrap.style.display = 'block'
    };

    sendChannel.onerror = function(error) {
      console.log("Ooops...error:", error);
    };

    sendChannel.onclose = function() {
      console.log("data channel is closed");
    };

  }
};

//initiating a call 
callBtn.addEventListener("click", function() {
  let callToUsername = callToUsernameInput.value;

  if (callToUsername.length > 0) {
    connectedUser = callToUsername;
    // create an offer 
    yourConn.createOffer(function(offer) {
      send({
        type: "offer",
        offer: offer
      });
      yourConn.setLocalDescription(offer);
    }, function(error) {
      alert("Error when creating an offer");
    });
  }

});

//when somebody sends us an offer 
function handleOffer(offer, name) {
  connectedUser = name;
  yourConn.setRemoteDescription(new RTCSessionDescription(offer));

  //create an answer to an offer 
  yourConn.createAnswer(function(answer) {
    yourConn.setLocalDescription(answer);
    send({
      type: "answer",
      answer: answer
    });
  }, function(error) {
    alert("Error when creating an answer");
  });

};

//when we got an answer from a remote user 
function handleAnswer(answer) {
  yourConn.setRemoteDescription(new RTCSessionDescription(answer));
};

//when we got an ice candidate from a remote user 
function handleCandidate(candidate) {
  // console.warn('handleCandidate', candidate)
  if (candidate) {
    yourConn.addIceCandidate(new RTCIceCandidate(candidate));
  }
};

//hang up 
hangUpBtn.addEventListener("click", function() {
  send({
    type: "leave"
  });

  handleLeave();
});

function handleLeave() {
  connectedUser = null;
  yourConn.close();
  yourConn.onicecandidate = null;
};

// //when user clicks the "send message" button 
// sendMsgBtn.addEventListener("click", function(event) {
//   let val = msgInput.value;
//   chatArea.innerHTML += name + ": " + val + "<br />";

//   //sending a message to a connected peer 
//   sendChannel.send(val);
//   msgInput.value = "";
// });

function sendData() {
  console.log('sendData')

  is_sender = true
  abortButton.disabled = false;
  sendFileButton.disabled = true;

  fileInput.disabled = true;

  const file = fileInput.files[0];
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
  const chunkSize = 16384;
  fileReader = new FileReader();
  let offset = 0;
  fileReader.addEventListener('error', error => console.error('Error reading file:', error));
  fileReader.addEventListener('abort', event => {
    console.log('File reading aborted:', event)
  });
  fileReader.addEventListener('load', e => {
    console.log('FileRead.onload ', e);
    sendChannel.send(e.target.result);
    offset += e.target.result.byteLength;
    sendProgress.value = offset;
    if (offset < file_size) {
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

    closeDataChannels();
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
  yourConn.close();
  yourConn = null;
  // console.log('Closed peer connections');

  // re-enable the file select
  fileInput.disabled = false;
  abortButton.disabled = true;
  sendFileButton.disabled = false;
}

function handleFileInputChange() {
  console.log('handleFileInputChange')
  let file = fileInput.files[0];
  if (!file) {
    // console.log('No file chosen');
  } else {
    sendFileButton.disabled = false;
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
  if (yourConn && yourConn.iceConnectionState === 'connected') {
    const stats = await yourConn.getStats();
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