
// https://electronjs.org/docs/api/desktop-capturer

const {
  desktopCapturer
} = require('electron')

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
}

function handleError(e) {
  console.log(e)
}