"use client"

import { useEffect, useRef, useState } from "react"
import { useParams } from "react-router-dom"
import { io } from "socket.io-client"
import { useUser } from "@clerk/clerk-react"
import {
  Box,
  TextField,
  Button,
  IconButton,
  Typography,
  Card,
  CardContent,
  Paper,
  Chip,
  Avatar,
  Divider,
  Container,
  Grid,
  Badge,
  Fade,
  Zoom,
  CircularProgress,
} from "@mui/material"
import {
  Mic,
  MicOff,
  Videocam,
  VideocamOff,
  Send,
  PlayArrow,
  Person,
  VideoCall,
  Chat,
  Circle,
} from "@mui/icons-material"

const backendUrl = "https://live-meet-site.onrender.com"

const MeetingRoom = () => {
  const { roomId } = useParams()
  const { user, isLoaded } = useUser()
  const userVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)
  const peerConnection = useRef(null)
  const streamRef = useRef(null)
  const socketRef = useRef(null)
  const chatEndRef = useRef(null)

  const [isStarted, setIsStarted] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState("")
  const [chat, setChat] = useState([])
  const [isAudioMuted, setIsAudioMuted] = useState(false)
  const [isVideoMuted, setIsVideoMuted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // Auto scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [chat])

  // Initialize socket when clerk is loaded
  useEffect(() => {
    if (!isLoaded) return
    socketRef.current = io(backendUrl, { transports: ["websocket"] })

    // Listen for chat messages
    socketRef.current.on("chat-message", (data) => {
      setChat((prev) => [...prev, { username: data.username, message: data.message, timestamp: new Date() }])
    })

    // Cleanup on unmount
    return () => {
      peerConnection.current?.close()
      streamRef.current?.getTracks?.().forEach((track) => track.stop())
      socketRef.current?.disconnect()
    }
  }, [isLoaded, roomId])

  // Setup signaling listeners only when meeting started
  useEffect(() => {
    if (!isStarted || !isLoaded || !socketRef.current) return

    const socket = socketRef.current
    let remoteSocketId = null

    // Join signaling rooms
    socket.emit("join-meeting", roomId)
    socket.emit("join", roomId)

    socket.on("user-joined", async ({ socketId }) => {
      remoteSocketId = socketId
      if (!peerConnection.current && streamRef.current) {
        peerConnection.current = createPeerConnection(socket, remoteSocketId)
        streamRef.current.getTracks().forEach((track) => peerConnection.current.addTrack(track, streamRef.current))
        const offer = await peerConnection.current.createOffer()
        await peerConnection.current.setLocalDescription(offer)
        socket.emit("offer", { offer, target: remoteSocketId }, roomId)
      }
    })

    socket.on("offer", async ({ offer, from }) => {
      remoteSocketId = from
      if (!peerConnection.current && streamRef.current) {
        peerConnection.current = createPeerConnection(socket, remoteSocketId)
        streamRef.current.getTracks().forEach((track) => peerConnection.current.addTrack(track, streamRef.current))
        await peerConnection.current.setRemoteDescription(new RTCSessionDescription(offer))
        const answer = await peerConnection.current.createAnswer()
        await peerConnection.current.setLocalDescription(answer)
        socket.emit("answer", { answer, target: from }, roomId)
      }
    })

    socket.on("answer", async ({ answer }) => {
      if (peerConnection.current) {
        await peerConnection.current.setRemoteDescription(new RTCSessionDescription(answer))
      }
    })

    socket.on("ice-candidate", async ({ candidate }) => {
      if (peerConnection.current && candidate) {
        try {
          await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate))
        } catch {
          // ignore errors on ICE candidate adding
        }
      }
    })

    socket.on("user-left", () => {
      setIsConnected(false)
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null
      peerConnection.current?.close()
      peerConnection.current = null
    })

    // Cleanup event listeners on unmount or dependency change
    return () => {
      socket.off("user-joined")
      socket.off("offer")
      socket.off("answer")
      socket.off("ice-candidate")
      socket.off("user-left")
      peerConnection.current?.close()
      peerConnection.current = null
    }
  }, [isStarted, isLoaded, roomId])

  // PeerConnection creation helper
  const createPeerConnection = (socket, targetSocketId) => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    })

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("ice-candidate", { candidate: event.candidate, target: targetSocketId }, roomId)
      }
    }

    pc.ontrack = (event) => {
      if (remoteVideoRef.current && event.streams[0]) {
        remoteVideoRef.current.srcObject = event.streams[0]
        setIsConnected(true)
      }
    }

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState
      if (state === "connected" || state === "completed") setIsConnected(true)
      if (state === "disconnected" || state === "failed") setIsConnected(false)
    }

    return pc
  }

  // Start meeting: get media and show local video
  const startMeeting = async () => {
    setIsLoading(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: true,
      })
      streamRef.current = stream
      setIsStarted(true)
    } catch (error) {
      setError(`Media access failed: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  // Assign local stream to video element when both started and video ref ready
  useEffect(() => {
    if (isStarted && userVideoRef.current && streamRef.current) {
      userVideoRef.current.srcObject = streamRef.current
      userVideoRef.current.play().catch(() => {})
    }
  }, [isStarted])

  // Toggle audio track enabled state
  const toggleAudio = () => {
    if (streamRef.current) {
      const audioTrack = streamRef.current.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled
        setIsAudioMuted(!audioTrack.enabled)
      }
    }
  }

  // Toggle video track enabled state
  const toggleVideo = () => {
    if (streamRef.current) {
      const videoTrack = streamRef.current.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled
        setIsVideoMuted(!videoTrack.enabled)
      }
    }
  }

  // Send chat message
  const handleSend = () => {
    if (message.trim()) {
      socketRef.current.emit("chat-message", {
        roomId,
        message,
        username: user?.username || user?.firstName || "Anonymous",
      })
      setMessage("")
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        py: 4,
      }}
    >
      <Container maxWidth="xl">
        <Fade in timeout={800}>
          <Paper
            elevation={24}
            sx={{
              borderRadius: 4,
              overflow: "hidden",
              background: "rgba(255, 255, 255, 0.95)",
              backdropFilter: "blur(20px)",
            }}
          >
            {/* Header */}
            <Box
              sx={{
                background: "linear-gradient(90deg, #667eea 0%, #764ba2 100%)",
                color: "white",
                p: 3,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                <VideoCall sx={{ fontSize: 32 }} />
                <Box>
                  <Typography variant="h4" fontWeight="bold">
                    Meeting Room
                  </Typography>
                  <Typography variant="subtitle1" sx={{ opacity: 0.9 }}>
                    Room ID: {roomId}
                  </Typography>
                </Box>
              </Box>
              <Chip
                icon={<Circle sx={{ fontSize: 12 }} />}
                label={isConnected ? "Connected" : isStarted ? "Waiting for participants" : "Not started"}
                color={isConnected ? "success" : isStarted ? "warning" : "default"}
                sx={{
                  bgcolor: isConnected
                    ? "rgba(76, 175, 80, 0.2)"
                    : isStarted
                      ? "rgba(255, 152, 0, 0.2)"
                      : "rgba(255, 255, 255, 0.2)",
                  color: "white",
                  fontWeight: "bold",
                }}
              />
            </Box>

            <Box sx={{ p: 4 }}>
              {error && (
                <Fade in>
                  <Paper
                    sx={{
                      p: 2,
                      mb: 3,
                      bgcolor: "error.light",
                      color: "error.contrastText",
                      borderRadius: 2,
                    }}
                  >
                    <Typography>{error}</Typography>
                  </Paper>
                </Fade>
              )}

              {!isStarted ? (
                <Zoom in timeout={600}>
                  <Box
                    sx={{
                      textAlign: "center",
                      py: 8,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <Avatar
                      sx={{
                        width: 120,
                        height: 120,
                        bgcolor: "primary.main",
                        mb: 2,
                      }}
                    >
                      <VideoCall sx={{ fontSize: 60 }} />
                    </Avatar>

                    <Typography variant="h5" color="text.secondary" sx={{ mb: 2 }}>
                      Ready to join the meeting?
                    </Typography>

                    <Button
                      onClick={startMeeting}
                      variant="contained"
                      size="large"
                      disabled={isLoading}
                      startIcon={isLoading ? <CircularProgress size={20} /> : <PlayArrow />}
                      sx={{
                        px: 6,
                        py: 2,
                        borderRadius: 3,
                        fontSize: "1.1rem",
                        fontWeight: "bold",
                        background: "linear-gradient(45deg, #667eea 30%, #764ba2 90%)",
                        boxShadow: "0 8px 32px rgba(102, 126, 234, 0.3)",
                        "&:hover": {
                          transform: "translateY(-2px)",
                          boxShadow: "0 12px 40px rgba(102, 126, 234, 0.4)",
                        },
                        transition: "all 0.3s ease",
                      }}
                    >
                      {isLoading ? "Starting..." : "Start Meeting"}
                    </Button>

                    <Paper
                      sx={{
                        p: 3,
                        bgcolor: "grey.50",
                        borderRadius: 2,
                        maxWidth: 500,
                        border: "1px solid",
                        borderColor: "grey.200",
                      }}
                    >
                      <Typography color="text.secondary" variant="body2">
                        💡 <strong>Tip:</strong> Share this link with others to join the meeting:
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{
                          mt: 1,
                          p: 1,
                          bgcolor: "white",
                          borderRadius: 1,
                          fontFamily: "monospace",
                          fontSize: "0.85rem",
                          wordBreak: "break-all",
                        }}
                      >
                        {window.location.href}
                      </Typography>
                    </Paper>
                  </Box>
                </Zoom>
              ) : (
                <Grid container spacing={4}>
                  {/* Video Section */}
                  <Grid item xs={12} lg={8}>
                    <Grid container spacing={3}>
                      {/* Local Video */}
                      <Grid item xs={12} md={6}>
                        <Fade in timeout={1000}>
                          <Card
                            elevation={8}
                            sx={{
                              borderRadius: 3,
                              overflow: "hidden",
                              position: "relative",
                              background: "linear-gradient(145deg, #f0f0f0, #ffffff)",
                            }}
                          >
                            <CardContent sx={{ p: 0, position: "relative" }}>
                              <Box
                                sx={{
                                  position: "absolute",
                                  top: 12,
                                  left: 12,
                                  zIndex: 2,
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 1,
                                }}
                              >
                                <Chip
                                  icon={<Person sx={{ fontSize: 16 }} />}
                                  label="You"
                                  size="small"
                                  sx={{
                                    bgcolor: "rgba(0, 0, 0, 0.7)",
                                    color: "white",
                                    fontWeight: "bold",
                                  }}
                                />
                              </Box>

                              <video
                                ref={userVideoRef}
                                autoPlay
                                playsInline
                                muted
                                style={{
                                  width: "100%",
                                  height: "280px",
                                  objectFit: "cover",
                                  background: "#000",
                                }}
                              />

                              <Box
                                sx={{
                                  position: "absolute",
                                  bottom: 12,
                                  left: "50%",
                                  transform: "translateX(-50%)",
                                  display: "flex",
                                  gap: 1,
                                }}
                              >
                                <IconButton
                                  onClick={toggleAudio}
                                  sx={{
                                    bgcolor: isAudioMuted ? "error.main" : "rgba(255, 255, 255, 0.9)",
                                    color: isAudioMuted ? "white" : "primary.main",
                                    "&:hover": {
                                      bgcolor: isAudioMuted ? "error.dark" : "white",
                                      transform: "scale(1.1)",
                                    },
                                    transition: "all 0.2s ease",
                                  }}
                                >
                                  {isAudioMuted ? <MicOff /> : <Mic />}
                                </IconButton>
                                <IconButton
                                  onClick={toggleVideo}
                                  sx={{
                                    bgcolor: isVideoMuted ? "error.main" : "rgba(255, 255, 255, 0.9)",
                                    color: isVideoMuted ? "white" : "primary.main",
                                    "&:hover": {
                                      bgcolor: isVideoMuted ? "error.dark" : "white",
                                      transform: "scale(1.1)",
                                    },
                                    transition: "all 0.2s ease",
                                  }}
                                >
                                  {isVideoMuted ? <VideocamOff /> : <Videocam />}
                                </IconButton>
                              </Box>
                            </CardContent>
                          </Card>
                        </Fade>
                      </Grid>

                      {/* Remote Video */}
                      <Grid item xs={12} md={6}>
                        <Fade in timeout={1200}>
                          <Card
                            elevation={8}
                            sx={{
                              borderRadius: 3,
                              overflow: "hidden",
                              position: "relative",
                              background: "linear-gradient(145deg, #f0f0f0, #ffffff)",
                            }}
                          >
                            <CardContent sx={{ p: 0, position: "relative" }}>
                              <Box
                                sx={{
                                  position: "absolute",
                                  top: 12,
                                  left: 12,
                                  zIndex: 2,
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 1,
                                }}
                              >
                                <Badge
                                  color={isConnected ? "success" : "default"}
                                  variant="dot"
                                  sx={{
                                    "& .MuiBadge-dot": {
                                      width: 8,
                                      height: 8,
                                    },
                                  }}
                                >
                                  <Chip
                                    icon={<Person sx={{ fontSize: 16 }} />}
                                    label={isConnected ? "Participant" : "Waiting..."}
                                    size="small"
                                    sx={{
                                      bgcolor: "rgba(0, 0, 0, 0.7)",
                                      color: "white",
                                      fontWeight: "bold",
                                    }}
                                  />
                                </Badge>
                              </Box>

                              <video
                                ref={remoteVideoRef}
                                autoPlay
                                playsInline
                                style={{
                                  width: "100%",
                                  height: "280px",
                                  objectFit: "cover",
                                  background: "#000",
                                }}
                              />

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
                                  <CircularProgress sx={{ color: "white", mb: 2 }} />
                                  <Typography variant="body2">Waiting for participant...</Typography>
                                </Box>
                              )}
                            </CardContent>
                          </Card>
                        </Fade>
                      </Grid>
                    </Grid>

                    {!isConnected && (
                      <Fade in timeout={1400}>
                        <Paper
                          sx={{
                            mt: 3,
                            p: 3,
                            bgcolor: "info.light",
                            color: "info.contrastText",
                            borderRadius: 2,
                            textAlign: "center",
                          }}
                        >
                          <Typography variant="body1" sx={{ mb: 1 }}>
                            🔗 <strong>Share this meeting link:</strong>
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{
                              p: 1,
                              bgcolor: "rgba(255, 255, 255, 0.2)",
                              borderRadius: 1,
                              fontFamily: "monospace",
                              wordBreak: "break-all",
                            }}
                          >
                            {window.location.href}
                          </Typography>
                        </Paper>
                      </Fade>
                    )}
                  </Grid>

                  {/* Chat Section */}
                  <Grid item xs={12} lg={4}>
                    <Fade in timeout={1600}>
                      <Card
                        elevation={8}
                        sx={{
                          height: 500,
                          borderRadius: 3,
                          display: "flex",
                          flexDirection: "column",
                          background: "linear-gradient(145deg, #ffffff, #f8f9fa)",
                        }}
                      >
                        <Box
                          sx={{
                            p: 2,
                            bgcolor: "primary.main",
                            color: "white",
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                          }}
                        >
                          <Chat />
                          <Typography variant="h6" fontWeight="bold">
                            Chat
                          </Typography>
                          <Chip
                            label={chat.length}
                            size="small"
                            sx={{
                              bgcolor: "rgba(255, 255, 255, 0.2)",
                              color: "white",
                              ml: "auto",
                            }}
                          />
                        </Box>

                        <Box
                          sx={{
                            flex: 1,
                            overflowY: "auto",
                            p: 2,
                            bgcolor: "grey.50",
                            "&::-webkit-scrollbar": {
                              width: "6px",
                            },
                            "&::-webkit-scrollbar-track": {
                              bgcolor: "transparent",
                            },
                            "&::-webkit-scrollbar-thumb": {
                              bgcolor: "grey.300",
                              borderRadius: "3px",
                            },
                          }}
                        >
                          {chat.length === 0 ? (
                            <Box
                              sx={{
                                textAlign: "center",
                                color: "text.secondary",
                                mt: 4,
                              }}
                            >
                              <Chat sx={{ fontSize: 48, opacity: 0.3, mb: 2 }} />
                              <Typography variant="body2">No messages yet. Start the conversation!</Typography>
                            </Box>
                          ) : (
                            chat.map((msg, idx) => (
                              <Fade in key={idx} timeout={300}>
                                <Paper
                                  sx={{
                                    p: 2,
                                    mb: 2,
                                    borderRadius: 2,
                                    bgcolor:
                                      msg.username === (user?.username || user?.firstName || "Anonymous")
                                        ? "primary.light"
                                        : "white",
                                    color:
                                      msg.username === (user?.username || user?.firstName || "Anonymous")
                                        ? "primary.contrastText"
                                        : "text.primary",
                                    ml: msg.username === (user?.username || user?.firstName || "Anonymous") ? 2 : 0,
                                    mr: msg.username === (user?.username || user?.firstName || "Anonymous") ? 0 : 2,
                                  }}
                                >
                                  <Typography variant="caption" sx={{ opacity: 0.8 }}>
                                    {msg.username}
                                  </Typography>
                                  <Typography variant="body2" sx={{ mt: 0.5 }}>
                                    {msg.message}
                                  </Typography>
                                </Paper>
                              </Fade>
                            ))
                          )}
                          <div ref={chatEndRef} />
                        </Box>

                        <Divider />

                        <Box sx={{ p: 2, display: "flex", gap: 1 }}>
                          <TextField
                            fullWidth
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            onKeyPress={handleKeyPress}
                            placeholder="Type your message..."
                            variant="outlined"
                            size="small"
                            sx={{
                              "& .MuiOutlinedInput-root": {
                                borderRadius: 2,
                              },
                            }}
                          />
                          <IconButton
                            onClick={handleSend}
                            disabled={!message.trim()}
                            sx={{
                              bgcolor: "primary.main",
                              color: "white",
                              "&:hover": {
                                bgcolor: "primary.dark",
                                transform: "scale(1.05)",
                              },
                              "&:disabled": {
                                bgcolor: "grey.300",
                              },
                              transition: "all 0.2s ease",
                            }}
                          >
                            <Send />
                          </IconButton>
                        </Box>
                      </Card>
                    </Fade>
                  </Grid>
                </Grid>
              )}
            </Box>
          </Paper>
        </Fade>
      </Container>
    </Box>
  )
}

export default MeetingRoom
