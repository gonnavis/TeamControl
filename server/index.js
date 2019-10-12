const config = require('../config.js')
console.log(config)
//require our websocket library 
var WebSocketServer = require('ws').Server;
var port
if (config.env === 'testsite') {
  port = 9092
} else {
  port = 9091
}

//creating a websocket server at port  
var wss = new WebSocketServer({ port });

//all connected to the server users 
var users = {};

//when a user connects to our sever 
wss.on('connection', function(connection) {

  console.log("User connected");

  //when server gets a message from a connected user 
  connection.on('message', function(message) {

    var data;
    //accepting only JSON messages 
    try {
      data = JSON.parse(message);
    } catch (e) {
      console.log("Invalid JSON");
      data = {};
    }

    //when a user tries to login 
    if (data.type === "login") {
      console.log("User logged", data.name);
      //if anyone is logged in with this username then refuse 
      if (users[data.name]) {
        sendTo(connection, {
          type: "login",
          success: false
        });
      } else {
        //save user connection on the server 
        users[data.name] = connection;
        connection.name = data.name;

        sendTo(connection, {
          type: "login",
          success: true
        });
      }
    } else if (data.type === 'offer') {

      //for ex. UserA wants to call UserB 
      console.log("Sending offer to: ", data.name);

      //if UserB exists then send him offer details 
      var conn = users[data.name];

      if (conn != null) {
        //setting that UserA connected with UserB 
        connection.otherName = data.name;

        sendTo(conn, {
          type: "offer",
          offer: data.offer,
          name: connection.name
        });
      }

    } else if (data.type === 'answer') {
      console.log("Sending answer to: ", data.name);
      //for ex. UserB answers UserA 
      var conn = users[data.name];

      if (conn != null) {
        connection.otherName = data.name;
        sendTo(conn, {
          type: "answer",
          answer: data.answer
        });
      }

    } else if (data.type === 'candidate') {
      console.log("Sending candidate to:", data.name);
      var conn = users[data.name];

      if (conn != null) {
        sendTo(conn, {
          type: "candidate",
          candidate: data.candidate
        });
      }
    } else if (data.type === 'leave') {
      console.log("Disconnecting from", data.name);
      var conn = users[data.name];
      conn.otherName = null;

      //notify the other user so he can disconnect his peer connection 
      if (conn != null) {
        sendTo(conn, {
          type: "leave"
        });
      }
    } else {
      sendTo(connection, {
        type: "error",
        message: "Command not found: " + data.type
      });
    }
  });

  //when user exits, for example closes a browser window 
  //this may help if we are still in "offer","answer" or "candidate" state 
  connection.on("close", function() {

    if (connection.name) {
      delete users[connection.name];

      if (connection.otherName) {
        console.log("Disconnecting from ", connection.otherName);
        var conn = users[connection.otherName];
        if (conn) conn.otherName = null;

        if (conn != null) {
          sendTo(conn, {
            type: "leave"
          });
        }
      }
    }
  });

  connection.send(JSON.stringify("Hello world"));

});

function sendTo(connection, message) {
  connection.send(JSON.stringify(message));
}

console.log('server running on port: ' + port)