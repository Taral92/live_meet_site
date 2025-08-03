import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import { useUser } from '@clerk/clerk-react';
import { Box, TextField, Button, IconButton, Typography } from '@mui/material';
import { Mic, MicOff, Videocam, VideocamOff } from '@mui/icons-material';

const backendUrl = 'https://live-meet-site.onrender.com';

const MeetingRoom = () => {
  const { roomId } = useParams();
  const { user, isLoaded } = useUser();

  const userVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnection = useRef(null);
  const streamRef = useRef(null);
  const socketRef = useRef(null);

  const [isStarted, setIsStarted] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');
  const [chat, setChat] = useState([]);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);

  // Initialize socket when clerk is loaded
  useEffect(() => {
    if (!isLoaded) return;

    socketRef.current = io(backendUrl, { transports: ['websocket'] });

    // Listen for chat messages
    socketRef.current.on('chat-message', (data) => {
      setChat((prev) => [...prev, { username: data.username, message: data.message }]);
    });

    // Cleanup on unmount
    return () => {
      peerConnection.current?.close();
      streamRef.current?.getTracks?.().forEach((track) => track.stop());
      socketRef.current?.disconnect();
    };
  }, [isLoaded, roomId]);

  // Setup signaling listeners only when meeting started
  useEffect(() => {
    if (!isStarted || !isLoaded || !socketRef.current) return;

    const socket = socketRef.current;
    let remoteSocketId = null;

    // Join signaling rooms
    socket.emit('join-meeting', roomId);
    socket.emit('join', roomId);

    socket.on('user-joined', async ({ socketId }) => {
      remoteSocketId = socketId;
      if (!peerConnection.current && streamRef.current) {
        peerConnection.current = createPeerConnection(socket, remoteSocketId);
        streamRef.current.getTracks().forEach(track => peerConnection.current.addTrack(track, streamRef.current));
        const offer = await peerConnection.current.createOffer();
        await peerConnection.current.setLocalDescription(offer);
        socket.emit('offer', { offer, target: remoteSocketId }, roomId);
      }
    });

    socket.on('offer', async ({ offer, from }) => {
      remoteSocketId = from;
      if (!peerConnection.current && streamRef.current) {
        peerConnection.current = createPeerConnection(socket, remoteSocketId);
        streamRef.current.getTracks().forEach(track => peerConnection.current.addTrack(track, streamRef.current));
        await peerConnection.current.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peerConnection.current.createAnswer();
        await peerConnection.current.setLocalDescription(answer);
        socket.emit('answer', { answer, target: from }, roomId);
      }
    });

    socket.on('answer', async ({ answer }) => {
      if (peerConnection.current) {
        await peerConnection.current.setRemoteDescription(new RTCSessionDescription(answer));
      }
    });

    socket.on('ice-candidate', async ({ candidate }) => {
      if (peerConnection.current && candidate) {
        try {
          await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch {
          // ignore errors on ICE candidate adding
        }
      }
    });

    socket.on('user-left', () => {
      setIsConnected(false);
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
      peerConnection.current?.close();
      peerConnection.current = null;
    });

    // Cleanup event listeners on unmount or dependency change
    return () => {
      socket.off('user-joined');
      socket.off('offer');
      socket.off('answer');
      socket.off('ice-candidate');
      socket.off('user-left');
      peerConnection.current?.close();
      peerConnection.current = null;
    };
  }, [isStarted, isLoaded, roomId]);

  // PeerConnection creation helper
  const createPeerConnection = (socket, targetSocketId) => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('ice-candidate', { candidate: event.candidate, target: targetSocketId }, roomId);
      }
    };

    pc.ontrack = (event) => {
      if (remoteVideoRef.current && event.streams[0]) {
        remoteVideoRef.current.srcObject = event.streams[0];
        setIsConnected(true);
      }
    };

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      if (state === 'connected' || state === 'completed') setIsConnected(true);
      if (state === 'disconnected' || state === 'failed') setIsConnected(false);
    };

    return pc;
  };

  // Start meeting: get media and show local video
  const startMeeting = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: true,
      });
      streamRef.current = stream;
      setIsStarted(true);
    } catch (error) {
      setError(`Media access failed: ${error.message}`);
    }
  };

  // Assign local stream to video element when both started and video ref ready
  useEffect(() => {
    if (isStarted && userVideoRef.current && streamRef.current) {
      userVideoRef.current.srcObject = streamRef.current;
      userVideoRef.current.play().catch(() => {});
    }
  }, [isStarted]);

  // Toggle audio track enabled state
  const toggleAudio = () => {
    if (streamRef.current) {
      const audioTrack = streamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioMuted(!audioTrack.enabled);
      }
    }
  };

  // Toggle video track enabled state
  const toggleVideo = () => {
    if (streamRef.current) {
      const videoTrack = streamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoMuted(!videoTrack.enabled);
      }
    }
  };

  // Send chat message
  const handleSend = () => {
    if (message.trim()) {
      socketRef.current.emit('chat-message', {
        roomId,
        message,
        username: user?.username || user?.firstName || 'Anonymous',
      });
      setMessage('');
    }
  };

  return (
    <Box sx={{ p: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
      <Typography variant="h4" fontWeight="bold">
        Meeting Room: {roomId}
      </Typography>

      {error && <Typography color="error">{error}</Typography>}

      {!isStarted ? (
        <Box sx={{ textAlign: 'center' }}>
          <Button onClick={startMeeting} variant="contained" color="primary" sx={{ px: 4, py: 2 }}>
            ▶️ Start Meeting
          </Button>
          <Typography color="textSecondary" sx={{ mt: 2 }}>
            Click "Start Meeting" to enable camera and mic. Open in another tab/device to test: {window.location.href}
          </Typography>
        </Box>
      ) : (
        <>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3, mt: 2 }}>
            <Box>
              <Typography variant="h6">Your Video</Typography>
              <video
                ref={userVideoRef}
                autoPlay
                playsInline
                muted
                style={{ width: 300, borderRadius: 8, border: '1px solid #ccc', background: '#000' }}
              />
              <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
                <IconButton onClick={toggleAudio}>
                  {isAudioMuted ? <MicOff color="error" /> : <Mic color="primary" />}
                </IconButton>
                <IconButton onClick={toggleVideo}>
                  {isVideoMuted ? <VideocamOff color="error" /> : <Videocam color="primary" />}
                </IconButton>
              </Box>
            </Box>

            <Box>
              <Typography variant="h6">Remote Video</Typography>
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                style={{ width: 300, borderRadius: 8, border: '1px solid #ccc', background: '#000' }}
              />
            </Box>
          </Box>

          {!isConnected && (
            <Typography color="textSecondary" sx={{ mt: 2 }}>
              Waiting for connection. Share this link in another tab/device: {window.location.href}
            </Typography>
          )}

          <Box sx={{ width: '100%', maxWidth: 600, mt: 4 }}>
            <Box sx={{ height: 300, overflowY: 'auto', bgcolor: '#f5f5f5', p: 2, borderRadius: 2 }}>
              {chat.map((msg, idx) => (
                <Box key={idx} sx={{ mb: 1 }}>
                  <strong>{msg.username}: </strong>
                  {msg.message}
                </Box>
              ))}
            </Box>
            <Box sx={{ display: 'flex', mt: 2 }}>
              <TextField
                fullWidth
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type a message..."
                variant="outlined"
              />
              <Button onClick={handleSend} variant="contained" sx={{ ml: 1 }}>
                Send
              </Button>
            </Box>
          </Box>
        </>
      )}
    </Box>
  );
};

export default MeetingRoom;
