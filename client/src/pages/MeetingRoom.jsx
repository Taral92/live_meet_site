import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { useUser, UserButton } from '@clerk/clerk-react';
import {
  AppBar,
  Toolbar,
  Box,
  Typography,
  Button,
  IconButton,
  Avatar,
  Paper,
  Tooltip,
  Stack,
  TextField,
  Snackbar,
  CircularProgress,
  Fade,
  Slide,
  useTheme,
  useMediaQuery,
  Alert,
  Chip,
  Badge,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Card,
  CardContent,
  Divider,
  LinearProgress,
} from '@mui/material';
import {
  Mic,
  MicOff,
  Videocam,
  VideocamOff,
  CallEnd,
  ContentCopy,
  ChatBubbleOutline,
  ScreenShare,
  StopScreenShare,
  Settings,
  MoreVert,
  PresentToAll,
  RecordVoiceOver,
  VolumeUp,
  VolumeOff,
  Fullscreen,
  FullscreenExit,
  People,
  Security,
  SignalWifiStatusbar4Bar,
  SignalWifiStatusbarConnectedNoInternet4,
  Close,
  Send,
  EmojiEmotions,
  AttachFile,
} from '@mui/icons-material';

const backendUrl = 'http://localhost:3000';

const MeetingRoom = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user, isSignedIn, isLoaded } = useUser();

  // Video refs
  const userVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const screenShareRef = useRef(null);
  const chatMessagesRef = useRef(null);

  // WebRTC refs
  const peerConnection = useRef(null);
  const streamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const socketRef = useRef(null);

  // Meeting states
  const [isStarted, setIsStarted] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionQuality, setConnectionQuality] = useState('excellent');
  const [participants, setParticipants] = useState([]);
  const [isJoining, setIsJoining] = useState(false);

  // Media states
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);

  // UI states
  const [showChat, setShowChat] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [controlsTimeout, setControlsTimeout] = useState(null);

  // Chat states
  const [message, setMessage] = useState('');
  const [chat, setChat] = useState([]);
  const [unreadMessages, setUnreadMessages] = useState(0);

  // Error and notification states
  const [error, setError] = useState(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');
  const [isLeaving, setIsLeaving] = useState(false);
  const [leaveDialog, setLeaveDialog] = useState(false);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  }, [chat]);

  // Auto-hide controls
  useEffect(() => {
    const handleMouseMove = () => {
      setShowControls(true);
      if (controlsTimeout) clearTimeout(controlsTimeout);
      const timeout = setTimeout(() => setShowControls(false), 3000);
      setControlsTimeout(timeout);
    };

    if (isStarted) {
      document.addEventListener('mousemove', handleMouseMove);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        if (controlsTimeout) clearTimeout(controlsTimeout);
      };
    }
  }, [isStarted, controlsTimeout]);

  // Initialize socket and listeners
  useEffect(() => {
    if (!isLoaded) return;

    // Create socket connection with better error handling
    try {
      socketRef.current = io(backendUrl, { 
        transports: ['websocket', 'polling'], // Add polling as fallback
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 20000,
        forceNew: true,
      });

      const socket = socketRef.current;

      // Connection events
      socket.on('connect', () => {
        console.log('Socket connected successfully');
        showSnackbar('Connected to server', 'success');
      });

      socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        showSnackbar('Connection failed. Retrying...', 'warning');
      });

      socket.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason);
        showSnackbar('Disconnected from server', 'warning');
        setIsConnected(false);
      });

      socket.on('reconnect', (attemptNumber) => {
        console.log('Socket reconnected after', attemptNumber, 'attempts');
        showSnackbar('Reconnected to server', 'success');
      });

      socket.on('reconnect_error', (error) => {
        console.error('Socket reconnection error:', error);
        showSnackbar('Reconnection failed', 'error');
      });

      // Chat events
      socket.on('chat-message', (data) => {
        const newMessage = {
          id: Date.now() + Math.random(),
          username: data.username,
          message: data.message,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          avatar: data.avatar,
          isOwn: data.userId === user?.id
        };
        
        setChat((prev) => [...prev, newMessage]);
        
        if (!showChat) {
          setUnreadMessages(prev => prev + 1);
          showSnackbar(`New message from ${data.username}`, 'info');
        }
      });

      // Participant events
      socket.on('participants-update', (participantList) => {
        setParticipants(participantList);
      });

    } catch (error) {
      console.error('Failed to initialize socket:', error);
      setError('Failed to connect to server. Please check your connection.');
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      peerConnection.current?.close();
      streamRef.current?.getTracks?.().forEach((track) => track.stop());
      screenStreamRef.current?.getTracks?.().forEach((track) => track.stop());
    };
  }, [isLoaded, user?.id, showChat]);

  // WebRTC signaling
  useEffect(() => {
    if (!isStarted || !isLoaded || !socketRef.current) return;

    const socket = socketRef.current;
    let remoteSocketId = null;

    socket.emit('join-meeting', { 
      roomId, 
      userInfo: {
        name: user?.firstName + ' ' + user?.lastName || 'Anonymous',
        avatar: user?.imageUrl,
        id: user?.id
      }
    });

    socket.on('user-joined', async ({ socketId, userInfo }) => {
      remoteSocketId = socketId;
      showSnackbar(`${userInfo.name} joined the meeting`, 'info');
      
      if (!peerConnection.current && streamRef.current) {
        peerConnection.current = createPeerConnection(socket, remoteSocketId);
        streamRef.current.getTracks().forEach((track) => 
          peerConnection.current.addTrack(track, streamRef.current)
        );
        
        const offer = await peerConnection.current.createOffer();
        await peerConnection.current.setLocalDescription(offer);
        socket.emit('offer', { offer, target: remoteSocketId }, roomId);
      }
    });

    socket.on('offer', async ({ offer, from, userInfo }) => {
      remoteSocketId = from;
      
      if (!peerConnection.current && streamRef.current) {
        peerConnection.current = createPeerConnection(socket, remoteSocketId);
        streamRef.current.getTracks().forEach((track) => 
          peerConnection.current.addTrack(track, streamRef.current)
        );
        
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
        } catch (error) {
          console.warn('Error adding ICE candidate:', error);
        }
      }
    });

    socket.on('user-left', ({ userInfo }) => {
      showSnackbar(`${userInfo?.name || 'Someone'} left the meeting`, 'info');
      setIsConnected(false);
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
      peerConnection.current?.close();
      peerConnection.current = null;
    });

    return () => {
      socket.off('user-joined');
      socket.off('offer');
      socket.off('answer');
      socket.off('ice-candidate');
      socket.off('user-left');
      peerConnection.current?.close();
      peerConnection.current = null;
    };
  }, [isStarted, isLoaded, roomId, user]);

  const createPeerConnection = useCallback((socket, targetSocketId) => {
    const pc = new RTCPeerConnection({ 
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ] 
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('ice-candidate', { 
          candidate: event.candidate, 
          target: targetSocketId 
        }, roomId);
      }
    };

    pc.ontrack = (event) => {
      if (remoteVideoRef.current && event.streams[0]) {
        remoteVideoRef.current.srcObject = event.streams[0];
        setIsConnected(true);
        showSnackbar('Connected to participant', 'success');
      }
    };

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      setConnectionQuality(
        state === 'connected' || state === 'completed' ? 'excellent' :
        state === 'checking' ? 'good' :
        state === 'disconnected' ? 'poor' : 'failed'
      );
      
      if (state === 'connected' || state === 'completed') {
        setIsConnected(true);
      } else if (state === 'disconnected' || state === 'failed') {
        setIsConnected(false);
        showSnackbar('Connection lost', 'error');
      }
    };

    return pc;
  }, [roomId]);

  const showSnackbar = useCallback((message, severity = 'success') => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  }, []);

  const startMeeting = async () => {
    setIsJoining(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 1280 }, 
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        }, 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      streamRef.current = stream;
      setIsStarted(true);
      setError(null);
      showSnackbar('Meeting started successfully!', 'success');
    } catch (error) {
      setError(`Media access failed: ${error.message}`);
      showSnackbar('Failed to access camera/microphone', 'error');
    } finally {
      setIsJoining(false);
    }
  };

  useEffect(() => {
    if (isStarted && userVideoRef.current && streamRef.current) {
      userVideoRef.current.srcObject = streamRef.current;
      userVideoRef.current.play().catch(() => {});
    }
  }, [isStarted]);

  const toggleAudio = useCallback(() => {
    if (streamRef.current) {
      const track = streamRef.current.getAudioTracks()[0];
      if (track) {
        track.enabled = !track.enabled;
        setIsAudioMuted(!track.enabled);
        showSnackbar(track.enabled ? 'Microphone unmuted' : 'Microphone muted', 'info');
      }
    }
  }, []);

  const toggleVideo = useCallback(() => {
    if (streamRef.current) {
      const track = streamRef.current.getVideoTracks()[0];
      if (track) {
        track.enabled = !track.enabled;
        setIsVideoMuted(!track.enabled);
        showSnackbar(track.enabled ? 'Camera turned on' : 'Camera turned off', 'info');
      }
    }
  }, []);

  const toggleScreenShare = useCallback(async () => {
    try {
      if (!isScreenSharing) {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: { mediaSource: 'screen' },
          audio: true
        });
        
        screenStreamRef.current = screenStream;
        setIsScreenSharing(true);
        showSnackbar('Screen sharing started', 'success');
        
        // Handle screen share end
        screenStream.getVideoTracks()[0].onended = () => {
          setIsScreenSharing(false);
          screenStreamRef.current = null;
          showSnackbar('Screen sharing stopped', 'info');
        };
      } else {
        screenStreamRef.current?.getTracks().forEach(track => track.stop());
        screenStreamRef.current = null;
        setIsScreenSharing(false);
        showSnackbar('Screen sharing stopped', 'info');
      }
    } catch (error) {
      showSnackbar('Failed to share screen', 'error');
    }
  }, [isScreenSharing]);

  const copyMeetingLink = useCallback(() => {
    navigator.clipboard.writeText(window.location.href);
    showSnackbar('Meeting link copied to clipboard!', 'success');
  }, []);

  const leaveMeeting = useCallback(() => {
    setLeaveDialog(false);
    setIsLeaving(true);
    
    setTimeout(() => {
      // Clean up streams
      streamRef.current?.getTracks()?.forEach((track) => track.stop());
      screenStreamRef.current?.getTracks()?.forEach((track) => track.stop());
      
      // Clean up peer connection
      peerConnection.current?.close();
      peerConnection.current = null;
      
      // Clean up video elements
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
      if (userVideoRef.current) userVideoRef.current.srcObject = null;
      
      // Emit leave event
      socketRef.current?.emit('leave-meeting', roomId);
      
      // Reset states
      setIsStarted(false);
      setIsConnected(false);
      setError(null);
      setIsLeaving(false);
      
      // Navigate back
      navigate('/');
    }, 1000);
  }, [roomId, navigate]);

  const handleSendMessage = useCallback(() => {
    if (message.trim() && socketRef.current && user) {
      socketRef.current.emit('chat-message', { 
        roomId, 
        message: message.trim(), 
        username: user?.firstName + ' ' + user?.lastName || 'Anonymous',
        avatar: user?.imageUrl,
        userId: user?.id
      });
      setMessage('');
    }
  }, [message, roomId, user]);

  const toggleChat = useCallback(() => {
    setShowChat(!showChat);
    if (!showChat) {
      setUnreadMessages(0);
    }
  }, [showChat]);

  const getInitials = useCallback((name) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
  }, []);

  const getConnectionIcon = () => {
    switch (connectionQuality) {
      case 'excellent': return <SignalWifiStatusbar4Bar sx={{ color: '#4caf50' }} />;
      case 'good': return <SignalWifiStatusbar4Bar sx={{ color: '#ff9800' }} />;
      case 'poor': return <SignalWifiStatusbarConnectedNoInternet4 sx={{ color: '#f44336' }} />;
      default: return <SignalWifiStatusbarConnectedNoInternet4 sx={{ color: '#f44336' }} />;
    }
  };

  return (
    <Box sx={{ 
      minHeight: '100vh', 
      bgcolor: '#0f1419',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <Fade in={showControls || !isStarted}>
        <AppBar 
          position="fixed" 
          elevation={0}
          sx={{ 
            bgcolor: 'rgba(15, 20, 25, 0.95)',
            backdropFilter: 'blur(10px)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            zIndex: 1300
          }}
        >
          <Toolbar sx={{ minHeight: 64, justifyContent: 'space-between' }}>
            <Stack direction="row" spacing={2} alignItems="center">
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: 2,
                  background: 'linear-gradient(135deg, #667eea, #764ba2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Videocam sx={{ color: 'white', fontSize: 20 }} />
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#fff' }}>
                VideoMeet Pro
              </Typography>
              <Chip
                label={`Room: ${roomId}`}
                size="small"
                sx={{
                  bgcolor: 'rgba(255, 255, 255, 0.1)',
                  color: '#fff',
                  fontWeight: 600,
                }}
              />
            </Stack>

            <Stack direction="row" spacing={2} alignItems="center">
              {isStarted && (
                <>
                  <Tooltip title="Connection Quality">
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      {getConnectionIcon()}
                    </Box>
                  </Tooltip>
                  
                  <Tooltip title="Participants">
                    <IconButton 
                      onClick={() => setShowParticipants(!showParticipants)}
                      sx={{ color: '#fff' }}
                    >
                      <Badge badgeContent={participants.length + 1} color="primary">
                        <People />
                      </Badge>
                    </IconButton>
                  </Tooltip>

                  <Tooltip title="Copy Meeting Link">
                    <IconButton onClick={copyMeetingLink} sx={{ color: '#fff' }}>
                      <ContentCopy />
                    </IconButton>
                  </Tooltip>
                </>
              )}

              {isLoaded && isSignedIn ? (
                <UserButton 
                  afterSignOutUrl="/"
                  appearance={{
                    elements: {
                      userButtonPopoverCard: {
                        borderRadius: 16,
                        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
                      },
                    },
                  }}
                />
              ) : (
                <Button 
                  color="primary" 
                  variant="outlined" 
                  size="small" 
                  onClick={() => window.location.reload()}
                  sx={{ color: '#fff', borderColor: '#fff' }}
                >
                  Sign In
                </Button>
              )}
            </Stack>
          </Toolbar>
        </AppBar>
      </Fade>

      {/* Error Display */}
      {error && (
        <Fade in>
          <Alert 
            severity="error" 
            sx={{ 
              position: 'fixed',
              top: 80,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 1400,
              minWidth: 300,
              borderRadius: 2,
            }}
            onClose={() => setError(null)}
          >
            {error}
          </Alert>
        </Fade>
      )}

      {/* Main Content */}
      <Box sx={{ pt: 8, height: '100vh', display: 'flex', flexDirection: 'column' }}>
        {!isStarted ? (
          /* Pre-Meeting Screen */
          <Box sx={{ 
            flex: 1,
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center',
            px: 3
          }}>
            <Fade in timeout={800}>
              <Paper
                elevation={0}
                sx={{
                  p: 6,
                  borderRadius: 4,
                  background: 'rgba(255, 255, 255, 0.05)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  textAlign: 'center',
                  maxWidth: 500,
                }}
              >
                <Box
                  sx={{
                    width: 100,
                    height: 100,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #667eea, #764ba2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mx: 'auto',
                    mb: 4,
                    boxShadow: '0 20px 60px rgba(102, 126, 234, 0.4)',
                  }}
                >
                  <Videocam sx={{ fontSize: 50, color: 'white' }} />
                </Box>

                <Typography 
                  variant="h4" 
                  fontWeight={700} 
                  sx={{ color: '#fff', mb: 2 }}
                >
                  Ready to Join?
                </Typography>

                <Typography 
                  variant="body1" 
                  sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 4, lineHeight: 1.6 }}
                >
                  Click the button below to enable your camera and microphone, then start your meeting.
                </Typography>

                <Button 
                  variant="contained" 
                  size="large"
                  onClick={startMeeting}
                  disabled={isJoining}
                  sx={{ 
                    px: 6, 
                    py: 2, 
                    fontSize: 18, 
                    fontWeight: 700,
                    borderRadius: 3,
                    background: 'linear-gradient(135deg, #667eea, #764ba2)',
                    boxShadow: '0 12px 40px rgba(102, 126, 234, 0.4)',
                    mb: 4,
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: '0 16px 50px rgba(102, 126, 234, 0.5)',
                    }
                  }}
                >
                  {isJoining ? (
                    <Stack direction="row" spacing={2} alignItems="center">
                      <CircularProgress size={20} sx={{ color: 'white' }} />
                      <Typography>Joining...</Typography>
                    </Stack>
                  ) : (
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Videocam />
                      <Typography>Join Meeting</Typography>
                    </Stack>
                  )}
                </Button>

                <Paper
                  sx={{
                    p: 3,
                    borderRadius: 3,
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                  }}
                >
                  <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.6)', mb: 1 }}>
                    Meeting Link:
                  </Typography>
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      color: '#64b5f6', 
                      fontFamily: 'monospace',
                      wordBreak: 'break-all',
                      fontWeight: 600
                    }}
                  >
                    {window.location.href}
                  </Typography>
                </Paper>
              </Paper>
            </Fade>
          </Box>
        ) : (
          /* Meeting Screen */
          <Box sx={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            {/* Main Layout Container */}
            <Box sx={{ 
              display: 'flex',
              height: '100%',
              flexDirection: isMobile ? 'column' : 'row'
            }}>
              {/* Video Area */}
              <Box sx={{ 
                flex: showChat ? (isMobile ? 1 : '0 0 75%') : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                p: 2,
                gap: 2,
                flexDirection: isMobile && isConnected ? 'column' : 'row'
              }}>
                {/* Remote Video */}
                <Paper
                  elevation={8}
                  sx={{
                    position: 'relative',
                    borderRadius: 3,
                    overflow: 'hidden',
                    flex: 1,
                    width: '100%',
                    maxWidth: isConnected ? (isMobile ? '100%' : '50%') : '70%',
                    aspectRatio: '16/9',
                    background: '#000',
                  }}
                >
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                  />
                  
                  {!isConnected && (
                    <Box sx={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'rgba(0, 0, 0, 0.8)',
                      color: 'white',
                    }}>
                      <CircularProgress size={60} sx={{ color: '#667eea', mb: 3 }} />
                      <Typography variant="h6" fontWeight={600}>
                        Waiting for participants...
                      </Typography>
                      <Typography variant="body2" sx={{ opacity: 0.7, mt: 1 }}>
                        Share the meeting link to invite others
                      </Typography>
                    </Box>
                  )}

                  {isConnected && (
                    <Box sx={{
                      position: 'absolute',
                      bottom: 16,
                      left: 16,
                      background: 'rgba(0, 0, 0, 0.7)',
                      borderRadius: 2,
                      px: 2,
                      py: 1,
                    }}>
                      <Typography variant="body2" sx={{ color: 'white', fontWeight: 600 }}>
                        Remote Participant
                      </Typography>
                    </Box>
                  )}
                </Paper>

                {/* Local Video */}
                <Paper
                  elevation={8}
                  sx={{
                    position: 'relative',
                    borderRadius: 3,
                    overflow: 'hidden',
                    flex: 1,
                    width: '100%',
                    maxWidth: isConnected ? (isMobile ? '100%' : '50%') : '70%',
                    aspectRatio: '16/9',
                    background: '#000',
                  }}
                >
                  <video
                    ref={userVideoRef}
                    autoPlay
                    muted
                    playsInline
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      transform: 'scaleX(-1)', // Mirror effect
                    }}
                  />

                  {isVideoMuted && (
                    <Box sx={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'rgba(0, 0, 0, 0.8)',
                    }}>
                      <Avatar
                        src={user?.imageUrl}
                        sx={{
                          width: 80,
                          height: 80,
                          fontSize: 32,
                          fontWeight: 600,
                          background: 'linear-gradient(135deg, #667eea, #764ba2)',
                        }}
                      >
                        {getInitials(user?.firstName + ' ' + user?.lastName)}
                      </Avatar>
                    </Box>
                  )}

                  <Box sx={{
                    position: 'absolute',
                    bottom: 16,
                    left: 16,
                    background: 'rgba(0, 0, 0, 0.7)',
                    borderRadius: 2,
                    px: 2,
                    py: 1,
                  }}>
                    <Typography variant="body2" sx={{ color: 'white', fontWeight: 600 }}>
                      You {isAudioMuted && '(Muted)'}
                    </Typography>
                  </Box>
                </Paper>
              </Box>

              {/* Chat Panel */}
              {showChat && (
                <Box sx={{ 
                  flex: isMobile ? '0 0 40%' : '0 0 25%',
                  minWidth: isMobile ? 'auto' : 320,
                  maxWidth: isMobile ? 'auto' : 400
                }}>
                  <Slide direction={isMobile ? "up" : "left"} in={showChat}>
                    <Paper
                      elevation={8}
                      sx={{
                        height: '100%',
                        background: 'rgba(15, 20, 25, 0.95)',
                        backdropFilter: 'blur(20px)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        display: 'flex',
                        flexDirection: 'column',
                        borderRadius: 0,
                      }}
                    >
                      {/* Chat Header */}
                      <Box sx={{
                        p: 3,
                        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: 'rgba(102, 126, 234, 0.1)',
                      }}>
                        <Stack direction="row" spacing={2} alignItems="center">
                          <ChatBubbleOutline sx={{ color: '#667eea' }} />
                          <Typography variant="h6" sx={{ color: '#fff', fontWeight: 600 }}>
                            Meeting Chat
                          </Typography>
                          {chat.length > 0 && (
                            <Chip 
                              label={chat.length} 
                              size="small" 
                              sx={{ 
                                bgcolor: '#667eea', 
                                color: 'white',
                                fontSize: 12,
                                height: 20
                              }} 
                            />
                          )}
                        </Stack>
                        <IconButton 
                          onClick={() => setShowChat(false)}
                          size="small"
                          sx={{ 
                            color: 'rgba(255, 255, 255, 0.7)',
                            '&:hover': {
                              color: '#fff',
                              background: 'rgba(255, 255, 255, 0.1)'
                            }
                          }}
                        >
                          <Close />
                        </IconButton>
                      </Box>

                      {/* Chat Messages */}
                      <Box 
                        ref={chatMessagesRef}
                        sx={{
                          flex: 1,
                          overflowY: 'auto',
                          p: 2,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 2,
                          '&::-webkit-scrollbar': {
                            width: '6px',
                          },
                          '&::-webkit-scrollbar-track': {
                            background: 'rgba(255, 255, 255, 0.1)',
                            borderRadius: '3px',
                          },
                          '&::-webkit-scrollbar-thumb': {
                            background: 'rgba(102, 126, 234, 0.5)',
                            borderRadius: '3px',
                            '&:hover': {
                              background: 'rgba(102, 126, 234, 0.7)',
                            },
                          },
                        }}
                      >
                        {chat.length === 0 ? (
                          <Box sx={{
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexDirection: 'column',
                            opacity: 0.6,
                          }}>
                            <ChatBubbleOutline sx={{ fontSize: 48, color: 'rgba(255, 255, 255, 0.3)', mb: 2 }} />
                            <Typography sx={{ color: 'rgba(255, 255, 255, 0.5)', textAlign: 'center', fontSize: 14 }}>
                              No messages yet
                            </Typography>
                            <Typography sx={{ color: 'rgba(255, 255, 255, 0.3)', textAlign: 'center', fontSize: 12, mt: 1 }}>
                              Start the conversation!
                            </Typography>
                          </Box>
                        ) : (
                          chat.map((msg) => (
                            <Box key={msg.id}>
                              <Paper
                                elevation={0}
                                sx={{
                                  p: 2,
                                  borderRadius: 3,
                                  background: msg.isOwn 
                                    ? 'linear-gradient(135deg, #667eea, #764ba2)' 
                                    : 'rgba(255, 255, 255, 0.05)',
                                  border: msg.isOwn 
                                    ? 'none' 
                                    : '1px solid rgba(255, 255, 255, 0.1)',
                                  ml: msg.isOwn ? 4 : 0,
                                  mr: msg.isOwn ? 0 : 4,
                                }}
                              >
                                <Stack direction="row" spacing={2} alignItems="flex-start">
                                  {!msg.isOwn && (
                                    <Avatar
                                      src={msg.avatar}
                                      sx={{ 
                                        width: 32, 
                                        height: 32, 
                                        fontSize: 14,
                                        background: 'linear-gradient(135deg, #667eea, #764ba2)'
                                      }}
                                    >
                                      {getInitials(msg.username)}
                                    </Avatar>
                                  )}
                                  <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Stack 
                                      direction="row" 
                                      spacing={1} 
                                      alignItems="center" 
                                      mb={0.5}
                                      justifyContent={msg.isOwn ? 'flex-end' : 'flex-start'}
                                    >
                                      <Typography 
                                        variant="caption" 
                                        sx={{ 
                                          color: msg.isOwn ? 'rgba(255, 255, 255, 0.9)' : '#64b5f6', 
                                          fontWeight: 600 
                                        }}
                                      >
                                        {msg.isOwn ? 'You' : msg.username}
                                      </Typography>
                                      <Typography 
                                        variant="caption" 
                                        sx={{ 
                                          color: msg.isOwn ? 'rgba(255, 255, 255, 0.7)' : 'rgba(255, 255, 255, 0.5)',
                                          fontSize: 11
                                        }}
                                      >
                                        {msg.timestamp}
                                      </Typography>
                                    </Stack>
                                    <Typography 
                                      variant="body2" 
                                      sx={{ 
                                        color: '#fff',
                                        wordBreak: 'break-word',
                                        lineHeight: 1.4,
                                        textAlign: msg.isOwn ? 'right' : 'left'
                                      }}
                                    >
                                      {msg.message}
                                    </Typography>
                                  </Box>
                                  {msg.isOwn && (
                                    <Avatar
                                      src={msg.avatar}
                                      sx={{ 
                                        width: 32, 
                                        height: 32, 
                                        fontSize: 14,
                                        background: 'rgba(255, 255, 255, 0.2)'
                                      }}
                                    >
                                      {getInitials(msg.username)}
                                    </Avatar>
                                  )}
                                </Stack>
                              </Paper>
                            </Box>
                          ))
                        )}
                      </Box>

                      {/* Chat Input */}
                      <Box sx={{
                        p: 3,
                        borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                        background: 'rgba(255, 255, 255, 0.02)',
                      }}>
                        <Stack direction="row" spacing={2} alignItems="flex-end">
                          <TextField
                            fullWidth
                            multiline
                            maxRows={3}
                            size="small"
                            variant="outlined"
                            placeholder="Type your message..."
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSendMessage();
                              }
                            }}
                            sx={{
                              '& .MuiOutlinedInput-root': {
                                color: '#fff',
                                borderRadius: 3,
                                background: 'rgba(255, 255, 255, 0.05)',
                                '& fieldset': {
                                  borderColor: 'rgba(255, 255, 255, 0.2)',
                                },
                                '&:hover fieldset': {
                                  borderColor: 'rgba(255, 255, 255, 0.3)',
                                },
                                '&.Mui-focused fieldset': {
                                  borderColor: '#667eea',
                                },
                              },
                              '& .MuiInputBase-input::placeholder': {
                                color: 'rgba(255, 255, 255, 0.5)',
                              },
                            }}
                          />
                          <IconButton 
                            onClick={handleSendMessage}
                            disabled={!message.trim()}
                            sx={{
                              width: 48,
                              height: 48,
                              background: message.trim() 
                                ? 'linear-gradient(135deg, #667eea, #764ba2)' 
                                : 'rgba(255, 255, 255, 0.1)',
                              color: 'white',
                              '&:hover': {
                                background: message.trim() 
                                  ? 'linear-gradient(135deg, #5a6fd8, #6a4c93)' 
                                  : 'rgba(255, 255, 255, 0.15)',
                                transform: message.trim() ? 'scale(1.05)' : 'none',
                              },
                              '&:disabled': {
                                background: 'rgba(255, 255, 255, 0.05)',
                                color: 'rgba(255, 255, 255, 0.3)',
                              },
                              transition: 'all 0.2s ease',
                            }}
                          >
                            <Send />
                          </IconButton>
                        </Stack>
                        <Typography 
                          variant="caption" 
                          sx={{ 
                            color: 'rgba(255, 255, 255, 0.4)', 
                            mt: 1, 
                            display: 'block',
                            textAlign: 'center'
                          }}
                        >
                          Press Enter to send, Shift+Enter for new line
                        </Typography>
                      </Box>
                    </Paper>
                  </Slide>
                </Box>
              )}
            </Box>

            {/* Meeting Controls */}
            <Fade in={showControls || !isStarted}>
              <Box sx={{
                position: 'fixed',
                bottom: 20,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 1300,
              }}>
                <Paper
                  elevation={8}
                  sx={{
                    px: 3,
                    py: 2,
                    borderRadius: 6,
                    background: 'rgba(0, 0, 0, 0.8)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                  }}
                >
                  <Stack direction="row" spacing={2} alignItems="center">
                    {/* Audio Control */}
                    <Tooltip title={isAudioMuted ? 'Unmute Microphone' : 'Mute Microphone'}>
                      <IconButton
                        onClick={toggleAudio}
                        sx={{
                          width: 56,
                          height: 56,
                          background: isAudioMuted ? '#f44336' : 'rgba(255, 255, 255, 0.1)',
                          color: isAudioMuted ? 'white' : '#fff',
                          '&:hover': {
                            background: isAudioMuted ? '#d32f2f' : 'rgba(255, 255, 255, 0.2)',
                            transform: 'scale(1.1)',
                          },
                          transition: 'all 0.2s ease',
                        }}
                      >
                        {isAudioMuted ? <MicOff /> : <Mic />}
                      </IconButton>
                    </Tooltip>

                    {/* Video Control */}
                    <Tooltip title={isVideoMuted ? 'Turn On Camera' : 'Turn Off Camera'}>
                      <IconButton
                        onClick={toggleVideo}
                        sx={{
                          width: 56,
                          height: 56,
                          background: isVideoMuted ? '#f44336' : 'rgba(255, 255, 255, 0.1)',
                          color: isVideoMuted ? 'white' : '#fff',
                          '&:hover': {
                            background: isVideoMuted ? '#d32f2f' : 'rgba(255, 255, 255, 0.2)',
                            transform: 'scale(1.1)',
                          },
                          transition: 'all 0.2s ease',
                        }}
                      >
                        {isVideoMuted ? <VideocamOff /> : <Videocam />}
                      </IconButton>
                    </Tooltip>

                    {/* Screen Share */}
                    <Tooltip title={isScreenSharing ? 'Stop Screen Share' : 'Share Screen'}>
                      <IconButton
                        onClick={toggleScreenShare}
                        sx={{
                          width: 56,
                          height: 56,
                          background: isScreenSharing ? '#4caf50' : 'rgba(255, 255, 255, 0.1)',
                          color: 'white',
                          '&:hover': {
                            background: isScreenSharing ? '#45a049' : 'rgba(255, 255, 255, 0.2)',
                            transform: 'scale(1.1)',
                          },
                          transition: 'all 0.2s ease',
                        }}
                      >
                        {isScreenSharing ? <StopScreenShare /> : <ScreenShare />}
                      </IconButton>
                    </Tooltip>

                    <Divider orientation="vertical" flexItem sx={{ bgcolor: 'rgba(255, 255, 255, 0.2)' }} />

                    {/* Chat Toggle */}
                    <Tooltip title="Toggle Chat">
                      <IconButton
                        onClick={toggleChat}
                        sx={{
                          width: 56,
                          height: 56,
                          background: showChat ? '#667eea' : 'rgba(255, 255, 255, 0.1)',
                          color: 'white',
                          position: 'relative',
                          '&:hover': {
                            background: showChat ? '#5a6fd8' : 'rgba(255, 255, 255, 0.2)',
                            transform: 'scale(1.1)',
                          },
                          transition: 'all 0.2s ease',
                        }}
                      >
                        <Badge badgeContent={unreadMessages} color="error">
                          <ChatBubbleOutline />
                        </Badge>
                      </IconButton>
                    </Tooltip>

                    {/* Settings */}
                    <Tooltip title="Settings">
                      <IconButton
                        onClick={() => setShowSettings(true)}
                        sx={{
                          width: 56,
                          height: 56,
                          background: 'rgba(255, 255, 255, 0.1)',
                          color: '#fff',
                          '&:hover': {
                            background: 'rgba(255, 255, 255, 0.2)',
                            transform: 'scale(1.1)',
                          },
                          transition: 'all 0.2s ease',
                        }}
                      >
                        <Settings />
                      </IconButton>
                    </Tooltip>

                    <Divider orientation="vertical" flexItem sx={{ bgcolor: 'rgba(255, 255, 255, 0.2)' }} />

                    {/* Leave Meeting */}
                    <Tooltip title="Leave Meeting">
                      <IconButton
                        onClick={() => setLeaveDialog(true)}
                        disabled={isLeaving}
                        sx={{
                          width: 56,
                          height: 56,
                          background: '#f44336',
                          color: 'white',
                          '&:hover': {
                            background: '#d32f2f',
                            transform: 'scale(1.1)',
                          },
                          '&:disabled': {
                            background: '#666',
                          },
                          transition: 'all 0.2s ease',
                        }}
                      >
                        {isLeaving ? <CircularProgress size={24} sx={{ color: 'white' }} /> : <CallEnd />}
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </Paper>
              </Box>
            </Fade>
          </Box>
        )}
      </Box>

      {/* Leave Meeting Dialog */}
      <Dialog
        open={leaveDialog}
        onClose={() => setLeaveDialog(false)}
        PaperProps={{
          sx: {
            borderRadius: 3,
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(20px)',
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 600 }}>
          Leave Meeting?
        </DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to leave this meeting? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 3, gap: 1 }}>
          <Button 
            onClick={() => setLeaveDialog(false)}
            variant="outlined"
            sx={{ borderRadius: 2 }}
          >
            Cancel
          </Button>
          <Button 
            onClick={leaveMeeting}
            variant="contained"
            color="error"
            sx={{ borderRadius: 2 }}
          >
            Leave Meeting
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={{ mb: 10 }}
      >
        <Alert
          onClose={() => setSnackbarOpen(false)}
          severity={snackbarSeverity}
          sx={{
            borderRadius: 3,
            fontWeight: 600,
            boxShadow: '0 12px 40px rgba(0, 0, 0, 0.2)',
            backdropFilter: 'blur(10px)',
            minWidth: 300,
          }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default MeetingRoom;