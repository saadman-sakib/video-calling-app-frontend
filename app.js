// var connection = new WebSocket('ws://localhost:8000');

var button = document.getElementById("join");
var userVideo = document.getElementById("local-video");
var partnerVideo = document.getElementById("remote-video"); ;
var peerRef;
var connection;
var otherUser;
var userStream;
var room_id;


button.addEventListener("click", function(){

    navigator.mediaDevices.getUserMedia({ audio: true, video: true }).then(stream => {
        room_id = document.getElementById("room_id").value;

        userVideo.srcObject = stream;
        userStream = stream;
    
        connection = io.connect("wss://videochat-socket-server.herokuapp.com");
        connection.emit("join room", room_id);
    
        connection.on('other user', userID => {
            callUser(userID);
            otherUser = userID;
        });
    
        connection.on("user joined", userID => {
            otherUser = userID;
        });
    
        connection.on("offer", handleRecieveCall);
    
        connection.on("answer", handleAnswer);
    
        connection.on("ice-candidate", handleNewICECandidateMsg);
    });
})



function callUser(userID) {
    peerRef = createPeer(userID);
    userStream.getTracks().forEach(track => peerRef.addTrack(track, userStream));
}

function createPeer(userID) {
    const peer = new RTCPeerConnection({
        iceServers: [
            {
                urls: "stun:stun2.1.google.com:19302"
            },
            {
                urls: 'turn:numb.viagenie.ca',
                credential: 'muazkh',
                username: 'webrtc@live.com'
            },
        ]
    });

    peer.onicecandidate = handleICECandidateEvent;
    peer.ontrack = handleTrackEvent;
    peer.onnegotiationneeded = () => handleNegotiationNeededEvent(userID);

    return peer;
}

function handleNegotiationNeededEvent(userID) {
    peerRef.createOffer().then(offer => {
        return peerRef.setLocalDescription(offer);
    }).then(() => {
        const payload = {
            target: userID,
            caller: connection.id,
            sdp: peerRef.localDescription
        };
        connection.emit("offer", payload);
    }).catch(e => console.log(e));
}

function handleRecieveCall(incoming) {
    peerRef = createPeer();
    const desc = new RTCSessionDescription(incoming.sdp);
    peerRef.setRemoteDescription(desc).then(() => {
        userStream.getTracks().forEach(track => peerRef.addTrack(track, userStream));
    }).then(() => {
        return peerRef.createAnswer();
    }).then(answer => {
        return peerRef.setLocalDescription(answer);
    }).then(() => {
        const payload = {
            target: incoming.caller,
            caller: connection.id,
            sdp: peerRef.localDescription
        }
        connection.emit("answer", payload);
    })
}

function handleAnswer(message) {
    const desc = new RTCSessionDescription(message.sdp);
    peerRef.setRemoteDescription(desc).catch(e => console.log(e));
}

function handleICECandidateEvent(e) {
    if (e.candidate) {
        const payload = {
            target: otherUser,
            candidate: e.candidate,
        }
        connection.emit("ice-candidate", payload);
    }
}

function handleNewICECandidateMsg(incoming) {
    const candidate = new RTCIceCandidate(incoming);

    peerRef.addIceCandidate(candidate)
        .catch(e => console.log(e));
}

function handleTrackEvent(e) {
    partnerVideo.srcObject = e.streams[0];
};


