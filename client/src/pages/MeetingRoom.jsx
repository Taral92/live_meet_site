import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import { useUser } from '@clerk/clerk-react';
import { Box, TextField, Button, IconButton, Typography } from '@mui/material';
import { Mic, MicOff, Videocam, VideocamOff } from '@mui/icons-material';

const MeetingRoom = () => {
  const { roomId } = useParams();
  const { user } = useUser();
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

  const backendUrl = process.env.REACT_APP_BACKEND_URL || 'https://live-meet-site.onrender.com';

  useEffect(() => {
    console.log('MeetingRoom mounted with roomId:', roomId, 'User:', user ? user.id : 'Not loaded');
    if (!user) {
      console.log('User not loaded, delaying setup');
      return;
    }

    socketRef.current = io(backendUrl, {
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      transports: ['websocket'],
      path: '/socket.io',
    });

    socketRef.current.on('connect', () => {
      console.log(`Socket connected: ${socketRef.current.id}`);
      socketRef.current.emit('join-meeting', roomId);
      socketRef.current.emit('join', roomId);
    });

    socketRef.current.on('connect_error', (err) => {
      console.error('Socket connection error:', err.message);
      setError(`Cannot connect to server. Check URL: ${backendUrl}. Error: ${err.message}`);
    });

    socketRef.current.on('disconnect', () => {
      console.log('Socket disconnected');
      setIsConnected(false);
      setError('Disconnected from server.');
    });

    socketRef.current.on('user-joined', async ({ socketId }) => {
      console.log(`User joined: ${socketId}`);
      if (streamRef.current && !peerConnection.current) {
        try {
          peerConnection.current = createPeerConnection(socketId);
          streamRef.current.getTracks().forEach((track) => {
            console.log(`Adding track: ${track.kind} (enabled: ${track.enabled})`);
            peerConnection.current.addTrack(track, streamRef.current);
          });
          const offer = await peerConnection.current.createOffer();
          await peerConnection.current.setLocalDescription(offer);
          socketRef.current.emit('offer', { offer, target: socketId }, roomId);
          console.log(`Sent offer to: ${socketId}`);
        } catch (err) {
          console.error('Error creating offer:', err);
          setError('Failed to initiate video call.');
        }
      }
    });

    socketRef.current.on('offer', async ({ offer, from }) => {
      console.log(`Received offer from: ${from}`);
      if (!peerConnection.current && streamRef.current) {
        try {
          peerConnection.current = createPeerConnection(from);
          streamRef.current.getTracks().forEach((track) => {
            console.log(`Adding track: ${track.kind} (enabled: ${track.enabled})`);
            peerConnection.current.addTrack(track, streamRef.current);
          });
          await peerConnection.current.setRemoteDescription(new RTCSessionDescription(offer));
          const answer = await peerConnection.current.createAnswer();
          console.log('Created answer:', answer);
          await peerConnection.current.setLocalDescription(answer);
          socketRef.current.emit('answer', { answer, target: from }, roomId);
          console.log(`Sent answer to: ${from}`);
        } catch (err) {
          console.error('Error handling offer:', err);
          setError(`Failed to process offer from ${from}. Error: ${err.message}`);
        }
      }
    });

    socketRef.current.on('answer', async ({ answer }) => {
      console.log('Received answer');
      if (peerConnection.current) {
        try {
          await peerConnection.current.setRemoteDescription(new RTCSessionDescription(answer));
          console.log('Set remote description for answer');
        } catch (err) {
          console.error('Error setting answer:', err);
          setError('Failed to connect video call.');
        }
      }
    });

    socketRef.current.on('ice-candidate', async ({ candidate }) => {
      console.log('Received ICE candidate');
      if (peerConnection.current) {
        try {
          await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
          console.log('Added ICE candidate');
        } catch (err) {
          console.error('Error adding ICE candidate:', err);
        }
      }
    });

    socketRef.current.on('user-left', () => {
      console.log('User left');
      setIsConnected(false);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
      }
    });

    socketRef.current.on('chat-message', (data) => {
      console.log('Received chat message:', data);
      setChat((prev) => [...prev, { username: data.username, message: data.message }]);
    });

    return () => {
      console.log('Cleaning up MeetingRoom, User:', user ? user.id : 'Not loaded');
      if (socketRef.current) {
        socketRef.current.emit('leave-room', roomId);
        socketRef.current.off();
        socketRef.current.disconnect();
      }
      if (peerConnection.current) {
        peerConnection.current.close();
        peerConnection.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [roomId, backendUrl, user]);

  const createPeerConnection = (targetSocketId) => {
    console.log(`Creating peer connection for: ${targetSocketId}`);
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        // Add TURN if needed: { urls: 'turn:your-turn-server.com', username: 'user', credential: 'pass' }
      ],
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current.emit('ice-candidate', { candidate: event.candidate, target: targetSocketId }, roomId);
        console.log('Sent ICE candidate');
      }
    };

    pc.ontrack = (event) => {
      console.log(`Received remote track: ${event.track.kind}`);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
        remoteVideoRef.current.play().catch((err) => {
          console.error('Error playing remote video:', err);
        });
        console.log('Set remote stream to video element');
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`ICE connection state: ${pc.iceConnectionState}`);
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        setIsConnected(true);
        setError(null);
      } else if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
        setIsConnected(false);
        setError('Connection lost. Consider adding a TURN server.');
      }
    };

    return pc;
  };

  const startMeeting = async () => {
    try {
      console.log('Requesting media devices');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: true,
      });

      streamRef.current = stream;
      if (userVideoRef.current) {
        userVideoRef.current.srcObject = stream;
        console.log('Stream assigned to userVideoRef:', userVideoRef.current.srcObject);
        const playPromise = userVideoRef.current.play();
        if (playPromise !== undefined) {
          await playPromise.catch((err) => {
            console.error('Error playing local video:', err);
            setError(`Failed to play video: ${err.message}. Check browser settings.`);
          });
        }
      }

      stream.getTracks().forEach((track) => {
        console.log(`Local track: ${track.kind}, enabled: ${track.enabled}, readyState: ${track.readyState}`);
      });

      setIsStarted(true);
      setError(null);
    } catch (error) {
      console.error('Error accessing media devices:', error);
      setError(`Media access failed: ${error.message}. Check permissions.`);
    }
  };

  const toggleAudio = () => {
    if (streamRef.current) {
      const audioTrack = streamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioMuted(!audioTrack.enabled);
        console.log(`Audio ${audioTrack.enabled ? 'unmuted' : 'muted'}, readyState: ${audioTrack.readyState}`);
      } else {
        console.log('No audio track available');
        setError('No audio device detected.');
      }
    }
  };

  const toggleVideo = () => {
    if (streamRef.current) {
      const videoTrack = streamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoMuted(!videoTrack.enabled);
        console.log(`Video ${videoTrack.enabled ? 'unmuted' : 'muted'}, readyState: ${videoTrack.readyState}`);
        if (userVideoRef.current) {
          userVideoRef.current.play().catch((err) => {
            console.error('Error re-playing video:', err);
          });
        }
      } else {
        console.log('No video track available');
        setError('No video device detected.');
      }
    }
  };

  const handleSend = () => {
    if (message.trim()) {
      socketRef.current.emit('chat-message', {
        roomId,
        message,
        username: user?.username || user?.firstName || 'Anonymous',
      });
      setMessage('');
      console.log('Sent chat message');
    }
  };

  return (
    <Box sx={{ p: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
      <Typography variant="h4" fontWeight="bold">
        Meeting Room: {roomId}
      </Typography>
      {error && (
        <Typography color="error" sx={{ mb: 2 }}>
          {error}
        </Typography>
      )}
      {!isStarted && (
        <Box sx={{ textAlign: 'center' }}>
          <Button
            onClick={startMeeting}
            variant="contained"
            color="primary"
            sx={{ px: 4, py: 2 }}
          >
            ▶️ Start Meeting
          </Button>
          <Typography color="textSecondary" sx={{ mt: 2 }}>
            Click "Start Meeting" to enable camera and mic. Open in another tab/device to test: {window.location.href}
          </Typography>
        </Box>
      )}
      {isStarted && (
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3, mt: 2 }}>
          <Box>
            <Typography variant="h6" fontWeight="medium" sx={{ mb: 1 }}>
              Your Video
            </Typography>
            <video
              ref={userVideoRef}
              autoPlay
              playsInline
              muted
              style={{ width: '300px', borderRadius: '8px', border: '1px solid #ccc', background: '#000' }}
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
            <Typography variant="h6" fontWeight="medium" sx={{ mb: 1 }}>
              Remote Video
            </Typography>
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              style={{ width: '300px', borderRadius: '8px', border: '1px solid #ccc', background: '#000' }}
            />
          </Box>
        </Box>
      )}
      {isStarted && !isConnected && (
        <Typography color="textSecondary" sx={{ mt: 2 }}>
          Waiting for connection. Share this link in another tab/device: {window.location.href}
        </Typography>
      )}
      <Box sx={{ width: '100%', maxWidth: 600, mt: 4 }}>
        <Box
          sx={{
            height: 300,
            overflowY: 'auto',
            bgcolor: '#f5f5f5',
            p: 2,
            borderRadius: 2,
          }}
        >
          {chat.map((msg, index) => (
            <Box key={index} sx={{ mb: 1 }}>
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
          <Button
            onClick={handleSend}
            variant="contained"
            sx={{ ml: 1 }}
          >
            Send
          </Button>
        </Box>
      </Box>
    </Box>
  );
};

export default MeetingRoom;