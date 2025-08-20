"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import { useUser } from "@clerk/clerk-react";
import { UserButton } from "@clerk/clerk-react";
import {
  Box,
  TextField,
  Button,
  IconButton,
  Typography,
  Paper,
  Chip,
  Container,
  Zoom,
  CircularProgress,
  useTheme,
  useMediaQuery,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Fab,
  Alert,
} from "@mui/material";
import {
  Mic,
  MicOff,
  Videocam,
  VideocamOff,
  Send,
  PlayArrow,
  VideoCall,
  ChatBubble,
  CallEnd,
  Close,
  ScreenShare,
  StopScreenShare,
} from "@mui/icons-material";

const backendUrl = "https://live-meet-site.onrender.com";

// Helper component for video display
const VideoPlayer = ({ stream, isMuted = false, isFlipped = false, label = "" }) => (
  <Paper
    sx={{
      width: "100%",
      height: "100%",
      bgcolor: "black",
      position: "relative",
      overflow: "hidden",
      borderRadius: 2,
    }}
  >
    <video
      ref={(el) => {
        if (el && stream) el.srcObject = stream;
      }}
      autoPlay
      playsInline
      muted={isMuted}
      style={{
        width: "100%",
        height: "100%",
        objectFit: "cover",
        transform: isFlipped ? "scaleX(-1)" : "none",
      }}
    />
    {label && (
      <Chip
        label={label}
        size="small"
        sx={{
          position: "absolute",
          top: 16,
          left: 16,
          bgcolor: "rgba(0,0,0,0.7)",
          color: "white",
          zIndex: 2,
        }}
      />
    )}
    {!stream && (
      <Box
        sx={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          textAlign: "center",
          color: "white",
        }}
      >
        <CircularProgress color="inherit" size={40} />
        <Typography variant="body2" mt={2}>
          Waiting for video...
        </Typography>
      </Box>
    )}
  </Paper>
);

