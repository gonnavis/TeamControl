// var video = document.getElementById('video')
var connection = new RTCMultiConnection();

// this line is VERY_important
connection.socketURL = 'https://rtcmulticonnection.herokuapp.com:443/';

connection.session = {
  screen: true,
  oneway: true
};

connection.sdpConstraints.mandatory = {
  OfferToReceiveAudio: false,
  OfferToReceiveVideo: false
};

// https://www.rtcmulticonnection.org/docs/iceServers/
// use your own TURN-server here!
connection.iceServers = [{
  'urls': [
    'stun:stun.l.google.com:19302',
    'stun:stun1.l.google.com:19302',
    'stun:stun2.l.google.com:19302',
    'stun:stun.l.google.com:19302?transport=udp',
  ]
}];

connection.onstream = function (event) {
  // video.srcObject = event.stream
};





connection.open('gonnavisaaa', function () {
  console.log('opened')
});