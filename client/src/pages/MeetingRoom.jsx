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
  Snackbar,
  Alert,
  Slide,
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
  Circle,
  ExitToApp,
  CallEnd,
  Close,
  ChatBubble,
  ScreenShare,
  StopScreenShare,
  PresentToAll,
  Warning,
  CheckCircle,
} from "@mui/icons-material"

const backendUrl = "http://localhost:3000"

const MeetingRoom = () => {
  const { roomId } = useParams()
  const { user, isLoaded } = useUser()
  const navigate = useNavigate()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down("md"))
  const isTablet = useMediaQuery(theme.breakpoints.between("md", "lg"))
  const isSmallMobile = useMediaQuery(theme.breakpoints.down("sm"))

  // Video refs
  const userVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)
  const localScreenRef = useRef(null)
  const remoteScreenRef = useRef(null)

  // WebRTC refs
  const peerConnection = useRef(null)
  const streamRef = useRef(null)
  const screenStreamRef = useRef(null)
  const socketRef = useRef(null)
  const chatEndRef = useRef(null)
  const remoteSocketId = useRef(null)

  // States
  const [isStarted, setIsStarted] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState("")
  const [chat, setChat] = useState([])
  const [isAudioMuted, setIsAudioMuted] = useState(false)
  const [isVideoMuted, setIsVideoMuted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [showLeaveDialog, setShowLeaveDialog] = useState(false)
  const [isChatOpen, setIsChatOpen] = useState(false)

  // Screen sharing states
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [remoteScreenSharing, setRemoteScreenSharing] = useState(false)
  const [screenShareStatus, setScreenShareStatus] = useState(null) // 'starting', 'stopping', 'error'

  // Notification states
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'info' })

  // Helper function to show notifications
  const showNotification = useCallback((message, severity = 'info') => {
    setNotification({ open: true, message, severity })
  }, [])

  // Helper function to get video sender from peer connection
  const getVideoSender = useCallback(() => {
    if (!peerConnection.current) return null
    const senders = peerConnection.current.getSenders()
    return senders.find(sender => 
      sender.track && sender.track.kind === 'video'
    )
  }, [])

  // Helper function to replace video track
  const replaceVideoTrack = useCallback(async (newTrack) => {
    const videoSender = getVideoSender()
    if (videoSender) {
      try {
        await videoSender.replaceTrack(newTrack)
        console.log('Video track replaced successfully:', newTrack?.label || 'null')
        return true
      } catch (error) {
        console.error('Failed to replace video track:', error)
        return false
      }
    }
    return false
  }, [getVideoSender])

  // Helper function to create offer and send to remote peer
  const createAndSendOffer = useCallback(async () => {
    if (!peerConnection.current || !remoteSocketId.current) {
      console.error('Cannot create offer: missing peer connection or remote socket ID')
      return false
    }

    try {
      const offer = await peerConnection.current.createOffer()
      await peerConnection.current.setLocalDescription(offer)
      
      socketRef.current.emit("offer", { 
        offer, 
        target: remoteSocketId.current 
      }, roomId)
      
      console.log('Offer sent to:', remoteSocketId.current)
      return true
    } catch (error) {
      console.error('Failed to create and send offer:', error)
      return false
    }
  }, [roomId])

  // Improved screen sharing function
  const startScreenShare = useCallback(async () => {
    if (isScreenSharing) return
    
    setScreenShareStatus('starting')
    
    try {
      // Get screen share stream
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 },
        },
        audio: true,
      })

      const screenVideoTrack = screenStream.getVideoTracks()[0]
      if (!screenVideoTrack) {
        throw new Error('No video track in screen share stream')
      }

      // Store screen stream
      screenStreamRef.current = screenStream
      
      // Only replace track if peer connection exists and is connected
      if (peerConnection.current && isConnected) {
        const replaced = await replaceVideoTrack(screenVideoTrack)
        if (!replaced) {
          // Fallback: add track if replace failed
          peerConnection.current.addTrack(screenVideoTrack, screenStream)
        }
        
        // Create and send new offer only if we have a remote peer
        if (remoteSocketId.current) {
          await createAndSendOffer()
        }
      }

      // Update local display
      if (localScreenRef.current) {
        localScreenRef.current.srcObject = screenStream
        localScreenRef.current.play().catch(console.error)
      }

      // Update states
      setIsScreenSharing(true)
      setScreenShareStatus(null)
      
      // Notify remote peer (even if not connected yet, for when they join)
      socketRef.current.emit("screen-share-started", roomId)
      showNotification('Screen sharing started', 'success')

      // Handle screen share end (when user stops from browser UI)
      screenVideoTrack.onended = () => {
        console.log('Screen share ended by user')
        stopScreenShare()
      }

    } catch (error) {
      console.error('Screen share failed:', error)
      setScreenShareStatus('error')
      setIsScreenSharing(false)
      screenStreamRef.current = null
      
      let errorMessage = 'Failed to start screen sharing'
      if (error.name === 'NotAllowedError') {
        errorMessage = 'Screen sharing permission denied'
      } else if (error.name === 'NotSupportedError') {
        errorMessage = 'Screen sharing not supported in this browser'
      }
      
      showNotification(errorMessage, 'error')
      setTimeout(() => setScreenShareStatus(null), 3000)
    }
  }, [isScreenSharing, isConnected, replaceVideoTrack, createAndSendOffer, roomId, showNotification])

  // Improved stop screen sharing function
  const stopScreenShare = useCallback(async () => {
    if (!isScreenSharing) return
    
    setScreenShareStatus('stopping')
    
    try {
      // Stop screen stream tracks
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => {
          track.stop()
          console.log('Stopped screen track:', track.kind)
        })
        screenStreamRef.current = null
      }

      // Only replace track if peer connection exists and is connected
      if (peerConnection.current && isConnected) {
        // Get camera video track to restore
        const cameraVideoTrack = streamRef.current?.getVideoTracks()[0]
        
        if (cameraVideoTrack) {
          // Replace screen track with camera track
          const replaced = await replaceVideoTrack(cameraVideoTrack)
          if (!replaced) {
            console.warn('Failed to replace track, camera may not be restored properly')
          }
        } else {
          // No camera track available, replace with null to remove video
          await replaceVideoTrack(null)
        }

        // Create and send new offer only if we have a remote peer
        if (remoteSocketId.current) {
          await createAndSendOffer()
        }
      }

      // Clear local screen display
      if (localScreenRef.current) {
        localScreenRef.current.srcObject = null
      }

      // Update states
      setIsScreenSharing(false)
      setScreenShareStatus(null)
      
      // Notify remote peer
      socketRef.current.emit("screen-share-stopped", roomId)
      showNotification('Screen sharing stopped', 'info')

  } catch (error) {
    console.error('Failed to stop screen sharing:', error)
    setScreenShareStatus('error')
    showNotification('Error stopping screen share', 'error')
    setTimeout(() => setScreenShareStatus(null), 3000)
  }
}, [isScreenSharing, isConnected, replaceVideoTrack, createAndSendOffer, roomId, showNotification])

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
      setChat((prev) => [...prev, { 
        username: data.username, 
        message: data.message, 
        timestamp: new Date() 
      }])
    })

    // Screen sharing socket events
    socketRef.current.on("screen-share-started", () => {
      console.log('Remote user started screen sharing')
      setRemoteScreenSharing(true)
    })

    socketRef.current.on("screen-share-stopped", () => {
      console.log('Remote user stopped screen sharing')
      setRemoteScreenSharing(false)
      if (remoteScreenRef.current) {
        remoteScreenRef.current.srcObject = null
      }
    })

    // Cleanup on unmount
    return () => {
      peerConnection.current?.close()
      streamRef.current?.getTracks?.().forEach((track) => track.stop())
      screenStreamRef.current?.getTracks?.().forEach((track) => track.stop())
      socketRef.current?.disconnect()
    }
  }, [isLoaded, roomId])

  // Setup signaling listeners only when meeting started
  useEffect(() => {
    if (!isStarted || !isLoaded || !socketRef.current) return

    const socket = socketRef.current

    // Join signaling rooms
    socket.emit("join-meeting", roomId)
    socket.emit("join", roomId)

    socket.on("user-joined", async ({ socketId }) => {
      console.log('User joined:', socketId)
      remoteSocketId.current = socketId
      
      if (!peerConnection.current && streamRef.current) {
        peerConnection.current = createPeerConnection(socket, socketId)
        
        // Add camera tracks
        streamRef.current.getTracks().forEach((track) => {
          peerConnection.current.addTrack(track, streamRef.current)
        })

        // If screen sharing is active, replace the video track
        if (isScreenSharing && screenStreamRef.current) {
          const screenVideoTrack = screenStreamRef.current.getVideoTracks()[0]
          if (screenVideoTrack) {
            const replaced = await replaceVideoTrack(screenVideoTrack)
            if (!replaced) {
              // Fallback: add screen track
              peerConnection.current.addTrack(screenVideoTrack, screenStreamRef.current)
            }
          }
        }

        // Create and send offer
        await createAndSendOffer()
      }
    })

    socket.on("offer", async ({ offer, from }) => {
      console.log("Received offer from:", from)
      remoteSocketId.current = from
      
      if (!peerConnection.current && streamRef.current) {
        peerConnection.current = createPeerConnection(socket, from)
        
        // Add all tracks from current stream
        streamRef.current.getTracks().forEach((track) => {
          peerConnection.current.addTrack(track, streamRef.current)
        })
      }

      if (peerConnection.current) {
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
        } catch (error) {
          console.warn('Failed to add ICE candidate:', error)
        }
      }
    })

    socket.on("user-left", () => {
      console.log('User left')
      setIsConnected(false)
      setRemoteScreenSharing(false)
      remoteSocketId.current = null
      
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null
      if (remoteScreenRef.current) remoteScreenRef.current.srcObject = null
      
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
  }, [isStarted, isLoaded, roomId, createAndSendOffer])

  // PeerConnection creation helper
  const createPeerConnection = useCallback((socket, targetSocketId) => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" }
      ],
    })

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("ice-candidate", { 
          candidate: event.candidate, 
          target: targetSocketId 
        }, roomId)
      }
    }

    pc.ontrack = (event) => {
      const [stream] = event.streams
      console.log("Received track:", event.track.kind, event.track.label, stream?.id)
      
      if (stream) {
        // Improved stream detection logic
        const isScreenStream = 
          stream.id.includes("screen") ||
          event.track.label.includes("screen") ||
          event.track.getSettings().displaySurface ||
          event.track.label.includes("monitor") ||
          event.track.label.includes("window") ||
          event.track.label.includes("tab")

        if (isScreenStream) {
          console.log("Detected screen share stream")
          if (remoteScreenRef.current) {
            remoteScreenRef.current.srcObject = stream
            remoteScreenRef.current.play().catch(console.error)
          }
          setRemoteScreenSharing(true)
        } else {
          console.log("Detected camera stream")
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = stream
            remoteVideoRef.current.play().catch(console.error)
          }
          // Only set remoteScreenSharing to false if we're sure this is a camera stream
          // and we were previously showing screen share
          if (remoteScreenSharing) {
            setRemoteScreenSharing(false)
          }
        }
        setIsConnected(true)
      }
    }

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState
      console.log("ICE connection state:", state)
      
      if (state === "connected" || state === "completed") {
        setIsConnected(true)
        showNotification('Connected to participant', 'success')
      }
      if (state === "disconnected" || state === "failed") {
        setIsConnected(false)
        showNotification('Connection lost', 'warning')
      }
    }

    return pc
  }, [roomId, remoteScreenSharing, showNotification])

  // Start meeting: get media and show local video
  const startMeeting = async () => {
    setIsLoading(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: { ideal: 1280 }, 
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
      })
      
      streamRef.current = stream
      setIsStarted(true)
      showNotification('Meeting started successfully', 'success')
    } catch (error) {
      console.error('Media access failed:', error)
      let errorMessage = `Media access failed: ${error.message}`
      
      if (error.name === 'NotAllowedError') {
        errorMessage = 'Camera and microphone access denied. Please allow permissions and try again.'
      } else if (error.name === 'NotFoundError') {
        errorMessage = 'No camera or microphone found. Please check your devices.'
      }
      
      setError(errorMessage)
      showNotification(errorMessage, 'error')
    } finally {
      setIsLoading(false)
    }
  }

  // Leave meeting function
  const leaveMeeting = useCallback(() => {
    // Stop screen sharing if active
    if (isScreenSharing) {
      stopScreenShare()
    }

    // Stop all tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop())
    }

    // Close peer connection
    if (peerConnection.current) {
      peerConnection.current.close()
    }

    // Disconnect socket
    if (socketRef.current) {
      socketRef.current.disconnect()
    }

    // Navigate back to home
    navigate("/")
  }, [isScreenSharing, stopScreenShare, navigate])

  const handleLeaveMeeting = () => {
    setShowLeaveDialog(true)
  }

  const confirmLeaveMeeting = () => {
    setShowLeaveDialog(false)
    leaveMeeting()
  }

  // Assign local stream to video element when both started and video ref ready
  useEffect(() => {
    if (isStarted && userVideoRef.current && streamRef.current) {
      userVideoRef.current.srcObject = streamRef.current
      userVideoRef.current.play().catch(() => {})
    }
  }, [isStarted])

  // Toggle audio track enabled state
  const toggleAudio = useCallback(() => {
    if (streamRef.current) {
      const audioTrack = streamRef.current.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled
        setIsAudioMuted(!audioTrack.enabled)
        showNotification(
          audioTrack.enabled ? 'Microphone unmuted' : 'Microphone muted', 
          'info'
        )
      }
    }
  }, [showNotification])

  // Toggle video track enabled state
  const toggleVideo = useCallback(() => {
    if (streamRef.current) {
      const videoTrack = streamRef.current.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled
        setIsVideoMuted(!videoTrack.enabled)
        showNotification(
          videoTrack.enabled ? 'Camera turned on' : 'Camera turned off', 
          'info'
        )
      }
    }
  }, [showNotification])

  // Send chat message
  const handleSend = useCallback(() => {
    if (message.trim()) {
      socketRef.current.emit("chat-message", {
        roomId,
        message,
        username: user?.username || user?.firstName || "Anonymous",
      })
      setMessage("")
    }
  }, [message, roomId, user])

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Enhanced Chat Component
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
            <Typography variant="body2" sx={{ fontSize: { xs: "0.85rem", sm: "0.875rem" } }}>
              No messages yet
            </Typography>
            <Typography variant="caption" sx={{ fontSize: { xs: "0.75rem", sm: "0.75rem" } }}>
              Start the conversation!
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: { xs: 1.5, sm: 2 } }}>
            {chat.map((msg, idx) => {
              const isOwnMessage = msg.username === (user?.username || user?.firstName || "Anonymous")
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
              )
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
          placeholder="Type a message..."
          variant="outlined"
          size="small"
          autoComplete="off"
          sx={{
            "& .MuiOutlinedInput-root": {
              borderRadius: 2,
              bgcolor: "#f9fafb",
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
            e.stopPropagation()
            handleSend()
          }}
          disabled={!message.trim()}
          sx={{
            width: { xs: 44, sm: 40 },
            height: { xs: 44, sm: 40 },
            bgcolor: message.trim() ? "#1976d2" : "#f3f4f6",
            color: message.trim() ? "white" : "#9ca3af",
            "&:hover": {
              bgcolor: message.trim() ? "#1565c0" : "#e5e7eb",
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
  )

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "#f8f9fa",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {!isStarted ? (
        <Container maxWidth="sm" sx={{ flex: 1, display: "flex", alignItems: "center", py: 4 }}>
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
                <VideoCall sx={{ fontSize: { xs: 40, sm: 50, md: 60 }, color: "#1976d2" }} />
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
                  <Typography color="#dc2626" sx={{ fontSize: { xs: "0.85rem", sm: "0.875rem" } }}>
                    {error}
                  </Typography>
                </Paper>
              )}

              <Button
                onClick={startMeeting}
                disabled={isLoading}
                startIcon={isLoading ? <CircularProgress size={20} /> : <PlayArrow />}
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
                {isLoading ? "Starting..." : "Start Meeting"}
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
              <Toolbar sx={{ justifyContent: "space-between", minHeight: { xs: 56, sm: 64 } }}>
                <Box>
                  <Typography variant="h6" fontWeight="600" sx={{ fontSize: { xs: "1rem", sm: "1.25rem" } }}>
                    Meeting
                  </Typography>
                  <Typography variant="caption" color="#6b7280" sx={{ fontSize: { xs: "0.7rem", sm: "0.75rem" } }}>
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
                          color: isConnected ? "#10b981" : "#f59e0b",
                        }}
                      />
                      <Typography variant="body2" color="#6b7280">
                        {isConnected ? "Connected" : "Waiting for others"}
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

              {/* SCREEN SHARING SECTION */}
              {(isScreenSharing || remoteScreenSharing) && (
                <Box sx={{ mb: { xs: 1, md: 2 } }}>
                  {/* Main Screen Share Display */}
                  <Paper
                    sx={{
                      bgcolor: "white",
                      borderRadius: { xs: 1, md: 2 },
                      border: "1px solid #e5e7eb",
                      overflow: "hidden",
                      position: "relative",
                      height: { xs: "250px", sm: "300px", md: "350px" },
                      mb: 2,
                    }}
                  >
                    <Box
                      sx={{
                        position: "absolute",
                        top: { xs: 8, md: 16 },
                        left: { xs: 8, md: 16 },
                        zIndex: 2,
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                      }}
                    >
                      <PresentToAll sx={{ fontSize: 16, color: "white" }} />
                      <Chip
                        label={isScreenSharing ? "Your Screen" : `${isConnected ? "Participant's" : "Remote"} Screen`}
                        size="small"
                        sx={{
                          bgcolor: "rgba(0,0,0,0.8)",
                          color: "white",
                          fontSize: { xs: "0.7rem", md: "0.75rem" },
                          height: { xs: 20, md: 24 },
                          backdropFilter: "blur(10px)",
                        }}
                      />
                      {screenShareStatus && (
                        <Chip
                          label={screenShareStatus}
                          size="small"
                          icon={screenShareStatus === 'error' ? <Warning /> : <CircularProgress size={12} />}
                          sx={{
                            bgcolor: screenShareStatus === 'error' ? "rgba(220,38,38,0.9)" : "rgba(59,130,246,0.9)",
                            color: "white",
                            fontSize: "0.7rem",
                            height: 20,
                          }}
                        />
                      )}
                    </Box>

                    <video
                      ref={isScreenSharing ? localScreenRef : remoteScreenRef}
                      autoPlay
                      playsInline
                      muted={isScreenSharing}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "contain",
                        background: "#000",
                      }}
                    />

                    {/* Screen Share Controls */}
                    {isScreenSharing && (
                      <Box
                        sx={{
                          position: "absolute",
                          bottom: { xs: 8, md: 16 },
                          right: { xs: 8, md: 16 },
                          zIndex: 2,
                        }}
                      >
                        <IconButton
                          onClick={stopScreenShare}
                          disabled={screenShareStatus === 'stopping'}
                          sx={{
                            bgcolor: "#dc2626",
                            color: "white",
                            "&:hover": {
                              bgcolor: "#b91c1c",
                            },
                            "&:disabled": {
                              bgcolor: "#9ca3af",
                            },
                          }}
                        >
                          {screenShareStatus === 'stopping' ? (
                            <CircularProgress size={16} color="inherit" />
                          ) : (
                            <StopScreenShare sx={{ fontSize: { xs: 16, md: 20 } }} />
                          )}
                        </IconButton>
                      </Box>
                    )}
                  </Paper>

                  {/* Participants Row During Screen Share */}
                  <Box
                    sx={{
                      display: "flex",
                      gap: 2,
                      height: { xs: "120px", sm: "140px", md: "160px" },
                    }}
                  >
                    {/* Your Video - Smaller during screen share */}
                    <Paper
                      sx={{
                        flex: 1,
                        bgcolor: "white",
                        borderRadius: { xs: 1, md: 2 },
                        border: "1px solid #e5e7eb",
                        overflow: "hidden",
                        position: "relative",
                      }}
                    >
                      <Box
                        sx={{
                          position: "absolute",
                          top: 8,
                          left: 8,
                          zIndex: 2,
                        }}
                      >
                        <Chip
                          label="You"
                          size="small"
                          sx={{
                            bgcolor: "rgba(0,0,0,0.7)",
                            color: "white",
                            fontSize: "0.7rem",
                            height: 20,
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
                          height: "100%",
                          objectFit: "cover",
                          background: "#000",
                          transform: "scaleX(-1)",
                        }}
                      />
                    </Paper>

                    {/* Participant Video - Smaller during screen share */}
                    <Paper
                      sx={{
                        flex: 1,
                        bgcolor: "white",
                        borderRadius: { xs: 1, md: 2 },
                        border: "1px solid #e5e7eb",
                        overflow: "hidden",
                        position: "relative",
                      }}
                    >
                      <Box
                        sx={{
                          position: "absolute",
                          top: 8,
                          left: 8,
                          zIndex: 2,
                        }}
                      >
                        <Chip
                          label={isConnected ? "Participant" : "Waiting..."}
                          size="small"
                          sx={{
                            bgcolor: "rgba(0,0,0,0.7)",
                            color: "white",
                            fontSize: "0.7rem",
                            height: 20,
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
                          <CircularProgress sx={{ color: "white", mb: 1 }} size={24} />
                          <Typography variant="caption" sx={{ fontSize: "0.7rem" }}>
                            Waiting...
                          </Typography>
                        </Box>
                      )}
                    </Paper>
                  </Box>
                </Box>
              )}

              {/* MAIN PARTICIPANT VIDEO SECTION */}
              <Box
                sx={{
                  display: "flex",
                  flexDirection: { xs: "column", md: "row" },
                  gap: { xs: 1, md: 2 },
                  flex: 1,
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
                      label="You"
                      size="small"
                      sx={{
                        bgcolor: "rgba(0,0,0,0.7)",
                        color: "white",
                        fontSize: { xs: "0.7rem", md: "0.75rem" },
                        height: { xs: 20, md: 24 },
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
                      height: "100%",
                      objectFit: "cover",
                      background: "#000",
                      cursor: "pointer",
                      transform: "scaleX(-1)",
                    }}
                  />
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
                        bgcolor: isAudioMuted ? "#dc2626" : "rgba(255,255,255,0.9)",
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
                        bgcolor: isVideoMuted ? "#dc2626" : "rgba(255,255,255,0.9)",
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
                    {/* Enhanced Screen Share Button */}
                    <IconButton
                      onClick={isScreenSharing ? stopScreenShare : startScreenShare}
                      disabled={screenShareStatus === 'starting' || screenShareStatus === 'stopping'}
                      sx={{
                        width: { xs: 36, md: 44 },
                        height: { xs: 36, md: 44 },
                        bgcolor: isScreenSharing ? "#dc2626" : "rgba(255,255,255,0.9)",
                        color: isScreenSharing ? "white" : "#374151",
                        "&:hover": {
                          bgcolor: isScreenSharing ? "#b91c1c" : "white",
                        },
                        "&:disabled": {
                          bgcolor: "#9ca3af",
                          color: "white",
                        },
                      }}
                    >
                      {screenShareStatus === 'starting' || screenShareStatus === 'stopping' ? (
                        <CircularProgress size={16} color="inherit" />
                      ) : isScreenSharing ? (
                        <StopScreenShare sx={{ fontSize: { xs: 16, md: 20 } }} />
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
                      label={isConnected ? "Participant" : "Waiting..."}
                      size="small"
                      sx={{
                        bgcolor: "rgba(0,0,0,0.7)",
                        color: "white",
                        fontSize: { xs: "0.7rem", md: "0.75rem" },
                        height: { xs: 20, md: 24 },
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
                      <CircularProgress sx={{ color: "white", mb: 2 }} size={40} />
                      <Typography variant="body2" sx={{ fontSize: { xs: "0.8rem", md: "0.875rem" } }}>
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
                  <Typography variant="body2" color="#1e40af" sx={{ mb: 1, fontWeight: 500 }}>
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
            TransitionComponent={Slide}
            TransitionProps={{
              direction: "up",
            }}
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
          <ExitToApp sx={{ fontSize: { xs: 40, sm: 48 }, color: "#dc2626", mb: 2 }} />
          <Typography variant="h6" fontWeight="600" color="#1a1a1a" sx={{ fontSize: { xs: "1.1rem", sm: "1.25rem" } }}>
            Leave Meeting?
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ textAlign: "center", pb: 2 }}>
          <Typography variant="body1" color="#6b7280" sx={{ fontSize: { xs: "0.9rem", sm: "1rem" } }}>
            Are you sure you want to leave this meeting? This action cannot be undone.
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

      {/* Enhanced Notification Snackbar */}
      <Snackbar
        open={notification.open}
        autoHideDuration={4000}
        onClose={() => setNotification({ ...notification, open: false })}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setNotification({ ...notification, open: false })}
          severity={notification.severity}
          variant="filled"
          sx={{
            borderRadius: 2,
            fontWeight: 500,
          }}
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}

export default MeetingRoom
