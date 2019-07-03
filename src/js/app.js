// In the renderer process.
const {
  desktopCapturer
} = require('electron')

console.log(1)
desktopCapturer.getSources({
  types: ['window', 'screen']
}).then(async sources => {
  console.log(2)
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      mandatory: {
        chromeMediaSource: 'desktop'
      }
    },
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
}

function handleError(e) {
  console.log(e)
}