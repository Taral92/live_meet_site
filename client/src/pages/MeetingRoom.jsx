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

const backendUrl = "https://collab-app-backend.onrender.com";

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
  const chatEndRef = useRef(null);
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
      localStreamRef.current.getTracks().forEach((track) => {
        track.stop();
        console.log(`Stopped ${track.kind} track`);
      });
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

    console.log("Initializing socket connection...");
    
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
      console.log("Requesting user media...");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: { ideal: 1280 }, 
          height: { ideal: 720 },
          facingMode: "user" 
        },
        audio: { 
          echoCancellation: true, 
          noiseSuppression: true,
          autoGainControl: true 
        },
      });

      localStreamRef.current = stream;
      originalVideoTrackRef.current = stream.getVideoTracks()[0];
      setLocalStream(stream);
      setIsStarted(true);
      
      console.log("✅ Media devices accessed successfully");
      
      if (socketRef.current?.connected) {
        socketRef.current.emit("join-meeting", roomId);
        console.log("📡 Joined room:", roomId);
      }
      
    } catch (err) {
      console.error("❌ Failed to get media devices:", err);
      let errorMessage = "Could not access camera/microphone. ";
      if (err.name === "NotAllowedError") {
        errorMessage += "Please allow camera and microphone permissions and try again.";
      } else if (err.name === "NotFoundError") {
        errorMessage += "No camera or microphone found.";
      } else {
        errorMessage += err.message;
      }
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
    console.log("🔗 Creating peer connection for:", targetSocketId);
    
    if (peerConnectionRef.current) {
      console.log("Closing existing peer connection");
      peerConnectionRef.current.close();
    }

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
      ],
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log("📡 Sending ICE candidate");
        socketRef.current.emit("ice-candidate", {
          candidate: event.candidate,
          target: targetSocketId,
        }, roomId);
      }
    };

    pc.ontrack = (event) => {
      console.log("📹 Received remote track:", event.track.kind);
      const stream = event.streams[0];
      
      if (event.track.kind === "video" && stream) {
        const track = event.track;
        const settings = track.getSettings();
        
        const isScreenTrack = settings.displaySurface !== undefined || 
                            track.label.includes("screen") || 
                            track.label.includes("window") ||
                            settings.width > 1920;
        
        if (isScreenTrack) {
          console.log("🖥️ Remote screen share detected");
          remoteScreenStreamRef.current = stream;
          setIsRemoteScreenSharing(true);
        } else {
          console.log("📷 Remote camera stream received");
          remoteStreamRef.current = stream;
          setRemoteStream(stream);
        }
      } else if (event.track.kind === "audio" && stream) {
        console.log("🔊 Remote audio track received");
        if (!remoteStreamRef.current) {
          remoteStreamRef.current = new MediaStream();
        }
        
        remoteStreamRef.current.getAudioTracks().forEach(track => {
          remoteStreamRef.current.removeTrack(track);
        });
        
        remoteStreamRef.current.addTrack(event.track);
        setRemoteStream(new MediaStream(remoteStreamRef.current.getTracks()));
      }
    };

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      console.log("🔗 ICE connection state:", state);
      
      if (state === "connected" || state === "completed") {
        setIsConnected(true);
        setError(null);
      } else if (state === "disconnected" || state === "failed") {
        setIsConnected(false);
        if (state === "failed") {
          setError("Connection to participant failed. They may have left.");
        }
      } else if (state === "closed") {
        handleUserLeft();
      }
    };

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        console.log(`➕ Adding ${track.kind} track to peer connection`);
        pc.addTrack(track, localStreamRef.current);
      });
    }

    peerConnectionRef.current = pc;
    return pc;
  }, [handleUserLeft, roomId]);

  useEffect(() => {
    if (!isStarted || !socketConnected || !socketRef.current) return;

    const socket = socketRef.current;
    console.log("🎯 Setting up WebRTC signaling");

    socket.on("user-joined", async ({ socketId }) => {
      console.log("👤 User joined:", socketId, "- Creating offer...");
      try {
        createPeerConnection(socketId);
        const offer = await peerConnectionRef.current.createOffer();
        await peerConnectionRef.current.setLocalDescription(offer);
        socket.emit("offer", { offer, target: socketId }, roomId);
        console.log("📤 Offer sent to:", socketId);
      } catch (error) {
        console.error("❌ Error creating offer:", error);
        setError("Failed to establish connection with participant");
      }
    });

    socket.on("offer", async ({ offer, from }) => {
      console.log("📥 Received offer from:", from);
      try {
        createPeerConnection(from);
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peerConnectionRef.current.createAnswer();
        await peerConnectionRef.current.setLocalDescription(answer);
        socket.emit("answer", { answer, target: from }, roomId);
        console.log("📤 Answer sent to:", from);
      } catch (error) {
        console.error("❌ Error handling offer:", error);
        setError("Failed to establish connection with participant");
      }
    });

    socket.on("answer", async ({ answer, from }) => {
      console.log("📥 Received answer from:", from);
      try {
        if (peerConnectionRef.current) {
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
          console.log("✅ Remote description set successfully");
        }
      } catch (error) {
        console.error("❌ Error handling answer:", error);
        setError("Failed to establish connection with participant");
      }
    });

    socket.on("ice-candidate", async ({ candidate, from }) => {
      console.log("📥 Received ICE candidate from:", from);
      if (peerConnectionRef.current && candidate) {
        try {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (error) {
          console.error("❌ Error adding ICE candidate:", error);
        }
      }
    });

    socket.on("user-left", handleUserLeft);
    
    socket.on("peer-screen-share-start", ({ from }) => {
      console.log("🖥️ Peer started screen sharing:", from);
      setIsRemoteScreenSharing(true);
    });
    
    socket.on("peer-screen-share-stop", ({ from }) => {
      console.log("🖥️ Peer stopped screen sharing:", from);
      setIsRemoteScreenSharing(false);
    });

    socket.on("chat-message", (data) => {
      console.log("💬 Chat message received:", data.message);
      setChat((prev) => [...prev, data]);
    });

    return () => {
      socket.off("user-joined");
      socket.off("offer");
      socket.off("answer");
      socket.off("ice-candidate");
      socket.off("user-left");
      socket.off("peer-screen-share-start");
      socket.off("peer-screen-share-stop");
      socket.off("chat-message");
    };
  }, [isStarted, socketConnected, roomId, createPeerConnection, handleUserLeft]);

  const toggleAudio = () => {
    if (!localStreamRef.current) return;
    
    const audioTracks = localStreamRef.current.getAudioTracks();
    audioTracks.forEach((track) => {
      track.enabled = !track.enabled;
      setIsAudioMuted(!track.enabled);
      console.log("🔊 Audio", track.enabled ? "unmuted" : "muted");
    });
  };

  const toggleVideo = () => {
    if (!localStreamRef.current) return;
    
    const videoTracks = localStreamRef.current.getVideoTracks();
    videoTracks.forEach((track) => {
      track.enabled = !track.enabled;
      setIsVideoMuted(!track.enabled);
      console.log("📹 Video", track.enabled ? "enabled" : "disabled");
    });
  };
  
  // --- MODIFICATION START: Replaced toggleScreenShare with a more robust version ---
  const toggleScreenShare = async () => {
    if (isScreenShareLoading) {
      console.log("⏳ Screen share operation already in progress...");
      return;
    }

    setIsScreenShareLoading(true);
    setError(null);

    const videoSender = peerConnectionRef.current?.getSenders()
      .find((sender) => sender.track?.kind === "video");

    try {
      if (isScreenSharing) {
        // --- STOPPING SCREEN SHARE ---
        console.log("🛑 Stopping screen share...");

        if (localScreenStreamRef.current) {
          localScreenStreamRef.current.getTracks().forEach((track) => track.stop());
          localScreenStreamRef.current = null;
        }

        if (videoSender && originalVideoTrackRef.current) {
          await videoSender.replaceTrack(originalVideoTrackRef.current);
          console.log("✅ Video track reverted to camera in peer connection");
        } else {
           console.warn("Could not revert to camera. Original track or sender not found.");
        }
        
        setLocalStream(localStreamRef.current);
        setIsScreenSharing(false);

        socketRef.current?.emit("screen-share-stop", roomId);
        console.log("✅ Screen sharing stopped successfully.");

      } else {
        // --- STARTING SCREEN SHARE ---
        console.log("🖥️ Starting screen share...");

        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            mediaSource: 'screen',
            width: { ideal: 1920, max: 1920 },
            height: { ideal: 1080, max: 1080 },
            frameRate: { max: 30 }
          },
          audio: false
        });

        const screenTrack = screenStream.getVideoTracks()[0];
        if (!screenTrack) {
          throw new Error("No video track found in screen share stream.");
        }

        if (videoSender) {
          await videoSender.replaceTrack(screenTrack);
          console.log("✅ Video track replaced with screen share in peer connection");
        } else {
          console.warn("No video sender found. Screen share may not be sent.");
        }
        
        screenTrack.onended = () => {
          console.log("🛑 Screen share ended by browser UI.");
          // Use a functional update to get the latest state
          setIsScreenSharing(isSharing => {
            if (isSharing) {
              toggleScreenShare();
            }
            return isSharing;
          });
        };

        localScreenStreamRef.current = screenStream;
        setLocalStream(screenStream);
        setIsScreenSharing(true);

        socketRef.current?.emit("screen-share-start", roomId);
        console.log("✅ Screen sharing started successfully.");
      }
    } catch (err) {
      console.error("❌ Screen share error:", err);
      let errorMessage = "Could not start screen sharing. ";
      if (err.name === "NotAllowedError") {
        errorMessage += "Please grant permission to share your screen.";
      } else {
        errorMessage += err.message;
      }
      setError(errorMessage);

      setLocalStream(localStreamRef.current);
      setIsScreenSharing(false);
      if (localScreenStreamRef.current) {
        localScreenStreamRef.current.getTracks().forEach(track => track.stop());
        localScreenStreamRef.current = null;
      }
    } finally {
      setIsScreenShareLoading(false);
    }
  };
  // --- MODIFICATION END ---

  const handleSend = () => {
    if (!message.trim() || !socketConnected || !socketRef.current) return;

    const msgData = {
      roomId,
      message: message.trim(),
      username: user?.username || user?.firstName || "Anonymous",
      timestamp: new Date().toISOString(),
    };

    socketRef.current.emit("chat-message", msgData);
    setMessage("");
    console.log("💬 Chat message sent:", msgData.message);
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat]);

  const leaveMeeting = () => {
    console.log("👋 Leaving meeting...");
    if (socketRef.current?.connected) {
      socketRef.current.emit("leave-room", roomId);
    }
    cleanup();
    navigate("/");
  };

  // Determine which streams to display based on screen sharing state
  const mainViewStream = isScreenSharing
    ? localStream
    : isRemoteScreenSharing
    ? (remoteScreenStreamRef.current || remoteStream)
    : remoteStream;

  const mainViewLabel = isScreenSharing
    ? "Your Screen"
    : isRemoteScreenSharing
    ? "Participant's Screen"
    : "Participant";

  // --- MODIFICATION START: Conditionally mute PiP views ---
  const pipViews = [];
  if (isScreenSharing) {
    pipViews.push({ 
      stream: localStreamRef.current, 
      label: "You (Camera)", 
      isFlipped: true,
      isMuted: true // Mute your own camera to prevent echo
    });
    if (remoteStream) {
      pipViews.push({ 
        stream: remoteStream, 
        label: "Participant",
        isMuted: false // IMPORTANT: Participant's PiP is not muted
      });
    }
  } else if (isRemoteScreenSharing) {
    pipViews.push({ 
      stream: localStream, 
      label: "You", 
      isFlipped: true,
      isMuted: true
    });
    if (remoteStream) {
      // Muted because their audio is coming from the main screen share view
      pipViews.push({ 
        stream: remoteStream, 
        label: "Participant (Camera)",
        isMuted: true
      });
    }
  }
  // --- MODIFICATION END ---

  if (!isStarted) {
    return (
      <Container maxWidth="sm" sx={{ 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "center", 
        height: "100vh", 
        textAlign: "center" 
      }}>
        <Box sx={{ position: "absolute", top: 24, right: 24 }}>
          <UserButton />
        </Box>
        <Box>
          {isLoading && (
            <Box sx={{ mb: 3 }}>
              <CircularProgress size={40} />
              <Typography variant="body2" mt={2} color="text.secondary">
                Connecting to server...
              </Typography>
            </Box>
          )}
          {error && (
            <Alert severity="error" sx={{ mb: 3, textAlign: "left" }}>
              {error}
            </Alert>
          )}
          {!isLoading && (
            <Zoom in={true}>
              <Paper sx={{ p: 4, borderRadius: 4, maxWidth: 400 }}>
                <VideoCall sx={{ fontSize: 60, color: "primary.main", mb: 2 }} />
                <Typography variant="h4" gutterBottom fontWeight="600">
                  Join Meeting
                </Typography>
                <Typography variant="body1" color="text.secondary" mb={1}>
                  Room: <strong>{roomId}</strong>
                </Typography>
                <Typography variant="body2" color="text.secondary" mb={4}>
                  {socketConnected ? "Connected to server" : "Connecting..."}
                </Typography>
                <Button 
                  onClick={startMeeting} 
                  variant="contained" 
                  size="large" 
                  startIcon={<PlayArrow />} 
                  disabled={!socketConnected}
                  sx={{ mb: 2, py: 1.5, px: 4 }}
                  fullWidth
                >
                  Join Meeting
                </Button>
                <Typography variant="caption" color="text.secondary" display="block">
                  Make sure to allow camera and microphone access
                </Typography>
              </Paper>
            </Zoom>
          )}
        </Box>
      </Container>
    );
  }

  const ChatComponent = ({ isDrawer = false }) => (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column", bgcolor: "white" }}>
      <Box sx={{ p: 2, borderBottom: "1px solid #e0e0e0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Typography variant="h6">Chat</Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {chat.length > 0 && (<Chip label={chat.length} size="small" color="primary" sx={{ fontSize: "0.75rem" }}/>)}
          {isDrawer && (<IconButton onClick={() => setIsChatOpen(false)} size="small"><Close /></IconButton>)}
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
                    {msg.username} • {new Date(msg.timestamp).toLocaleTimeString()}
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
        <TextField fullWidth value={message} onChange={(e) => setMessage(e.target.value)} onKeyPress={handleKeyPress} placeholder="Type a message..." size="small" disabled={!socketConnected} />
        <IconButton onClick={handleSend} disabled={!message.trim() || !socketConnected} color="primary" sx={{ bgcolor: message.trim() && socketConnected ? "primary.main" : "grey.300", color: message.trim() && socketConnected ? "white" : "grey.500", "&:hover": { bgcolor: message.trim() && socketConnected ? "primary.dark" : "grey.400" } }}>
          <Send />
        </IconButton>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: "flex", height: "100vh", bgcolor: "grey.100" }}>
      <Box sx={{ flex: 1, display: "flex", flexDirection: "column", p: 2, gap: 2 }}>
        {!isMobile && (
          <Paper sx={{ p: 2, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
              <Typography variant="h6" fontWeight="600">Meeting Room</Typography>
              <Chip label={roomId} size="small" variant="outlined" sx={{ fontFamily: "monospace" }} />
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: isConnected ? "success.main" : (socketConnected ? "warning.main" : "error.main") }} />
                <Typography variant="caption" color="text.secondary">
                  {isConnected ? "Connected" : (socketConnected ? "Waiting for participant" : "Disconnected")}
                </Typography>
              </Box>
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
                  <Box key={view.label} sx={{ width: isMobile ? 120 : 200, height: isMobile ? 90 : 150, borderRadius: 2, overflow: "hidden", boxShadow: 3, border: "2px solid white" }}>
                    {/* --- MODIFICATION START: Use the isMuted property from the view object --- */}
                    <VideoPlayer stream={view.stream} isMuted={view.isMuted} isFlipped={view.isFlipped} label={view.label} />
                    {/* --- MODIFICATION END --- */}
                  </Box>
                ))}
              </Box>
            </>
          ) : (
            <Box sx={{ display: "flex", gap: 2, height: "100%", flexDirection: isMobile ? "column" : "row" }}>
              <VideoPlayer stream={localStream} isMuted isFlipped label="You" />
              <VideoPlayer stream={remoteStream} label={isConnected ? "Participant" : "Waiting for participant..."} />
            </Box>
          )}
        </Box>
        <Paper sx={{ p: 2, borderRadius: 2, display: "flex", justifyContent: "center", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
          <IconButton onClick={toggleAudio} color={isAudioMuted ? "error" : "primary"} sx={{ bgcolor: "background.paper" }}>
            {isAudioMuted ? <MicOff /> : <Mic />}
          </IconButton>
          <IconButton onClick={toggleVideo} color={isVideoMuted ? "error" : "primary"} sx={{ bgcolor: "background.paper" }}>
            {isVideoMuted ? <VideocamOff /> : <Videocam />}
          </IconButton>
          <IconButton onClick={toggleScreenShare} disabled={isScreenShareLoading} color={isScreenSharing ? "secondary" : "primary"} sx={{ bgcolor: "background.paper" }} title={isScreenShareLoading ? "Loading..." : (isScreenSharing ? "Stop sharing screen" : "Share screen")}>
            {isScreenShareLoading ? (<CircularProgress size={24} />) : isScreenSharing ? (<StopScreenShare />) : (<ScreenShare />)}
          </IconButton>
          <Button onClick={() => setShowLeaveDialog(true)} variant="contained" color="error" startIcon={<CallEnd />} sx={{ ml: 2 }}>
            Leave
          </Button>
        </Paper>
      </Box>
      {!isMobile && (<Box sx={{ width: 350, borderLeft: "1px solid #e0e0e0" }}><ChatComponent /></Box>)}
      {isMobile && (
        <>
          <Fab color="primary" sx={{ position: "fixed", bottom: 100, right: 16 }} onClick={() => setIsChatOpen(true)}><ChatBubble /></Fab>
          <Dialog open={isChatOpen} onClose={() => setIsChatOpen(false)} fullScreen><ChatComponent isDrawer /></Dialog>
        </>
      )}
      <Dialog open={showLeaveDialog} onClose={() => setShowLeaveDialog(false)} PaperProps={{ sx: { borderRadius: 3, minWidth: 300 } }}>
        <DialogTitle><Box sx={{ display: "flex", alignItems: "center", gap: 2 }}><CallEnd color="error" /><Typography variant="h6">Leave Meeting?</Typography></Box></DialogTitle>
        <DialogContent><Typography>Are you sure you want to leave this meeting? This action cannot be undone.</Typography></DialogContent>
        <DialogActions sx={{ gap: 1, p: 3 }}>
          <Button onClick={() => setShowLeaveDialog(false)} variant="outlined">Cancel</Button>
          <Button onClick={leaveMeeting} color="error" variant="contained" startIcon={<CallEnd />}>Leave Meeting</Button>
        </DialogActions>
      </Dialog>
      {error && (<Alert severity="error" sx={{ position: "fixed", bottom: 16, left: 16, right: isMobile ? 16 : 366, zIndex: 1300 }} onClose={() => setError(null)}>{error}</Alert>)}
    </Box>
  );
};

export default MeetingRoom;
