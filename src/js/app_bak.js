// https://electronjs.org/docs/api/desktop-capturer

const {
  desktopCapturer
} = require('electron')

// import electron from 'electron'

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
  video.srcObject = stream

  var connection = new RTCMultiConnection();
  connection.socketURL = 'https://rtcmulticonnection.herokuapp.com:443/';
  // connection.session = {
  //   audio: false,
  //   video: true
  // };
  // connection.addStream(stream)
  connection.open('gonnavisfasdfasdf');
}

function handleError(e) {
  console.log(e)
}