// Chat component moved outside to prevent re-renders and focus loss
const ChatComponent = ({
  isDrawer = false,
  chat,
  user,
  message,
  setMessage,
  handleSend,
  socketConnected,
  onClose,
}) => {
  const chatEndRef = useRef(null);

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat]);

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column", bgcolor: "white" }}>
      <Box sx={{ p: 2, borderBottom: "1px solid #e0e0e0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Typography variant="h6">Chat</Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {chat.length > 0 && <Chip label={chat.length} size="small" color="primary" sx={{ fontSize: "0.75rem" }} />}
          {isDrawer && <IconButton onClick={onClose} size="small"><Close /></IconButton>}
        </Box>
      </Box>
      <Box sx={{ flex: 1, overflowY: "auto", p: 2 }}>
        {chat.length === 0 ? (
          <Box sx={{ textAlign: "center", py: 8, color: "text.secondary", display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <ChatBubble sx={{ fontSize: 48, opacity: 0.3 }} />
            <Typography variant="body2">No messages yet</Typography>
            <Typography variant="caption">Start the conversation!</Typography>
          </Box>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {chat.map((msg, idx) => {
              const isOwnMessage = msg.username === (user?.username || user?.firstName || "Anonymous");
              return (
                <Box key={idx} sx={{ display: "flex", flexDirection: "column", alignItems: isOwnMessage ? "flex-end" : "flex-start" }}>
                  <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, px: 1 }}>
                    {msg.username} • {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Typography>
                  <Paper elevation={1} sx={{ p: 1.5, borderRadius: 2, bgcolor: isOwnMessage ? "primary.main" : "grey.200", color: isOwnMessage ? "white" : "text.primary", maxWidth: "80%", wordWrap: "break-word" }}>
                    <Typography variant="body2">{msg.message}</Typography>
                  </Paper>
                </Box>
              );
            })}
            <div ref={chatEndRef} />
          </Box>
        )}
      </Box>
      <Box sx={{ p: 2, borderTop: "1px solid #e0e0e0", display: "flex", gap: 1 }}>
        <TextField fullWidth value={message} onChange={(e) => setMessage(e.target.value)} onKeyPress={handleKeyPress} placeholder="Type a message..." size="small" disabled={!socketConnected} autoFocus={isDrawer} />
        <IconButton onClick={handleSend} disabled={!message.trim() || !socketConnected} color="primary" sx={{ bgcolor: message.trim() && socketConnected ? "primary.main" : "grey.300", color: message.trim() && socketConnected ? "white" : "grey.500", "&:hover": { bgcolor: message.trim() && socketConnected ? "primary.dark" : "grey.400" } }}>
          <Send />
        </IconButton>
      </Box>
    </Box>
  );
};


const MeetingRoom = () => {
  const { roomId } = useParams();
  const { user, isLoaded } = useUser();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  // Refs
  const socketRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const localScreenStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const remoteScreenStreamRef = useRef(null);
  const originalVideoTrackRef = useRef(null);

  // States
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isStarted, setIsStarted] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const [chat, setChat] = useState([]);
  const [message, setMessage] = useState("");
  const [isChatOpen, setIsChatOpen] = useState(false);

  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isRemoteScreenSharing, setIsRemoteScreenSharing] = useState(false);
  const [isScreenShareLoading, setIsScreenShareLoading] = useState(false);

  const [showLeaveDialog, setShowLeaveDialog] = useState(false);

  const cleanup = useCallback(() => {
    console.log("Cleaning up resources...");
    
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    
    if (localScreenStreamRef.current) {
      localScreenStreamRef.current.getTracks().forEach((track) => track.stop());
      localScreenStreamRef.current = null;
    }
    
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    remoteStreamRef.current = null;
    remoteScreenStreamRef.current = null;
    originalVideoTrackRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    setIsConnected(false);
    setIsScreenSharing(false);
    setIsRemoteScreenSharing(false);
  }, []);

  useEffect(() => {
    if (!isLoaded) return;

    socketRef.current = io(backendUrl, {
      reconnectionAttempts: 5,
      timeout: 10000,
      forceNew: true,
    });

    socketRef.current.on("connect", () => {
      console.log("✅ Socket connected:", socketRef.current.id);
      setSocketConnected(true);
      setIsLoading(false);
      setError(null);
    });

    socketRef.current.on("connect_error", (err) => {
      console.error("❌ Socket connection error:", err);
      setError(`Server connection failed. Make sure server is running on ${backendUrl}`);
      setIsLoading(false);
      setSocketConnected(false);
    });

    socketRef.current.on("disconnect", (reason) => {
      console.log("❌ Socket disconnected:", reason);
      setSocketConnected(false);
      setIsConnected(false);
    });

    return cleanup;
  }, [isLoaded, cleanup]);

  const startMeeting = async () => {
    setError(null);
    setIsLoading(true);
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });

      localStreamRef.current = stream;
      originalVideoTrackRef.current = stream.getVideoTracks()[0];
      setLocalStream(stream);
      setIsStarted(true);
      
      if (socketRef.current?.connected) {
        socketRef.current.emit("join-meeting", roomId);
      }
      
    } catch (err) {
      console.error("❌ Failed to get media devices:", err);
      let errorMessage = "Could not access camera/microphone. ";
      if (err.name === "NotAllowedError") errorMessage += "Please allow camera and microphone permissions.";
      else if (err.name === "NotFoundError") errorMessage += "No camera or microphone found.";
      else errorMessage += err.message;
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUserLeft = useCallback(() => {
    console.log("👋 Remote user left the meeting");
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    remoteStreamRef.current = null;
    remoteScreenStreamRef.current = null;
    setRemoteStream(null);
    setIsConnected(false);
    setIsRemoteScreenSharing(false);
  }, []);

  const createPeerConnection = useCallback((targetSocketId) => {
    if (peerConnectionRef.current) peerConnectionRef.current.close();

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current.emit("ice-candidate", { candidate: event.candidate, target: targetSocketId }, roomId);
      }
    };

    pc.ontrack = (event) => {
      const stream = event.streams[0];
      if (event.track.kind === "video") {
        const isScreenTrack = event.track.getSettings().displaySurface || event.track.label.toLowerCase().includes('screen');
        if (isScreenTrack) {
          remoteScreenStreamRef.current = stream;
          setIsRemoteScreenSharing(true);
        } else {
          remoteStreamRef.current = stream;
          setRemoteStream(stream);
        }
      } else if (event.track.kind === "audio") {
        if (!remoteStreamRef.current) remoteStreamRef.current = new MediaStream();
        remoteStreamRef.current.getAudioTracks().forEach(track => remoteStreamRef.current.removeTrack(track));
        remoteStreamRef.current.addTrack(event.track);
        setRemoteStream(new MediaStream(remoteStreamRef.current.getTracks()));
      }
    };

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      if (state === "connected" || state === "completed") setIsConnected(true);
      else if (["disconnected", "failed", "closed"].includes(state)) handleUserLeft();
    };

    localStreamRef.current.getTracks().forEach((track) => pc.addTrack(track, localStreamRef.current));
    peerConnectionRef.current = pc;
    return pc;
  }, [handleUserLeft, roomId]);

  useEffect(() => {
    if (!isStarted || !socketConnected || !socketRef.current) return;

    const socket = socketRef.current;

    const signalingHandlers = {
      "user-joined": async ({ socketId }) => {
        const pc = createPeerConnection(socketId);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("offer", { offer, target: socketId }, roomId);
      },
      "offer": async ({ offer, from }) => {
        const pc = createPeerConnection(from);
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("answer", { answer, target: from }, roomId);
      },
      "answer": async ({ answer }) => {
        if (peerConnectionRef.current) await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
      },
      "ice-candidate": async ({ candidate }) => {
        if (peerConnectionRef.current && candidate) await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      },
      "user-left": handleUserLeft,
      "peer-screen-share-start": () => setIsRemoteScreenSharing(true),
      "peer-screen-share-stop": () => setIsRemoteScreenSharing(false),
      "chat-message": (data) => setChat((prev) => [...prev, data]),
    };

    Object.entries(signalingHandlers).forEach(([event, handler]) => socket.on(event, handler));

    return () => Object.keys(signalingHandlers).forEach(event => socket.off(event));
  }, [isStarted, socketConnected, roomId, createPeerConnection, handleUserLeft]);

  const toggleAudio = () => {
    if (!localStreamRef.current) return;
    localStreamRef.current.getAudioTracks().forEach((track) => {
      track.enabled = !track.enabled;
      setIsAudioMuted(!track.enabled);
    });
  };

  const toggleVideo = () => {
    if (!localStreamRef.current) return;
    localStreamRef.current.getVideoTracks().forEach((track) => {
      track.enabled = !track.enabled;
      setIsVideoMuted(!track.enabled);
    });
  };

  const toggleScreenShare = async () => {
    if (isScreenShareLoading) return;
    setIsScreenShareLoading(true);
    setError(null);

    const videoSender = peerConnectionRef.current?.getSenders().find(s => s.track?.kind === 'video');

    try {
      if (isScreenSharing) {
        if (localScreenStreamRef.current) {
          localScreenStreamRef.current.getTracks().forEach(track => track.stop());
          localScreenStreamRef.current = null;
        }
        if (videoSender && originalVideoTrackRef.current) {
          await videoSender.replaceTrack(originalVideoTrackRef.current);
        }
        setLocalStream(localStreamRef.current);
        setIsScreenSharing(false);
        socketRef.current?.emit("screen-share-stop", roomId);
      } else {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screenStream.getVideoTracks()[0];
        if (!screenTrack) throw new Error("No screen track found.");
        
        if (videoSender) await videoSender.replaceTrack(screenTrack);
        
        screenTrack.onended = () => {
            setIsScreenSharing(isSharing => {
                if(isSharing) toggleScreenShare();
                return false;
            });
        };

        localScreenStreamRef.current = screenStream;
        setLocalStream(screenStream);
        setIsScreenSharing(true);
        socketRef.current?.emit("screen-share-start", roomId);
      }
    } catch (err) {
      setError("Could not start screen sharing. Please grant permission.");
      setLocalStream(localStreamRef.current);
      setIsScreenSharing(false);
    } finally {
      setIsScreenShareLoading(false);
    }
  };

  const handleSend = () => {
    if (!message.trim() || !socketConnected) return;
    const msgData = {
      roomId,
      message: message.trim(),
      username: user?.username || user?.firstName || "Anonymous",
    };
    socketRef.current.emit("chat-message", msgData);
    setMessage("");
  };

  const leaveMeeting = () => {
    if (socketRef.current?.connected) socketRef.current.emit("leave-room", roomId);
    cleanup();
    navigate("/");
  };

  const mainViewStream = isScreenSharing ? localStream : isRemoteScreenSharing ? (remoteScreenStreamRef.current || remoteStream) : remoteStream;
  const mainViewLabel = isScreenSharing ? "Your Screen" : isRemoteScreenSharing ? "Participant's Screen" : "Participant";

  const pipViews = [];
  if (isScreenSharing) {
    pipViews.push({ stream: localStreamRef.current, label: "You (Camera)", isFlipped: true, isMuted: true });
    if (remoteStream) pipViews.push({ stream: remoteStream, label: "Participant", isMuted: false });
  } else if (isRemoteScreenSharing) {
    pipViews.push({ stream: localStream, label: "You", isFlipped: true, isMuted: true });
    if (remoteStream) pipViews.push({ stream: remoteStream, label: "Participant (Camera)", isMuted: true });
  }

  if (!isStarted) {
    return (
      <Container maxWidth="sm" sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", textAlign: "center" }}>
        <Box sx={{ position: "absolute", top: 24, right: 24 }}><UserButton /></Box>
        <Box>
          {isLoading && <Box sx={{ mb: 3 }}><CircularProgress /><Typography variant="body2" mt={2} color="text.secondary">Connecting...</Typography></Box>}
          {error && <Alert severity="error" sx={{ mb: 3, textAlign: "left" }}>{error}</Alert>}
          {!isLoading && (
            <Zoom in={true}>
              <Paper sx={{ p: 4, borderRadius: 4, maxWidth: 400 }}>
                <VideoCall sx={{ fontSize: 60, color: "primary.main", mb: 2 }} />
                <Typography variant="h4" gutterBottom fontWeight="600">Join Meeting</Typography>
                <Typography variant="body1" color="text.secondary" mb={1}>Room: <strong>{roomId}</strong></Typography>
                <Button onClick={startMeeting} variant="contained" size="large" startIcon={<PlayArrow />} disabled={!socketConnected} fullWidth sx={{ py: 1.5, px: 4 }}>Join Now</Button>
              </Paper>
            </Zoom>
          )}
        </Box>
      </Container>
    );
  }

  return (
    <Box sx={{ display: "flex", height: "100vh", bgcolor: "grey.100" }}>
      <Box sx={{ flex: 1, display: "flex", flexDirection: "column", p: 2, gap: 2 }}>
        {!isMobile && (
          <Paper sx={{ p: 2, display: "flex", justifyContent: "space-between" }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="h6">Meeting Room</Typography>
              <Chip label={roomId} size="small" variant="outlined" />
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography variant="caption">{isConnected ? "Connected" : "Waiting..."}</Typography>
                <UserButton />
            </Box>
          </Paper>
        )}
        <Box sx={{ flex: 1, position: "relative" }}>
          {(isScreenSharing || isRemoteScreenSharing) && mainViewStream ? (
            <>
              <VideoPlayer stream={mainViewStream} label={mainViewLabel} />
              <Box sx={{ position: "absolute", bottom: 16, right: 16, display: "flex", gap: 2, flexDirection: isMobile ? "column" : "row" }}>
                {pipViews.map((view) => (
                  <Box key={view.label} sx={{ width: isMobile ? 120 : 200, height: isMobile ? 90 : 150, borderRadius: 2, overflow: "hidden", boxShadow: 3 }}>
                    <VideoPlayer stream={view.stream} isMuted={view.isMuted} isFlipped={view.isFlipped} label={view.label} />
                  </Box>
                ))}
              </Box>
            </>
          ) : (
            <Box sx={{ display: "flex", gap: 2, height: "100%", flexDirection: isMobile ? "column" : "row" }}>
              <VideoPlayer stream={localStream} isMuted isFlipped label="You" />
              <VideoPlayer stream={remoteStream} label={isConnected ? "Participant" : "Waiting..."} />
            </Box>
          )}
        </Box>
        <Paper sx={{ p: 2, display: "flex", justifyContent: "center", gap: 2 }}>
          <IconButton onClick={toggleAudio} color={isAudioMuted ? "error" : "primary"}><MicOff sx={{ display: isAudioMuted ? 'block' : 'none' }} /><Mic sx={{ display: isAudioMuted ? 'none' : 'block' }} /></IconButton>
          <IconButton onClick={toggleVideo} color={isVideoMuted ? "error" : "primary"}><VideocamOff sx={{ display: isVideoMuted ? 'block' : 'none' }} /><Videocam sx={{ display: isVideoMuted ? 'none' : 'block' }} /></IconButton>
          <IconButton onClick={toggleScreenShare} disabled={isScreenShareLoading} color={isScreenSharing ? "secondary" : "primary"}>
            {isScreenShareLoading ? <CircularProgress size={24} /> : isScreenSharing ? <StopScreenShare /> : <ScreenShare />}
          </IconButton>
          <Button onClick={() => setShowLeaveDialog(true)} variant="contained" color="error" startIcon={<CallEnd />} sx={{ ml: 2 }}>Leave</Button>
        </Paper>
      </Box>
      {!isMobile && (<Box sx={{ width: 350, borderLeft: "1px solid #e0e0e0" }}><ChatComponent {...{ chat, user, message, setMessage, handleSend, socketConnected }} /></Box>)}
      {isMobile && (
        <>
          <Fab color="primary" sx={{ position: "fixed", bottom: 100, right: 16 }} onClick={() => setIsChatOpen(true)}><ChatBubble /></Fab>
          <Dialog open={isChatOpen} onClose={() => setIsChatOpen(false)} fullScreen>
            <ChatComponent isDrawer onClose={() => setIsChatOpen(false)} {...{ chat, user, message, setMessage, handleSend, socketConnected }} />
          </Dialog>
        </>
      )}
      <Dialog open={showLeaveDialog} onClose={() => setShowLeaveDialog(false)}>
        <DialogTitle>Leave Meeting?</DialogTitle>
        <DialogContent><Typography>Are you sure you want to leave?</Typography></DialogContent>
        <DialogActions><Button onClick={() => setShowLeaveDialog(false)}>Cancel</Button><Button onClick={leaveMeeting} color="error">Leave</Button></DialogActions>
      </Dialog>
      {error && (<Alert severity="error" sx={{ position: "fixed", bottom: 16, left: 16, zIndex: 1300 }} onClose={() => setError(null)}>{error}</Alert>)}
    </Box>
  );
};

export default MeetingRoom;
