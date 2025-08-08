"use client";

import { useEffect, useRef, useState } from "react";
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
  AppBar,
  Toolbar,
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
  Chat,
  Circle,
  ExitToApp,
  CallEnd,
  Close,
  ChatBubble,
  ScreenShare,
  StopScreenShare,
  Warning,
} from "@mui/icons-material";

const backendUrl = "";

const MeetingRoom = () => {
  const { roomId } = useParams();
  const { user, isLoaded } = useUser();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const isTablet = useMediaQuery(theme.breakpoints.between("md", "lg"));
  const isSmallMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const userVideoRef = useRef(null);
  const userWebcamRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnection = useRef(null);
  const streamRef = useRef(null);
  const socketRef = useRef(null);
  const chatEndRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const remoteScreenVideoRef = useRef(null);


  // Screen sharing refs
  const originalVideoTrackRef = useRef(null);
  const originalStreamRef = useRef(null);
  const screenStreamRef = useRef(null);

  const [isStarted, setIsStarted] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState("");
  const [chat, setChat] = useState([]);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Screen sharing state
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [remoteScreenSharing, setRemoteScreenSharing] = useState(false);

  // Connection state
  const [socketConnected, setSocketConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const [isReconnecting, setIsReconnecting] = useState(false);

  // Auto scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat]);

  // Initialize socket with retry logic
  const initializeSocket = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    console.log("Attempting to connect to:", backendUrl);

    socketRef.current = io(backendUrl, {
      transports: ["websocket", "polling"],
      timeout: 20000,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      maxReconnectionAttempts: 5,
    });

    // Connection event handlers
    socketRef.current.on("connect", () => {
      console.log("✅ Socket connected:", socketRef.current.id);
      setSocketConnected(true);
      setConnectionError(null);
      setIsReconnecting(false);
      setError(null);
    });

    socketRef.current.on("disconnect", (reason) => {
      console.log("❌ Socket disconnected:", reason);
      setSocketConnected(false);
      setIsConnected(false);
      if (reason === "io server disconnect") {
        // Server disconnected, try to reconnect
        setIsReconnecting(true);
      }
    });

    socketRef.current.on("connect_error", (error) => {
      console.error("❌ Socket connection error:", error);
      setSocketConnected(false);
      setConnectionError(`Connection failed: ${error.message}`);
      setIsReconnecting(true);

      // Retry connection after delay
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      reconnectTimeoutRef.current = setTimeout(() => {
        console.log("🔄 Retrying connection...");
        initializeSocket();
      }, 3000);
    });

    socketRef.current.on("reconnect", (attemptNumber) => {
      console.log("🔄 Socket reconnected after", attemptNumber, "attempts");
      setIsReconnecting(false);
      setConnectionError(null);
    });

    socketRef.current.on("reconnect_error", (error) => {
      console.error("❌ Socket reconnection error:", error);
      setConnectionError(`Reconnection failed: ${error.message}`);
    });

    socketRef.current.on("reconnect_failed", () => {
      console.error("❌ Socket reconnection failed completely");
      setConnectionError(
        "Unable to connect to server. Please check your internet connection."
      );
      setIsReconnecting(false);
    });

    // Chat messages
    socketRef.current.on("chat-message", (data) => {
      setChat((prev) => [
        ...prev,
        {
          username: data.username,
          message: data.message,
          timestamp: new Date(),
        },
      ]);
    });

    // Screen sharing events
 // On screen-share start/stop received
socketRef.current.on("screen-share-started", ({ sharer }) => {
  setRemoteScreenSharing(true);
  // Add: (re)assign the remote video on the client side
  // Remove only the screen share video track, retain webcam
if (peerConnection.current) {
  const senders = peerConnection.current.getSenders();
  senders
    .filter(
      (sender) =>
        sender.track &&
        sender.track.kind === "video" &&
        sender.track.label.toLowerCase().includes("screen")
    )
    .forEach((sender) => peerConnection.current.removeTrack(sender));
}

});


    socketRef.current.on("screen-share-stopped", ({ sharer }) => {
      console.log(`Screen share stopped by ${sharer}`);
      if (sharer !== socketRef.current.id) {
        setRemoteScreenSharing(false);
      }
    });
  };

  // Initialize socket when clerk is loaded
  useEffect(() => {
    if (!isLoaded) return;

    initializeSocket();

    // Cleanup on unmount
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      peerConnection.current?.close();
      streamRef.current?.getTracks?.().forEach((track) => track.stop());
      originalStreamRef.current?.getTracks?.().forEach((track) => track.stop());
      screenStreamRef.current?.getTracks?.().forEach((track) => track.stop());
      socketRef.current?.disconnect()
    };
  }, [isLoaded, roomId]);

  // Setup signaling listeners only when meeting started and socket connected
  useEffect(() => {
    if (!isStarted || !isLoaded || !socketRef.current || !socketConnected)
      return;

    const socket = socketRef.current;
    let remoteSocketId = null;

    // Join signaling rooms
    socket.emit("join-meeting", roomId);
    socket.emit("join", roomId);

    socket.on("user-joined", async ({ socketId }) => {
      remoteSocketId = socketId;
      if (!peerConnection.current && streamRef.current) {
        peerConnection.current = createPeerConnection(socket, remoteSocketId);
        streamRef.current
          .getTracks()
          .forEach((track) =>
            peerConnection.current.addTrack(track, streamRef.current)
          );
        const offer = await peerConnection.current.createOffer();
        await peerConnection.current.setLocalDescription(offer);
        socket.emit("offer", { offer, target: remoteSocketId }, roomId);
      }
    });

    socket.on("offer", async ({ offer, from }) => {
      remoteSocketId = from;
      if (!peerConnection.current && streamRef.current) {
        peerConnection.current = createPeerConnection(socket, remoteSocketId);
        streamRef.current
          .getTracks()
          .forEach((track) =>
            peerConnection.current.addTrack(track, streamRef.current)
          );
        await peerConnection.current.setRemoteDescription(
          new RTCSessionDescription(offer)
        );
        const answer = await peerConnection.current.createAnswer();
        await peerConnection.current.setLocalDescription(answer);
        socket.emit("answer", { answer, target: from }, roomId);
      }
    });

    socket.on("answer", async ({ answer }) => {
      if (peerConnection.current) {
        await peerConnection.current.setRemoteDescription(
          new RTCSessionDescription(answer)
        );
      }
    });

    socket.on("ice-candidate", async ({ candidate }) => {
      if (peerConnection.current && candidate) {
        try {
          await peerConnection.current.addIceCandidate(
            new RTCIceCandidate(candidate)
          );
        } catch {
          // ignore errors on ICE candidate adding
        }
      }
    });

    socket.on("user-left", () => {
      setIsConnected(false);
      setRemoteScreenSharing(false);
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
      peerConnection.current?.close();
      peerConnection.current = null;
    });

    // Cleanup event listeners on unmount or dependency change
    return () => {
      socket.off("user-joined");
      socket.off("offer");
      socket.off("answer");
      socket.off("ice-candidate");
      socket.off("user-left");
      peerConnection.current?.close();
      peerConnection.current = null;
    };
  }, [isStarted, isLoaded, roomId, socketConnected]);

  // PeerConnection creation helper
  const createPeerConnection = (socket, targetSocketId) => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit(
          "ice-candidate",
          { candidate: event.candidate, target: targetSocketId },
          roomId
        );
      }
    };

    pc.ontrack = (event) => {
      if (event.track.kind === "video") {
        // If it's a screen track (label detection works in Chrome/Firefox)
        if (
          event.track.label.toLowerCase().includes("screen") ||
          event.track.label.toLowerCase().includes("display")
        ) {
          // Assign only this track (screen) to separate video
          if (remoteScreenVideoRef.current) {
            remoteScreenVideoRef.current.srcObject = new MediaStream([event.track]);
          }
          setRemoteScreenSharing(true);
        } else {
          // Webcam video
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = event.streams[0];
          }
          setIsConnected(true);
        }
      }
    };
    

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      if (state === "connected" || state === "completed") setIsConnected(true);
      if (state === "disconnected" || state === "failed") setIsConnected(false);
    };

    return pc;
  };

  // Start meeting: get media and show local video
  const startMeeting = async () => {
    if (!socketConnected) {
      setError(
        "Not connected to server. Please wait for connection or refresh the page."
      );
      return;
    }

    setIsLoading(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: true,
      });
      streamRef.current = stream;
      originalStreamRef.current = stream;
      originalVideoTrackRef.current = stream.getVideoTracks()[0];
      setIsStarted(true);
    } catch (error) {
      setError(`Media access failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Screen sharing functions
  const startScreenShare = async () => {
    if (!socketConnected) {
      setError("Not connected to server. Cannot start screen sharing.");
      return;
    }

    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });

      screenStreamRef.current = screenStream;
      const screenVideoTrack = screenStream.getVideoTracks()[0];

      // Replace video track in peer connection
      // ----> ADD the screen video track to peerConnection
      if (peerConnection.current) {
        peerConnection.current.addTrack(screenVideoTrack, screenStreamRef.current);
      }
      

      // Update main video display to screen share
      if (userVideoRef.current) {
        userVideoRef.current.srcObject = screenStream;
      }

      // Show webcam in picture-in-picture
      if (userWebcamRef.current && originalStreamRef.current) {
        userWebcamRef.current.srcObject = originalStreamRef.current;
      }

      setIsScreenSharing(true);

      // Notify backend about screen sharing
      socketRef.current.emit("start-screen-share", { roomId });

      // Listen for screen share end (when user stops sharing via browser)
      screenVideoTrack.onended = () => {
        stopScreenShare();
      };
    } catch (error) {
      console.error("Error starting screen share:", error);
      setError("Failed to start screen sharing");
    }
  };

  const stopScreenShare = async () => {
    try {
      // Stop screen sharing tracks
      // ... other code  
  // Remove only the screen share video track, retain webcam
  if (peerConnection.current) {
    const senders = peerConnection.current.getSenders();
    senders
      .filter(
        (sender) =>
          sender.track &&
          sender.track.kind === "video" &&
          sender.track.label.toLowerCase().includes("screen")
      )
      .forEach((sender) => peerConnection.current.removeTrack(sender));
  }

      // Update main video display back to webcam
      if (userVideoRef.current && originalStreamRef.current) {
        userVideoRef.current.srcObject = originalStreamRef.current;
      }

      // Clear webcam PiP
      if (userWebcamRef.current) {
        userWebcamRef.current.srcObject = null;
      }

      setIsScreenSharing(false);

      // Notify backend about stopping screen share
      if (socketConnected && socketRef.current) {
        socketRef.current.emit("stop-screen-share", { roomId });
      }
    } catch (error) {
      console.error("Error stopping screen share:", error);
      setError("Failed to stop screen sharing");
    }
  };

  const toggleScreenShare = () => {
    if (isScreenSharing) {
      stopScreenShare();
    } else {
      startScreenShare();
    }
  };

  // Leave meeting function
  const leaveMeeting = () => {
    // Notify about leaving room
    if (socketRef.current && socketConnected) {
      socketRef.current.emit("leave-room", roomId);
    }

    // Stop all tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
    if (originalStreamRef.current) {
      originalStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
    }

    // Close peer connection
    if (peerConnection.current) {
      peerConnection.current.close();
    }

    // Disconnect socket
    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    // Navigate back to home or create meeting page
    navigate("/");
  };

  const handleLeaveMeeting = () => {
    setShowLeaveDialog(true);
  };

  const confirmLeaveMeeting = () => {
    setShowLeaveDialog(false);
    leaveMeeting();
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
    if (originalStreamRef.current) {
      const audioTrack = originalStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioMuted(!audioTrack.enabled);
      }
    }
  };

  // Toggle video track enabled state
  const toggleVideo = () => {
    if (originalStreamRef.current) {
      const videoTrack = originalStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoMuted(!videoTrack.enabled);
      }
    }
  };

  // Send chat message
  const handleSend = () => {
    if (message.trim() && socketConnected) {
      socketRef.current.emit("chat-message", {
        roomId,
        message,
        username: user?.username || user?.firstName || "Anonymous",
      });
      setMessage("");
    } else if (!socketConnected) {
      setError("Not connected to server. Cannot send message.");
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Chat Component for reuse
  const ChatComponent = ({ isDrawer = false }) => (
    <Box
      sx={{
        height: isDrawer ? "100%" : "100%",
        display: "flex",
        flexDirection: "column",
        bgcolor: "white",
      }}
    >
      {/* Chat Header */}
      <Box
        sx={{
          p: { xs: 2, sm: 3 },
          borderBottom: "1px solid #e5e7eb",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          bgcolor: "white",
        }}
      >
        <Typography
          variant="h6"
          fontWeight="600"
          color="#1a1a1a"
          sx={{ fontSize: { xs: "1.1rem", sm: "1.25rem" } }}
        >
          Chat
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Chip
            label={chat.length}
            size="small"
            sx={{
              bgcolor: "#f3f4f6",
              color: "#6b7280",
              fontSize: "0.75rem",
              height: 24,
            }}
          />
          {isDrawer && (
            <IconButton onClick={() => setIsChatOpen(false)} size="small">
              <Close />
            </IconButton>
          )}
        </Box>
      </Box>

      {/* Chat Messages */}
      <Box
        sx={{
          flex: 1,
          overflowY: "auto",
          p: { xs: 1.5, sm: 2 },
          "&::-webkit-scrollbar": {
            width: "6px",
          },
          "&::-webkit-scrollbar-track": {
            bgcolor: "transparent",
          },
          "&::-webkit-scrollbar-thumb": {
            bgcolor: "#d1d5db",
            borderRadius: "3px",
          },
        }}
      >
        {chat.length === 0 ? (
          <Box
            sx={{
              textAlign: "center",
              py: { xs: 4, sm: 8 },
              color: "#9ca3af",
            }}
          >
            <Chat sx={{ fontSize: { xs: 36, sm: 48 }, opacity: 0.3, mb: 2 }} />
            <Typography
              variant="body2"
              sx={{ fontSize: { xs: "0.85rem", sm: "0.875rem" } }}
            >
              No messages yet
            </Typography>
            <Typography
              variant="caption"
              sx={{ fontSize: { xs: "0.75rem", sm: "0.75rem" } }}
            >
              Start the conversation!
            </Typography>
          </Box>
        ) : (
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: { xs: 1.5, sm: 2 },
            }}
          >
            {chat.map((msg, idx) => {
              const isOwnMessage =
                msg.username ===
                (user?.username || user?.firstName || "Anonymous");
              return (
                <Box
                  key={idx}
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: isOwnMessage ? "flex-end" : "flex-start",
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      color: "#6b7280",
                      mb: 0.5,
                      px: 1,
                      fontSize: { xs: "0.7rem", sm: "0.75rem" },
                    }}
                  >
                    {msg.username}
                  </Typography>
                  <Box
                    sx={{
                      maxWidth: "85%",
                      p: { xs: 1.5, sm: 2 },
                      borderRadius: 2,
                      bgcolor: isOwnMessage ? "#1976d2" : "#f3f4f6",
                      color: isOwnMessage ? "white" : "#1a1a1a",
                      borderBottomRightRadius: isOwnMessage ? 0.5 : 2,
                      borderBottomLeftRadius: isOwnMessage ? 2 : 0.5,
                    }}
                  >
                    <Typography
                      variant="body2"
                      sx={{
                        lineHeight: 1.4,
                        fontSize: { xs: "0.85rem", sm: "0.875rem" },
                      }}
                    >
                      {msg.message}
                    </Typography>
                  </Box>
                </Box>
              );
            })}
            <div ref={chatEndRef} />
          </Box>
        )}
      </Box>

      {/* Chat Input */}
      <Box
        sx={{
          p: { xs: 1.5, sm: 2 },
          borderTop: "1px solid #e5e7eb",
          display: "flex",
          gap: 1,
          bgcolor: "white",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <TextField
          fullWidth
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          onFocus={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          placeholder={socketConnected ? "Type a message..." : "Connecting..."}
          variant="outlined"
          size="small"
          autoComplete="off"
          disabled={!socketConnected}
          sx={{
            "& .MuiOutlinedInput-root": {
              borderRadius: 2,
              bgcolor: socketConnected ? "#f9fafb" : "#f3f4f6",
              border: "1px solid #e5e7eb",
              fontSize: { xs: "0.9rem", sm: "1rem" },
              "&:hover": {
                border: "1px solid #d1d5db",
              },
              "&.Mui-focused": {
                border: "1px solid #1976d2",
                bgcolor: "white",
              },
              "& fieldset": {
                border: "none",
              },
            },
          }}
        />
        <IconButton
          onClick={(e) => {
            e.stopPropagation();
            handleSend();
          }}
          disabled={!message.trim() || !socketConnected}
          sx={{
            width: { xs: 44, sm: 40 },
            height: { xs: 44, sm: 40 },
            bgcolor: message.trim() && socketConnected ? "#1976d2" : "#f3f4f6",
            color: message.trim() && socketConnected ? "white" : "#9ca3af",
            "&:hover": {
              bgcolor:
                message.trim() && socketConnected ? "#1565c0" : "#e5e7eb",
            },
            "&:disabled": {
              bgcolor: "#f3f4f6",
              color: "#9ca3af",
            },
          }}
        >
          <Send sx={{ fontSize: { xs: 20, sm: 18 } }} />
        </IconButton>
      </Box>
    </Box>
  );

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "#f8f9fa",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Connection Status Alert */}
      {(connectionError || isReconnecting) && (
        <Alert
          severity={isReconnecting ? "warning" : "error"}
          sx={{
            borderRadius: 0,
            "& .MuiAlert-message": {
              display: "flex",
              alignItems: "center",
              gap: 1,
            },
          }}
        >
          {isReconnecting && <CircularProgress size={16} />}
          {isReconnecting ? "Reconnecting to server..." : connectionError}
        </Alert>
      )}

      {!isStarted ? (
        <Container
          maxWidth="sm"
          sx={{ flex: 1, display: "flex", alignItems: "center", py: 4 }}
        >
          {/* User Button for pre-meeting */}
          <Box
            sx={{
              position: "absolute",
              top: { xs: 16, sm: 24 },
              right: { xs: 16, sm: 24 },
              zIndex: 10,
            }}
          >
            <UserButton
              appearance={{
                elements: {
                  avatarBox: {
                    width: isSmallMobile ? "36px" : "44px",
                    height: isSmallMobile ? "36px" : "44px",
                    borderRadius: "12px",
                    border: "2px solid #e5e7eb",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                  },
                  userButtonPopoverCard: {
                    borderRadius: "12px",
                    boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
                    border: "1px solid #e5e7eb",
                  },
                  userButtonPopoverActionButton: {
                    borderRadius: "8px",
                    "&:hover": {
                      backgroundColor: "#f3f4f6",
                    },
                  },
                  userButtonPopoverActionButtonText: {
                    color: "#374151",
                    fontWeight: "500",
                  },
                  userButtonPopoverActionButtonIcon: {
                    color: "#6b7280",
                  },
                },
              }}
            />
          </Box>

          <Zoom in timeout={600}>
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                gap: { xs: 3, sm: 4 },
                width: "100%",
                px: { xs: 2, sm: 0 },
                pt: { xs: 8, sm: 4 },
              }}
            >
              <Box
                sx={{
                  width: { xs: 80, sm: 100, md: 120 },
                  height: { xs: 80, sm: 100, md: 120 },
                  borderRadius: "50%",
                  bgcolor: "white",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
                  mb: 2,
                }}
              >
                <VideoCall
                  sx={{
                    fontSize: { xs: 40, sm: 50, md: 60 },
                    color: "#1976d2",
                  }}
                />
              </Box>

              <Box>
                <Typography
                  variant="h4"
                  fontWeight="600"
                  color="#1a1a1a"
                  sx={{
                    mb: 1,
                    fontSize: { xs: "1.5rem", sm: "1.75rem", md: "2rem" },
                  }}
                >
                  Join Meeting
                </Typography>
                <Typography
                  variant="body1"
                  color="#6b7280"
                  sx={{
                    mb: 4,
                    fontSize: { xs: "0.9rem", sm: "1rem" },
                    wordBreak: "break-all",
                  }}
                >
                  Room: {roomId}
                </Typography>
              </Box>

              {/* Connection Status */}
              <Box
                sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}
              >
                <Circle
                  sx={{
                    fontSize: 8,
                    color: socketConnected ? "#10b981" : "#f59e0b",
                  }}
                />
                <Typography variant="body2" color="#6b7280">
                  {socketConnected
                    ? "Connected to server"
                    : "Connecting to server..."}
                </Typography>
              </Box>

              {error && (
                <Paper
                  sx={{
                    p: { xs: 2.5, sm: 3 },
                    bgcolor: "#fef2f2",
                    border: "1px solid #fecaca",
                    borderRadius: 2,
                    width: "100%",
                    maxWidth: 400,
                  }}
                >
                  <Typography
                    color="#dc2626"
                    sx={{ fontSize: { xs: "0.85rem", sm: "0.875rem" } }}
                  >
                    {error}
                  </Typography>
                </Paper>
              )}

              <Button
                onClick={startMeeting}
                disabled={isLoading || !socketConnected}
                startIcon={
                  isLoading ? <CircularProgress size={20} /> : <PlayArrow />
                }
                sx={{
                  px: { xs: 4, sm: 6 },
                  py: { xs: 2, sm: 2 },
                  borderRadius: 2,
                  fontSize: { xs: "0.95rem", sm: "1rem" },
                  fontWeight: "600",
                  bgcolor: "#1976d2",
                  color: "white",
                  textTransform: "none",
                  boxShadow: "0 2px 8px rgba(25,118,210,0.2)",
                  minHeight: { xs: 48, sm: 56 },
                  width: { xs: "100%", sm: "auto" },
                  maxWidth: { xs: "280px", sm: "none" },
                  "&:hover": {
                    bgcolor: "#1565c0",
                    boxShadow: "0 4px 12px rgba(25,118,210,0.3)",
                  },
                  "&:disabled": {
                    bgcolor: "#e5e7eb",
                    color: "#9ca3af",
                  },
                }}
              >
                {isLoading
                  ? "Starting..."
                  : socketConnected
                    ? "Start Meeting"
                    : "Connecting..."}
              </Button>

              <Paper
                sx={{
                  p: { xs: 2.5, sm: 3 },
                  bgcolor: "white",
                  borderRadius: 2,
                  border: "1px solid #e5e7eb",
                  width: "100%",
                  maxWidth: 500,
                }}
              >
                <Typography
                  variant="body2"
                  color="#6b7280"
                  sx={{
                    mb: 2,
                    fontSize: { xs: "0.85rem", sm: "0.875rem" },
                  }}
                >
                  Share this link to invite others:
                </Typography>
                <Box
                  sx={{
                    p: 2,
                    bgcolor: "#f9fafb",
                    borderRadius: 1,
                    border: "1px solid #e5e7eb",
                    fontFamily: "monospace",
                    fontSize: { xs: "0.75rem", sm: "0.875rem" },
                    color: "#374151",
                    wordBreak: "break-all",
                    lineHeight: 1.4,
                  }}
                >
                  {window.location.href}
                </Box>
              </Paper>
            </Box>
          </Zoom>
        </Container>
      ) : (
        <>
          {/* Mobile/Tablet Header */}
          {isMobile && (
            <AppBar
              position="static"
              elevation={0}
              sx={{
                bgcolor: "white",
                borderBottom: "1px solid #e5e7eb",
                color: "#1a1a1a",
              }}
            >
              <Toolbar
                sx={{
                  justifyContent: "space-between",
                  minHeight: { xs: 56, sm: 64 },
                }}
              >
                <Box>
                  <Typography
                    variant="h6"
                    fontWeight="600"
                    sx={{ fontSize: { xs: "1rem", sm: "1.25rem" } }}
                  >
                    Meeting
                  </Typography>
                  <Typography
                    variant="caption"
                    color="#6b7280"
                    sx={{ fontSize: { xs: "0.7rem", sm: "0.75rem" } }}
                  >
                    {roomId?.slice(0, 8)}...
                  </Typography>
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Circle
                    sx={{
                      fontSize: 8,
                      color: isConnected ? "#10b981" : "#f59e0b",
                    }}
                  />
                  <Button
                    onClick={handleLeaveMeeting}
                    startIcon={<CallEnd />}
                    size="small"
                    sx={{
                      px: 2,
                      py: 0.5,
                      borderRadius: 2,
                      fontSize: "0.8rem",
                      fontWeight: "600",
                      bgcolor: "#dc2626",
                      color: "white",
                      textTransform: "none",
                      "&:hover": {
                        bgcolor: "#b91c1c",
                      },
                    }}
                  >
                    Leave
                  </Button>
                  <UserButton
                    appearance={{
                      elements: {
                        avatarBox: {
                          width: "32px",
                          height: "32px",
                          borderRadius: "8px",
                          border: "2px solid #e5e7eb",
                        },
                      },
                    }}
                  />
                </Box>
              </Toolbar>
            </AppBar>
          )}

          <Box
            sx={{
              flex: 1,
              display: "flex",
              flexDirection: { xs: "column", lg: "row" },
              gap: { xs: 0, lg: 3 },
              p: { xs: 0, lg: 3 },
              height: isMobile ? "calc(100vh - 56px)" : "calc(100vh - 100px)",
            }}
          >
            {/* Main Video Area */}
            <Box
              sx={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                gap: { xs: 0, lg: 2 },
                height: "100%",
              }}
            >
              {/* Desktop Header */}
              {!isMobile && (
                <Paper
                  sx={{
                    p: 3,
                    bgcolor: "white",
                    borderRadius: 2,
                    border: "1px solid #e5e7eb",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <Typography variant="h6" fontWeight="600" color="#1a1a1a">
                      Meeting Room
                    </Typography>
                    <Typography variant="body2" color="#6b7280">
                      {roomId}
                    </Typography>
                  </Box>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Circle
                        sx={{
                          fontSize: 8,
                          color: socketConnected
                            ? isConnected
                              ? "#10b981"
                              : "#f59e0b"
                            : "#dc2626",
                        }}
                      />
                      <Typography variant="body2" color="#6b7280">
                        {!socketConnected
                          ? "Disconnected"
                          : isConnected
                            ? "Connected"
                            : "Waiting for others"}
                      </Typography>
                    </Box>
                    <Button
                      onClick={handleLeaveMeeting}
                      startIcon={<CallEnd />}
                      sx={{
                        px: 3,
                        py: 1,
                        borderRadius: 2,
                        fontSize: "0.875rem",
                        fontWeight: "600",
                        bgcolor: "#dc2626",
                        color: "white",
                        textTransform: "none",
                        "&:hover": {
                          bgcolor: "#b91c1c",
                          transform: "translateY(-1px)",
                        },
                        transition: "all 0.2s ease",
                      }}
                    >
                      Leave
                    </Button>
                    <UserButton
                      appearance={{
                        elements: {
                          avatarBox: {
                            width: "36px",
                            height: "36px",
                            borderRadius: "10px",
                            border: "2px solid #e5e7eb",
                            boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                          },
                        },
                      }}
                    />
                  </Box>
                </Paper>
              )}

              {/* Video Grid */}
              <Box
                sx={{
                  flex: 1,
                  display: "flex",
                  flexDirection: { xs: "column", md: "row" },
                  gap: { xs: 1, md: 2 },
                  p: { xs: 1, lg: 0 },
                }}
              >
                {/* Local Video */}
                <Paper
                  sx={{
                    flex: 1,
                    bgcolor: "white",
                    borderRadius: { xs: 1, md: 2 },
                    border: "1px solid #e5e7eb",
                    overflow: "hidden",
                    position: "relative",
                    minHeight: { xs: "200px", sm: "250px", md: "auto" },
                  }}
                >
                  <Box
                    sx={{
                      position: "absolute",
                      top: { xs: 8, md: 16 },
                      left: { xs: 8, md: 16 },
                      zIndex: 2,
                    }}
                  >
                    <Chip
                      label={isScreenSharing ? "You (Screen)" : "You"}
                      size="small"
                      sx={{
                        bgcolor: "rgba(0,0,0,0.7)",
                        color: "white",
                        fontSize: { xs: "0.7rem", md: "0.75rem" },
                        height: { xs: 20, md: 24 },
                      }}
                    />
                  </Box>

                  {/* Main video (screen share or webcam) */}
                  <video
                    ref={userVideoRef}
                    autoPlay
                    playsInline
                    muted
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      background: "#000",
                      cursor: "pointer",
                      transform: isScreenSharing ? "none" : "scaleX(-1)",
                    }}
                  />

                  {/* Picture-in-Picture webcam when screen sharing */}
                  {isScreenSharing && (
                    <Box
                      sx={{
                        position: "absolute",
                        top: { xs: 8, md: 16 },
                        right: { xs: 8, md: 16 },
                        width: { xs: 120, md: 160 },
                        height: { xs: 90, md: 120 },
                        borderRadius: 2,
                        overflow: "hidden",
                        border: "2px solid white",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                        zIndex: 3,
                      }}
                    >
                      <video
                        ref={userWebcamRef}
                        autoPlay
                        playsInline
                        muted
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          background: "#000",
                          transform: "scaleX(-1)",
                        }}
                      />
                      <Box
                        sx={{
                          position: "absolute",
                          bottom: 2,
                          left: 2,
                          right: 2,
                          textAlign: "center",
                        }}
                      >
                        <Chip
                          label="You"
                          size="small"
                          sx={{
                            bgcolor: "rgba(0,0,0,0.7)",
                            color: "white",
                            fontSize: "0.6rem",
                            height: 16,
                          }}
                        />
                      </Box>
                    </Box>
                  )}

                  <Box
                    sx={{
                      position: "absolute",
                      bottom: { xs: 8, md: 16 },
                      left: "50%",
                      transform: "translateX(-50%)",
                      display: "flex",
                      gap: 1,
                    }}
                  >
                    <IconButton
                      onClick={toggleAudio}
                      sx={{
                        width: { xs: 36, md: 44 },
                        height: { xs: 36, md: 44 },
                        bgcolor: isAudioMuted
                          ? "#dc2626"
                          : "rgba(255,255,255,0.9)",
                        color: isAudioMuted ? "white" : "#374151",
                        "&:hover": {
                          bgcolor: isAudioMuted ? "#b91c1c" : "white",
                        },
                      }}
                    >
                      {isAudioMuted ? (
                        <MicOff sx={{ fontSize: { xs: 16, md: 20 } }} />
                      ) : (
                        <Mic sx={{ fontSize: { xs: 16, md: 20 } }} />
                      )}
                    </IconButton>
                    <IconButton
                      onClick={toggleVideo}
                      sx={{
                        width: { xs: 36, md: 44 },
                        height: { xs: 36, md: 44 },
                        bgcolor: isVideoMuted
                          ? "#dc2626"
                          : "rgba(255,255,255,0.9)",
                        color: isVideoMuted ? "white" : "#374151",
                        "&:hover": {
                          bgcolor: isVideoMuted ? "#b91c1c" : "white",
                        },
                      }}
                    >
                      {isVideoMuted ? (
                        <VideocamOff sx={{ fontSize: { xs: 16, md: 20 } }} />
                      ) : (
                        <Videocam sx={{ fontSize: { xs: 16, md: 20 } }} />
                      )}
                    </IconButton>
                    <IconButton
                      onClick={toggleScreenShare}
                      disabled={!socketConnected}
                      sx={{
                        width: { xs: 36, md: 44 },
                        height: { xs: 36, md: 44 },
                        bgcolor: isScreenSharing
                          ? "#1976d2"
                          : "rgba(255,255,255,0.9)",
                        color: isScreenSharing ? "white" : "#374151",
                        "&:hover": {
                          bgcolor: isScreenSharing ? "#1565c0" : "white",
                        },
                        "&:disabled": {
                          bgcolor: "#f3f4f6",
                          color: "#9ca3af",
                        },
                      }}
                    >
                      {isScreenSharing ? (
                        <StopScreenShare
                          sx={{ fontSize: { xs: 16, md: 20 } }}
                        />
                      ) : (
                        <ScreenShare sx={{ fontSize: { xs: 16, md: 20 } }} />
                      )}
                    </IconButton>
                  </Box>
                </Paper>

                {/* Remote Video */}
                <Paper
                  sx={{
                    flex: 1,
                    bgcolor: "white",
                    borderRadius: { xs: 1, md: 2 },
                    border: "1px solid #e5e7eb",
                    overflow: "hidden",
                    position: "relative",
                    minHeight: { xs: "200px", sm: "250px", md: "auto" },
                  }}
                >
                  <Box
                    sx={{
                      position: "absolute",
                      top: { xs: 8, md: 16 },
                      left: { xs: 8, md: 16 },
                      zIndex: 2,
                    }}
                  >
                    <Chip
                      label={
                        isConnected
                          ? remoteScreenSharing
                            ? "Participant (Screen)"
                            : "Participant"
                          : "Waiting..."
                      }
                      size="small"
                      sx={{
                        bgcolor: "rgba(0,0,0,0.7)",
                        color: "white",
                        fontSize: { xs: "0.7rem", md: "0.75rem" },
                        height: { xs: 20, md: 24 },
                      }}
                    />
                  </Box>
                  {remoteScreenSharing && (
                    <video
                      ref={remoteScreenVideoRef}
                      autoPlay
                      playsInline
                      style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      background: "#000",
                    }}
                  />
                  )}
                  {!isConnected && (
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
                      <CircularProgress
                        sx={{ color: "white", mb: 2 }}
                        size={40}
                      />
                      <Typography
                        variant="body2"
                        sx={{ fontSize: { xs: "0.8rem", md: "0.875rem" } }}
                      >
                        Waiting for participant...
                      </Typography>
                    </Box>
                  )}
                </Paper>
              </Box>

              {/* Share Link - Desktop only */}
              {!isConnected && !isMobile && (
                <Paper
                  sx={{
                    p: 3,
                    bgcolor: "#eff6ff",
                    border: "1px solid #bfdbfe",
                    borderRadius: 2,
                  }}
                >
                  <Typography
                    variant="body2"
                    color="#1e40af"
                    sx={{ mb: 1, fontWeight: 500 }}
                  >
                    Invite others to join
                  </Typography>
                  <Box
                    sx={{
                      p: 2,
                      bgcolor: "white",
                      borderRadius: 1,
                      border: "1px solid #bfdbfe",
                      fontFamily: "monospace",
                      fontSize: "0.875rem",
                      color: "#374151",
                      wordBreak: "break-all",
                    }}
                  >
                    {window.location.href}
                  </Box>
                </Paper>
              )}
            </Box>

            {/* Desktop Chat Section */}
            {!isMobile && (
              <Paper
                sx={{
                  width: 360,
                  bgcolor: "white",
                  borderRadius: 2,
                  border: "1px solid #e5e7eb",
                  display: "flex",
                  flexDirection: "column",
                  height: "100%",
                }}
              >
                <ChatComponent />
              </Paper>
            )}
          </Box>

          {/* Mobile Chat FAB */}
          {isMobile && (
            <Fab
              onClick={() => setIsChatOpen(true)}
              sx={{
                position: "fixed",
                bottom: 20,
                right: 20,
                bgcolor: "#1976d2",
                color: "white",
                "&:hover": {
                  bgcolor: "#1565c0",
                },
              }}
            >
              <ChatBubble />
            </Fab>
          )}

          {/* Mobile Chat Modal */}
          <Dialog
            open={isChatOpen}
            onClose={() => setIsChatOpen(false)}
            fullScreen={isMobile}
            maxWidth="sm"
            fullWidth
            PaperProps={{
              sx: {
                ...(isMobile
                  ? {
                      margin: 0,
                      borderRadius: 0,
                      height: "100vh",
                      maxHeight: "100vh",
                    }
                  : {
                      borderRadius: 3,
                      height: "80vh",
                      maxHeight: "80vh",
                    }),
              },
            }}
            TransitionProps={{
              keepMounted: true,
            }}
            disableScrollLock
            disableRestoreFocus
            disableAutoFocus
            disableEnforceFocus
          >
            <ChatComponent isDrawer={true} />
          </Dialog>
        </>
      )}

      {/* Leave Meeting Confirmation Dialog */}
      <Dialog
        open={showLeaveDialog}
        onClose={() => setShowLeaveDialog(false)}
        PaperProps={{
          sx: {
            borderRadius: 3,
            p: 2,
            minWidth: { xs: 280, sm: 400 },
            mx: { xs: 2, sm: 0 },
          },
        }}
      >
        <DialogTitle sx={{ textAlign: "center", pb: 2 }}>
          <ExitToApp
            sx={{ fontSize: { xs: 40, sm: 48 }, color: "#dc2626", mb: 2 }}
          />
          <Typography
            variant="h6"
            fontWeight="600"
            color="#1a1a1a"
            sx={{ fontSize: { xs: "1.1rem", sm: "1.25rem" } }}
          >
            Leave Meeting?
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ textAlign: "center", pb: 2 }}>
          <Typography
            variant="body1"
            color="#6b7280"
            sx={{ fontSize: { xs: "0.9rem", sm: "1rem" } }}
          >
            Are you sure you want to leave this meeting? This action cannot be
            undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ justifyContent: "center", gap: 2, px: 3, pb: 3 }}>
          <Button
            onClick={() => setShowLeaveDialog(false)}
            sx={{
              px: { xs: 3, sm: 4 },
              py: 1,
              borderRadius: 2,
              color: "#6b7280",
              border: "1px solid #e5e7eb",
              fontSize: { xs: "0.85rem", sm: "0.875rem" },
              "&:hover": {
                bgcolor: "#f9fafb",
              },
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={confirmLeaveMeeting}
            sx={{
              px: { xs: 3, sm: 4 },
              py: 1,
              borderRadius: 2,
              bgcolor: "#dc2626",
              color: "white",
              fontSize: { xs: "0.85rem", sm: "0.875rem" },
              "&:hover": {
                bgcolor: "#b91c1c",
              },
            }}
          >
            Leave Meeting
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MeetingRoom;
