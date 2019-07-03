// https://electronjs.org/docs/api/desktop-capturer

const {
  desktopCapturer
} = require('electron')
const robot=require('robotjs')

// import electron from 'electron'

var camera_streamid

console.log(1)
desktopCapturer.getSources({
  types: ['screen']
}).then(async sources => {
  console.log(2)
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      mandatory: {
        chromeMediaSource: 'desktop'
      }
    }
  })
  handleStream(stream)
})

function handleStream(stream) {

  var connection = window.connection = new RTCMultiConnection();
  // connection.dontAttachStream=true
  connection.dontCaptureUserMedia=true
  connection.socketURL = 'https://rtcmulticonnection.herokuapp.com:443/';
  connection.session = {
    audio: false,
    video: true,
    oneway: true,
  };
  connection.bandwidth = {
    audio: 50, // 50 kbps
    video: 256, // 256 kbps
    screen: 300 // 300 kbps
  };
  setTimeout(()=>{
    connection.attachStreams[0]=stream
  }, 5000)
  connection.open('gonnavis');
}

function handleError(e) {
  console.log(e)
}











var connection_data = new RTCMultiConnection();

// this line is VERY_important
connection_data.socketURL = 'https://rtcmulticonnection.herokuapp.com:443/';

// if you want text chat
connection_data.session = {
  data: true
};

connection_data.onmessage = function (event) {
  console.log('****** msg: ', event.data)
  let msg = JSON.parse(event.data)
  if (msg.x !== undefined) {
    robot.moveMouse(msg.x * screenSize.width, msg.y * screenSize.height);
  }

  if (msg.click) {
    robot.mouseClick()
  }
};

connection_data.open('gonnavis_data');





