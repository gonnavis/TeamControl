// https://electronjs.org/docs/api/desktop-capturer

const {
  desktopCapturer
} = require('electron')

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