    var connection = new RTCMultiConnection();

    // this line is VERY_important
    connection.socketURL = 'https://rtcmulticonnection.herokuapp.com:443/';

    // if you want audio+video conferencing
    connection.session = {
      audio: true,
      video: true
    };

    connection.openOrJoin('gonnavis');