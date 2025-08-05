"use client"
import { useEffect, useRef, useState, useCallback } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { io } from "socket.io-client"
import { useUser } from "@clerk/clerk-react"
import { UserButton } from "@clerk/clerk-react"
import {
  Box,
  TextField,
  Button,
  IconButton,
  Typography,
  Paper,
  Chip,
  Container,
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
  Tooltip,
  Slide,
  Fade,
  Avatar,
  Stack,
} from "@mui/material"
import {
  Mic,
  MicOff,
  Videocam,
  VideocamOff,
  Send,
  PlayArrow,
  VideoCall,
  Chat,
  ExitToApp,
  CallEnd,
  Close,
  ChatBubble,
  ScreenShare,
  StopScreenShare,
  Person,
  PresentToAll,
} from "@mui/icons-material"

const backendUrl = "https://live-meet-site.onrender.com"

const MeetingRoom = () => {
  const { roomId } = useParams()
  const { user, isLoaded } = useUser()
  const navigate = useNavigate()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down("md"))
  const isSmallScreen = useMediaQuery(theme.breakpoints.down("sm"))

  // Video refs
  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)
  const localScreenRef = useRef(null)
  const remoteScreenRef = useRef(null)

  // WebRTC refs
  const peerConnectionRef = useRef(null)
  const localStreamRef = useRef(null)
  const localScreenStreamRef = useRef(null)
  const socketRef = useRef(null)
  const chatEndRef = useRef(null)

  // Meeting states
  const [meetingState, setMeetingState] = useState("waiting") // waiting, starting, active
  const [connectionState, setConnectionState] = useState("disconnected") // disconnected, connecting, connected
  const [error, setError] = useState(null)

  // Media states
  const [isAudioMuted, setIsAudioMuted] = useState(false)
  const [isVideoMuted, setIsVideoMuted] = useState(false)
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [remoteScreenSharing, setRemoteScreenSharing] = useState(false)

  // UI states
  const [showLeaveDialog, setShowLeaveDialog] = useState(false)
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showControls, setShowControls] = useState(true)

  // Chat states
  const [message, setMessage] = useState("")
  const [messages, setMessages] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)

  // Auto-hide controls
  useEffect(() => {
    let timeout
    const resetTimeout = () => {
      clearTimeout(timeout)
      setShowControls(true)
      timeout = setTimeout(() => setShowControls(false), 3000)
    }

    if (meetingState === "active") {
      resetTimeout()
      const handleMouseMove = () => resetTimeout()
      document.addEventListener("mousemove", handleMouseMove)
      return () => {
        clearTimeout(timeout)
        document.removeEventListener("mousemove", handleMouseMove)
      }
    }
  }, [meetingState])

  // Initialize socket connection
  useEffect(() => {
    if (!isLoaded) return

    socketRef.current = io(backendUrl, {
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    })

    const socket = socketRef.current

    // Socket event listeners
    socket.on("connect", () => {
      console.log("Socket connected")
    })

    socket.on("disconnect", () => {
      setConnectionState("disconnected")
    })

    socket.on("chat-message", (data) => {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          username: data.username,
          message: data.message,
          timestamp: new Date(),
          isOwn: data.username === (user?.username || user?.firstName || "Anonymous"),
        },
      ])

      if (!isChatOpen) {
        setUnreadCount((prev) => prev + 1)
      }
    })

    return () => {
      socket?.disconnect()
      cleanupStreams()
    }
  }, [isLoaded, user, isChatOpen])

  // WebRTC signaling
  useEffect(() => {
    if (meetingState !== "active" || !socketRef.current) return

    const socket = socketRef.current
    socket.emit("join-meeting", roomId)

    // Signaling handlers
    socket.on("user-joined", handleUserJoined)
    socket.on("offer", handleOffer)
    socket.on("answer", handleAnswer)
    socket.on("ice-candidate", handleIceCandidate)
    socket.on("user-left", handleUserLeft)
    socket.on("screen-share-started", () => setRemoteScreenSharing(true))
    socket.on("screen-share-stopped", () => {
      setRemoteScreenSharing(false)
      if (remoteScreenRef.current) {
        remoteScreenRef.current.srcObject = null
      }
    })

    return () => {
      socket.off("user-joined")
      socket.off("offer")
      socket.off("answer")
      socket.off("ice-candidate")
      socket.off("user-left")
      socket.off("screen-share-started")
      socket.off("screen-share-stopped")
    }
  }, [meetingState, roomId])

  // WebRTC handlers
  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }],
    })

    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit("ice-candidate", {
          candidate: event.candidate,
          roomId,
        })
      }
    }

    pc.ontrack = (event) => {
      const [stream] = event.streams
      if (stream) {
        const videoTrack = stream.getVideoTracks()[0]
        if (videoTrack) {
          // Check if it's screen share by track constraints
          const settings = videoTrack.getSettings()
          if (settings.displaySurface || settings.logicalSurface) {
            // Screen share stream
            if (remoteScreenRef.current) {
              remoteScreenRef.current.srcObject = stream
            }
          } else {
            // Regular video stream
            if (remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = stream
            }
          }
        }
        setConnectionState("connected")
      }
    }

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState
      if (state === "connected" || state === "completed") {
        setConnectionState("connected")
      } else if (state === "disconnected" || state === "failed") {
        setConnectionState("disconnected")
      } else if (state === "connecting") {
        setConnectionState("connecting")
      }
    }

    return pc
  }, [roomId])

  const handleUserJoined = useCallback(
    async ({ socketId }) => {
      if (!localStreamRef.current) return

      peerConnectionRef.current = createPeerConnection()
      const pc = peerConnectionRef.current

      // Add local stream tracks
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current)
      })

      // Add screen share tracks if sharing
      if (localScreenStreamRef.current) {
        localScreenStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localScreenStreamRef.current)
        })
      }

      try {
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        socketRef.current.emit("offer", { offer, target: socketId, roomId })
      } catch (error) {
        console.error("Error creating offer:", error)
      }
    },
    [createPeerConnection],
  )

  const handleOffer = useCallback(
    async ({ offer, from }) => {
      if (!localStreamRef.current) return

      peerConnectionRef.current = createPeerConnection()
      const pc = peerConnectionRef.current

      // Add local stream tracks
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current)
      })

      // Add screen share tracks if sharing
      if (localScreenStreamRef.current) {
        localScreenStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localScreenStreamRef.current)
        })
      }

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer))
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        socketRef.current.emit("answer", { answer, target: from, roomId })
      } catch (error) {
        console.error("Error handling offer:", error)
      }
    },
    [createPeerConnection],
  )

  const handleAnswer = useCallback(async ({ answer }) => {
    if (peerConnectionRef.current) {
      try {
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer))
      } catch (error) {
        console.error("Error handling answer:", error)
      }
    }
  }, [])

  const handleIceCandidate = useCallback(async ({ candidate }) => {
    if (peerConnectionRef.current && candidate) {
      try {
        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate))
      } catch (error) {
        console.error("Error adding ICE candidate:", error)
      }
    }
  }, [])

  const handleUserLeft = useCallback(() => {
    setConnectionState("disconnected")
    setRemoteScreenSharing(false)
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null
    if (remoteScreenRef.current) remoteScreenRef.current.srcObject = null
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close()
      peerConnectionRef.current = null
    }
  }, [])

  // Media controls
  const startMeeting = useCallback(async () => {
    setMeetingState("starting")
    setError(null)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user",
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })

      localStreamRef.current = stream
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream
      }

      setMeetingState("active")
    } catch (error) {
      setError(`Failed to access camera/microphone: ${error.message}`)
      setMeetingState("waiting")
    }
  }, [])

  const toggleAudio = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled
        setIsAudioMuted(!audioTrack.enabled)
      }
    }
  }, [])

  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled
        setIsVideoMuted(!videoTrack.enabled)
      }
    }
  }, [])

  const startScreenShare = useCallback(async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: true,
      })

      localScreenStreamRef.current = screenStream
      setIsScreenSharing(true)

      if (localScreenRef.current) {
        localScreenRef.current.srcObject = screenStream
      }

      // Replace video track in peer connection
      if (peerConnectionRef.current) {
        const videoTrack = screenStream.getVideoTracks()[0]
        const sender = peerConnectionRef.current.getSenders().find((s) => s.track && s.track.kind === "video")

        if (sender && videoTrack) {
          await sender.replaceTrack(videoTrack)
        } else if (videoTrack) {
          peerConnectionRef.current.addTrack(videoTrack, screenStream)
        }
      }

      socketRef.current?.emit("screen-share-started", roomId)

      // Handle screen share end
      screenStream.getVideoTracks()[0].onended = () => {
        stopScreenShare()
      }
    } catch (error) {
      console.error("Screen share failed:", error)
      setError("Failed to start screen sharing")
    }
  }, [roomId])

  const stopScreenShare = useCallback(async () => {
    if (localScreenStreamRef.current) {
      localScreenStreamRef.current.getTracks().forEach((track) => track.stop())
      localScreenStreamRef.current = null
    }

    setIsScreenSharing(false)

    if (localScreenRef.current) {
      localScreenRef.current.srcObject = null
    }

    // Replace back to camera
    if (peerConnectionRef.current && localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0]
      const sender = peerConnectionRef.current.getSenders().find((s) => s.track && s.track.kind === "video")

      if (sender && videoTrack) {
        await sender.replaceTrack(videoTrack)
      }
    }

    socketRef.current?.emit("screen-share-stopped", roomId)
  }, [roomId])

  // Chat functions
  const sendMessage = useCallback(() => {
    if (message.trim() && socketRef.current) {
      socketRef.current.emit("chat-message", {
        roomId,
        message: message.trim(),
        username: user?.username || user?.firstName || "Anonymous",
      })
      setMessage("")
    }
  }, [message, roomId, user])

  const openChat = useCallback(() => {
    setIsChatOpen(true)
    setUnreadCount(0)
  }, [])

  // Cleanup function
  const cleanupStreams = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((track) => track.stop())
    localScreenStreamRef.current?.getTracks().forEach((track) => track.stop())
    peerConnectionRef.current?.close()
  }, [])

  const leaveMeeting = useCallback(() => {
    cleanupStreams()
    navigate("/")
  }, [navigate, cleanupStreams])

  // Auto scroll chat
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages])

  // Render waiting screen
  if (meetingState === "waiting") {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        {/* User Button */}
        <Box sx={{ position: "absolute", top: 24, right: 24, zIndex: 10 }}>
          <UserButton
            appearance={{
              elements: {
                avatarBox: {
                  width: "48px",
                  height: "48px",
                  borderRadius: "12px",
                  border: "3px solid rgba(255,255,255,0.2)",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.1)",
                },
              },
            }}
          />
        </Box>

        <Container maxWidth="sm">
          <Fade in timeout={800}>
            <Paper
              sx={{
                p: { xs: 4, sm: 6 },
                borderRadius: 4,
                textAlign: "center",
                background: "rgba(255,255,255,0.95)",
                backdropFilter: "blur(20px)",
                boxShadow: "0 20px 60px rgba(0,0,0,0.1)",
              }}
            >
              <Box sx={{ mb: 4 }}>
                <Avatar
                  sx={{
                    width: 80,
                    height: 80,
                    mx: "auto",
                    mb: 3,
                    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  }}
                >
                  <VideoCall sx={{ fontSize: 40 }} />
                </Avatar>

                <Typography variant="h4" fontWeight="700" color="#1a1a1a" sx={{ mb: 2 }}>
                  Ready to Join?
                </Typography>

                <Typography variant="body1" color="#6b7280" sx={{ mb: 1 }}>
                  Meeting Room
                </Typography>

                <Chip
                  label={roomId}
                  sx={{
                    fontFamily: "monospace",
                    bgcolor: "#f3f4f6",
                    color: "#374151",
                    fontWeight: 600,
                  }}
                />
              </Box>

              {error && (
                <Paper
                  sx={{
                    p: 3,
                    mb: 4,
                    bgcolor: "#fef2f2",
                    border: "1px solid #fecaca",
                    borderRadius: 2,
                  }}
                >
                  <Typography color="#dc2626" variant="body2">
                    {error}
                  </Typography>
                </Paper>
              )}

              <Button
                onClick={startMeeting}
                disabled={meetingState === "starting"}
                size="large"
                startIcon={meetingState === "starting" ? <CircularProgress size={20} /> : <PlayArrow />}
                sx={{
                  px: 6,
                  py: 2,
                  borderRadius: 3,
                  fontSize: "1.1rem",
                  fontWeight: 600,
                  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  color: "white",
                  textTransform: "none",
                  boxShadow: "0 8px 32px rgba(102,126,234,0.3)",
                  "&:hover": {
                    transform: "translateY(-2px)",
                    boxShadow: "0 12px 40px rgba(102,126,234,0.4)",
                  },
                  "&:disabled": {
                    background: "#e5e7eb",
                    color: "#9ca3af",
                  },
                  transition: "all 0.3s ease",
                }}
              >
                {meetingState === "starting" ? "Starting..." : "Join Meeting"}
              </Button>

              <Box sx={{ mt: 4, p: 3, bgcolor: "#f8fafc", borderRadius: 2 }}>
                <Typography variant="body2" color="#64748b" sx={{ mb: 2 }}>
                  Share this link to invite others:
                </Typography>
                <Box
                  sx={{
                    p: 2,
                    bgcolor: "white",
                    borderRadius: 1,
                    border: "1px solid #e2e8f0",
                    fontFamily: "monospace",
                    fontSize: "0.875rem",
                    color: "#475569",
                    wordBreak: "break-all",
                  }}
                >
                  {window.location.href}
                </Box>
              </Box>
            </Paper>
          </Fade>
        </Container>
      </Box>
    )
  }

  // Main meeting interface
  return (
    <Box
      sx={{
        height: "100vh",
        bgcolor: "#0f172a",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Mobile Header */}
      {isMobile && (
        <AppBar
          position="static"
          elevation={0}
          sx={{
            bgcolor: "rgba(15,23,42,0.95)",
            backdropFilter: "blur(20px)",
          }}
        >
          <Toolbar sx={{ justifyContent: "space-between" }}>
            <Box>
              <Typography variant="h6" fontWeight="600" color="white">
                Meeting
              </Typography>
              <Typography variant="caption" color="#94a3b8">
                {connectionState === "connected" ? "Connected" : "Connecting..."}
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <IconButton
                onClick={() => setShowLeaveDialog(true)}
                sx={{
                  bgcolor: "#dc2626",
                  color: "white",
                  "&:hover": { bgcolor: "#b91c1c" },
                }}
              >
                <CallEnd />
              </IconButton>
              <UserButton
                appearance={{
                  elements: {
                    avatarBox: {
                      width: "36px",
                      height: "36px",
                      borderRadius: "8px",
                    },
                  },
                }}
              />
            </Stack>
          </Toolbar>
        </AppBar>
      )}

      {/* Main Content */}
      <Box
        sx={{
          flex: 1,
          display: "flex",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Video Area */}
        <Box
          sx={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            position: "relative",
          }}
        >
          {/* Desktop Header */}
          {!isMobile && (
            <Slide direction="down" in={showControls} timeout={300}>
              <Paper
                sx={{
                  position: "absolute",
                  top: 20,
                  left: 20,
                  right: isMobile ? 20 : 380,
                  zIndex: 10,
                  p: 2,
                  bgcolor: "rgba(15,23,42,0.95)",
                  backdropFilter: "blur(20px)",
                  borderRadius: 3,
                  border: "1px solid rgba(148,163,184,0.1)",
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <Typography variant="h6" fontWeight="600" color="white">
                      Meeting Room
                    </Typography>
                    <Chip
                      label={roomId}
                      size="small"
                      sx={{
                        bgcolor: "rgba(148,163,184,0.1)",
                        color: "#94a3b8",
                        fontFamily: "monospace",
                      }}
                    />
                    <Chip
                      icon={<Person sx={{ fontSize: 16 }} />}
                      label={connectionState === "connected" ? "Connected" : "Waiting..."}
                      size="small"
                      sx={{
                        bgcolor: connectionState === "connected" ? "rgba(34,197,94,0.1)" : "rgba(251,191,36,0.1)",
                        color: connectionState === "connected" ? "#22c55e" : "#fbbf24",
                      }}
                    />
                  </Box>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Button
                      onClick={() => setShowLeaveDialog(true)}
                      startIcon={<CallEnd />}
                      sx={{
                        bgcolor: "#dc2626",
                        color: "white",
                        "&:hover": { bgcolor: "#b91c1c" },
                      }}
                    >
                      Leave
                    </Button>
                    <UserButton
                      appearance={{
                        elements: {
                          avatarBox: {
                            width: "40px",
                            height: "40px",
                            borderRadius: "10px",
                          },
                        },
                      }}
                    />
                  </Stack>
                </Box>
              </Paper>
            </Slide>
          )}

          {/* Video Grid */}
          <Box
            sx={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              p: { xs: 1, md: 2 },
              gap: 2,
              pt: { xs: 1, md: 10 },
            }}
          >
            {/* Screen Share Area */}
            {(isScreenSharing || remoteScreenSharing) && (
              <Paper
                sx={{
                  flex: 2,
                  borderRadius: 3,
                  overflow: "hidden",
                  position: "relative",
                  bgcolor: "#000",
                  border: "2px solid #334155",
                }}
              >
                <Box
                  sx={{
                    position: "absolute",
                    top: 16,
                    left: 16,
                    zIndex: 2,
                  }}
                >
                  <Chip
                    icon={<PresentToAll sx={{ fontSize: 16 }} />}
                    label={isScreenSharing ? "Your Screen" : "Screen Share"}
                    sx={{
                      bgcolor: "rgba(0,0,0,0.8)",
                      color: "white",
                      backdropFilter: "blur(10px)",
                    }}
                  />
                </Box>

                <video
                  ref={isScreenSharing ? localScreenRef : remoteScreenRef}
                  autoPlay
                  playsInline
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                  }}
                />
              </Paper>
            )}

            {/* Participant Videos */}
            <Box
              sx={{
                display: "flex",
                gap: 2,
                flex: isScreenSharing || remoteScreenSharing ? 1 : 2,
                flexDirection: { xs: "column", md: "row" },
              }}
            >
              {/* Local Video */}
              <Paper
                sx={{
                  flex: 1,
                  borderRadius: 3,
                  overflow: "hidden",
                  position: "relative",
                  bgcolor: "#000",
                  border: "2px solid #1e293b",
                  minHeight: { xs: 200, md: 300 },
                }}
              >
                <Box
                  sx={{
                    position: "absolute",
                    top: 16,
                    left: 16,
                    zIndex: 2,
                  }}
                >
                  <Chip
                    label="You"
                    sx={{
                      bgcolor: "rgba(0,0,0,0.8)",
                      color: "white",
                      backdropFilter: "blur(10px)",
                    }}
                  />
                </Box>

                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    transform: "scaleX(-1)",
                  }}
                />

                {isVideoMuted && (
                  <Box
                    sx={{
                      position: "absolute",
                      inset: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      bgcolor: "#1e293b",
                    }}
                  >
                    <Avatar sx={{ width: 80, height: 80, bgcolor: "#475569" }}>
                      <Person sx={{ fontSize: 40 }} />
                    </Avatar>
                  </Box>
                )}
              </Paper>

              {/* Remote Video */}
              <Paper
                sx={{
                  flex: 1,
                  borderRadius: 3,
                  overflow: "hidden",
                  position: "relative",
                  bgcolor: "#000",
                  border: "2px solid #1e293b",
                  minHeight: { xs: 200, md: 300 },
                }}
              >
                <Box
                  sx={{
                    position: "absolute",
                    top: 16,
                    left: 16,
                    zIndex: 2,
                  }}
                >
                  <Chip
                    label={connectionState === "connected" ? "Participant" : "Waiting..."}
                    sx={{
                      bgcolor: "rgba(0,0,0,0.8)",
                      color: "white",
                      backdropFilter: "blur(10px)",
                    }}
                  />
                </Box>

                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />

                {connectionState !== "connected" && (
                  <Box
                    sx={{
                      position: "absolute",
                      inset: 0,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      bgcolor: "#1e293b",
                      color: "#94a3b8",
                    }}
                  >
                    <CircularProgress sx={{ color: "#64748b", mb: 2 }} />
                    <Typography variant="body2">Waiting for participant...</Typography>
                  </Box>
                )}
              </Paper>
            </Box>
          </Box>

          {/* Controls */}
          <Slide direction="up" in={showControls} timeout={300}>
            <Paper
              sx={{
                position: "absolute",
                bottom: 20,
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 10,
                p: 2,
                bgcolor: "rgba(15,23,42,0.95)",
                backdropFilter: "blur(20px)",
                borderRadius: 4,
                border: "1px solid rgba(148,163,184,0.1)",
              }}
            >
              <Stack direction="row" spacing={2} alignItems="center">
                <Tooltip title={isAudioMuted ? "Unmute" : "Mute"}>
                  <IconButton
                    onClick={toggleAudio}
                    sx={{
                      width: 56,
                      height: 56,
                      bgcolor: isAudioMuted ? "#dc2626" : "rgba(148,163,184,0.1)",
                      color: isAudioMuted ? "white" : "#94a3b8",
                      "&:hover": {
                        bgcolor: isAudioMuted ? "#b91c1c" : "rgba(148,163,184,0.2)",
                      },
                    }}
                  >
                    {isAudioMuted ? <MicOff /> : <Mic />}
                  </IconButton>
                </Tooltip>

                <Tooltip title={isVideoMuted ? "Turn on camera" : "Turn off camera"}>
                  <IconButton
                    onClick={toggleVideo}
                    sx={{
                      width: 56,
                      height: 56,
                      bgcolor: isVideoMuted ? "#dc2626" : "rgba(148,163,184,0.1)",
                      color: isVideoMuted ? "white" : "#94a3b8",
                      "&:hover": {
                        bgcolor: isVideoMuted ? "#b91c1c" : "rgba(148,163,184,0.2)",
                      },
                    }}
                  >
                    {isVideoMuted ? <VideocamOff /> : <Videocam />}
                  </IconButton>
                </Tooltip>

                <Tooltip title={isScreenSharing ? "Stop sharing" : "Share screen"}>
                  <IconButton
                    onClick={isScreenSharing ? stopScreenShare : startScreenShare}
                    sx={{
                      width: 56,
                      height: 56,
                      bgcolor: isScreenSharing ? "#dc2626" : "rgba(148,163,184,0.1)",
                      color: isScreenSharing ? "white" : "#94a3b8",
                      "&:hover": {
                        bgcolor: isScreenSharing ? "#b91c1c" : "rgba(148,163,184,0.2)",
                      },
                    }}
                  >
                    {isScreenSharing ? <StopScreenShare /> : <ScreenShare />}
                  </IconButton>
                </Tooltip>

                {!isMobile && (
                  <Tooltip title="Chat">
                    <IconButton
                      onClick={openChat}
                      sx={{
                        width: 56,
                        height: 56,
                        bgcolor: "rgba(148,163,184,0.1)",
                        color: "#94a3b8",
                        position: "relative",
                        "&:hover": {
                          bgcolor: "rgba(148,163,184,0.2)",
                        },
                      }}
                    >
                      <ChatBubble />
                      {unreadCount > 0 && (
                        <Chip
                          label={unreadCount}
                          size="small"
                          sx={{
                            position: "absolute",
                            top: -8,
                            right: -8,
                            bgcolor: "#dc2626",
                            color: "white",
                            minWidth: 20,
                            height: 20,
                            fontSize: "0.75rem",
                          }}
                        />
                      )}
                    </IconButton>
                  </Tooltip>
                )}
              </Stack>
            </Paper>
          </Slide>
        </Box>

        {/* Desktop Chat Sidebar */}
        {!isMobile && (
          <Slide direction="left" in={isChatOpen} timeout={300}>
            <Paper
              sx={{
                width: 360,
                height: "100%",
                bgcolor: "rgba(15,23,42,0.95)",
                backdropFilter: "blur(20px)",
                border: "1px solid rgba(148,163,184,0.1)",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {/* Chat Header */}
              <Box
                sx={{
                  p: 3,
                  borderBottom: "1px solid rgba(148,163,184,0.1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Typography variant="h6" fontWeight="600" color="white">
                  Chat
                </Typography>
                <IconButton onClick={() => setIsChatOpen(false)} sx={{ color: "#94a3b8" }}>
                  <Close />
                </IconButton>
              </Box>

              {/* Messages */}
              <Box
                sx={{
                  flex: 1,
                  overflowY: "auto",
                  p: 2,
                  "&::-webkit-scrollbar": { width: "6px" },
                  "&::-webkit-scrollbar-track": { bgcolor: "transparent" },
                  "&::-webkit-scrollbar-thumb": {
                    bgcolor: "rgba(148,163,184,0.3)",
                    borderRadius: "3px",
                  },
                }}
              >
                {messages.length === 0 ? (
                  <Box
                    sx={{
                      textAlign: "center",
                      py: 8,
                      color: "#64748b",
                    }}
                  >
                    <Chat sx={{ fontSize: 48, opacity: 0.3, mb: 2 }} />
                    <Typography variant="body2">No messages yet</Typography>
                    <Typography variant="caption">Start the conversation!</Typography>
                  </Box>
                ) : (
                  <Stack spacing={2}>
                    {messages.map((msg) => (
                      <Box
                        key={msg.id}
                        sx={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: msg.isOwn ? "flex-end" : "flex-start",
                        }}
                      >
                        <Typography
                          variant="caption"
                          sx={{
                            color: "#64748b",
                            mb: 0.5,
                            px: 1,
                          }}
                        >
                          {msg.username}
                        </Typography>
                        <Paper
                          sx={{
                            maxWidth: "85%",
                            p: 2,
                            bgcolor: msg.isOwn ? "#3b82f6" : "rgba(148,163,184,0.1)",
                            color: msg.isOwn ? "white" : "#e2e8f0",
                            borderRadius: 2,
                            borderBottomRightRadius: msg.isOwn ? 0.5 : 2,
                            borderBottomLeftRadius: msg.isOwn ? 2 : 0.5,
                          }}
                        >
                          <Typography variant="body2" sx={{ lineHeight: 1.4 }}>
                            {msg.message}
                          </Typography>
                        </Paper>
                      </Box>
                    ))}
                    <div ref={chatEndRef} />
                  </Stack>
                )}
              </Box>

              {/* Message Input */}
              <Box
                sx={{
                  p: 2,
                  borderTop: "1px solid rgba(148,163,184,0.1)",
                  display: "flex",
                  gap: 1,
                }}
              >
                <TextField
                  fullWidth
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      sendMessage()
                    }
                  }}
                  placeholder="Type a message..."
                  variant="outlined"
                  size="small"
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      bgcolor: "rgba(148,163,184,0.1)",
                      color: "white",
                      borderRadius: 2,
                      "& fieldset": {
                        borderColor: "rgba(148,163,184,0.2)",
                      },
                      "&:hover fieldset": {
                        borderColor: "rgba(148,163,184,0.3)",
                      },
                      "&.Mui-focused fieldset": {
                        borderColor: "#3b82f6",
                      },
                    },
                    "& .MuiInputBase-input::placeholder": {
                      color: "#64748b",
                    },
                  }}
                />
                <IconButton
                  onClick={sendMessage}
                  disabled={!message.trim()}
                  sx={{
                    bgcolor: message.trim() ? "#3b82f6" : "rgba(148,163,184,0.1)",
                    color: message.trim() ? "white" : "#64748b",
                    "&:hover": {
                      bgcolor: message.trim() ? "#2563eb" : "rgba(148,163,184,0.2)",
                    },
                  }}
                >
                  <Send />
                </IconButton>
              </Box>
            </Paper>
          </Slide>
        )}
      </Box>

      {/* Mobile Chat FAB */}
      {isMobile && (
        <Fab
          onClick={openChat}
          sx={{
            position: "fixed",
            bottom: 20,
            right: 20,
            bgcolor: "#3b82f6",
            color: "white",
            "&:hover": { bgcolor: "#2563eb" },
          }}
        >
          <ChatBubble />
          {unreadCount > 0 && (
            <Chip
              label={unreadCount}
              size="small"
              sx={{
                position: "absolute",
                top: -8,
                right: -8,
                bgcolor: "#dc2626",
                color: "white",
                minWidth: 20,
                height: 20,
                fontSize: "0.75rem",
              }}
            />
          )}
        </Fab>
      )}

      {/* Mobile Chat Dialog */}
      <Dialog
        open={isChatOpen && isMobile}
        onClose={() => setIsChatOpen(false)}
        fullScreen
        PaperProps={{
          sx: {
            bgcolor: "#0f172a",
            color: "white",
          },
        }}
      >
        <AppBar position="static" elevation={0} sx={{ bgcolor: "rgba(15,23,42,0.95)" }}>
          <Toolbar>
            <Typography variant="h6" sx={{ flex: 1 }}>
              Chat
            </Typography>
            <IconButton onClick={() => setIsChatOpen(false)} sx={{ color: "white" }}>
              <Close />
            </IconButton>
          </Toolbar>
        </AppBar>

        <Box sx={{ flex: 1, display: "flex", flexDirection: "column" }}>
          {/* Messages */}
          <Box
            sx={{
              flex: 1,
              overflowY: "auto",
              p: 2,
            }}
          >
            {messages.length === 0 ? (
              <Box
                sx={{
                  textAlign: "center",
                  py: 8,
                  color: "#64748b",
                }}
              >
                <Chat sx={{ fontSize: 48, opacity: 0.3, mb: 2 }} />
                <Typography variant="body2">No messages yet</Typography>
                <Typography variant="caption">Start the conversation!</Typography>
              </Box>
            ) : (
              <Stack spacing={2}>
                {messages.map((msg) => (
                  <Box
                    key={msg.id}
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: msg.isOwn ? "flex-end" : "flex-start",
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{
                        color: "#64748b",
                        mb: 0.5,
                        px: 1,
                      }}
                    >
                      {msg.username}
                    </Typography>
                    <Paper
                      sx={{
                        maxWidth: "85%",
                        p: 2,
                        bgcolor: msg.isOwn ? "#3b82f6" : "rgba(148,163,184,0.1)",
                        color: msg.isOwn ? "white" : "#e2e8f0",
                        borderRadius: 2,
                        borderBottomRightRadius: msg.isOwn ? 0.5 : 2,
                        borderBottomLeftRadius: msg.isOwn ? 2 : 0.5,
                      }}
                    >
                      <Typography variant="body2" sx={{ lineHeight: 1.4 }}>
                        {msg.message}
                      </Typography>
                    </Paper>
                  </Box>
                ))}
                <div ref={chatEndRef} />
              </Stack>
            )}
          </Box>

          {/* Message Input */}
          <Box
            sx={{
              p: 2,
              borderTop: "1px solid rgba(148,163,184,0.1)",
              display: "flex",
              gap: 1,
            }}
          >
            <TextField
              fullWidth
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  sendMessage()
                }
              }}
              placeholder="Type a message..."
              variant="outlined"
              size="small"
              sx={{
                "& .MuiOutlinedInput-root": {
                  bgcolor: "rgba(148,163,184,0.1)",
                  color: "white",
                  borderRadius: 2,
                  "& fieldset": {
                    borderColor: "rgba(148,163,184,0.2)",
                  },
                  "&:hover fieldset": {
                    borderColor: "rgba(148,163,184,0.3)",
                  },
                  "&.Mui-focused fieldset": {
                    borderColor: "#3b82f6",
                  },
                  "& input": {
                    fontSize: "16px", // Prevent iOS zoom
                  },
                },
                "& .MuiInputBase-input::placeholder": {
                  color: "#64748b",
                },
              }}
            />
            <IconButton
              onClick={sendMessage}
              disabled={!message.trim()}
              sx={{
                bgcolor: message.trim() ? "#3b82f6" : "rgba(148,163,184,0.1)",
                color: message.trim() ? "white" : "#64748b",
                "&:hover": {
                  bgcolor: message.trim() ? "#2563eb" : "rgba(148,163,184,0.2)",
                },
              }}
            >
              <Send />
            </IconButton>
          </Box>
        </Box>
      </Dialog>

      {/* Leave Meeting Dialog */}
      <Dialog
        open={showLeaveDialog}
        onClose={() => setShowLeaveDialog(false)}
        PaperProps={{
          sx: {
            borderRadius: 3,
            p: 2,
            bgcolor: "#1e293b",
            color: "white",
            minWidth: { xs: 300, sm: 400 },
          },
        }}
      >
        <DialogTitle sx={{ textAlign: "center", pb: 2 }}>
          <ExitToApp sx={{ fontSize: 48, color: "#dc2626", mb: 2 }} />
          <Typography variant="h6" fontWeight="600">
            Leave Meeting?
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ textAlign: "center", pb: 2 }}>
          <Typography variant="body1" color="#94a3b8">
            Are you sure you want to leave this meeting?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ justifyContent: "center", gap: 2, px: 3, pb: 3 }}>
          <Button
            onClick={() => setShowLeaveDialog(false)}
            sx={{
              px: 4,
              py: 1,
              borderRadius: 2,
              color: "#94a3b8",
              border: "1px solid rgba(148,163,184,0.2)",
              "&:hover": {
                bgcolor: "rgba(148,163,184,0.1)",
              },
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={leaveMeeting}
            sx={{
              px: 4,
              py: 1,
              borderRadius: 2,
              bgcolor: "#dc2626",
              color: "white",
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
  )
}

export default MeetingRoom
