// https://electronjs.org/docs/api/desktop-capturer

var connection = new RTCMultiConnection();
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
connection.open('gonnavis', function () {
  console.log('opened')
});








var socket = io();


var connection_data = new RTCMultiConnection();

// this line is VERY_important
connection_data.socketURL = 'https://rtcmulticonnection.herokuapp.com:443/';

// if you want text chat
connection_data.session = {
  data: true
};

connection_data.onmessage = function (event) {
  console.log('****** msg: ', event.data)
  socket.emit('chat message', event.data);
};

connection_data.open('gonnavis_data');
