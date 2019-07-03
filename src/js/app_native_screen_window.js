// In the renderer process.
const {
  desktopCapturer
} = require('electron')

console.log(1)
desktopCapturer.getSources({
  types: ['window', 'screen']
}).then(async sources => {
  console.log(2)
  for (const source of sources) {
    if (source.name === 'TeamControl') {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            mandatory: {
              chromeMediaSource: 'desktop',
              chromeMediaSourceId: source.id,
              minWidth: 1280,
              maxWidth: 1280,
              minHeight: 720,
              maxHeight: 720
            }
          }
        })
        handleStream(stream)
      } catch (e) {
        handleError(e)
      }
      return
    }
  }
})

function handleStream(stream) {
  video.srcObject = stream
}

function handleError(e) {
  console.log(e)
}