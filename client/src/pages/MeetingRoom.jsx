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
  Snackbar,
  Alert,
  Card,
  CardContent,
  Tooltip,
  Fade,
  Slide,
  Grow,
  Badge,
  Avatar,
  Divider,
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
  Fullscreen,
  FullscreenExit,
  Settings,
  MoreVert,
  ContentCopy,
  VolumeUp,
  VolumeOff,
} from "@mui/icons-material"

const backendUrl = "https://live-meet-site.onrender.com"

const MeetingRoom = () => {
  const { roomId } = useParams()
  const { user, isLoaded } = useUser()
  const navigate = useNavigate()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down("md"))
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
  const [unreadMessages, setUnreadMessages] = useState(0)

  // Screen sharing states
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [remoteScreenSharing, setRemoteScreenSharing] = useState(false)
  const [screenShareStatus, setScreenShareStatus] = useState(null)

  // UI states
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const [controlsTimeout, setControlsTimeout] = useState(null)
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'info' })

  // Notification helper
  const showNotification = useCallback((message, severity = 'info') => {
    setNotification({ open: true, message, severity })
  }, [])

  // Auto-hide controls
  const resetControlsTimeout = useCallback(() => {
    if (controlsTimeout) clearTimeout(controlsTimeout)
    setShowControls(true)
    if (isStarted) {
      const timeout = setTimeout(() => setShowControls(false), 3000)
      setControlsTimeout(timeout)
    }
  }, [controlsTimeout, isStarted])

  // Get video sender
  const getVideoSender = useCallback(() => {
    if (!peerConnection.current) return null
    const senders = peerConnection.current.getSenders()
    return senders.find(sender => sender.track && sender.track.kind === 'video')
  }, [])

  // Replace video track
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

  // Create and send offer
  const createAndSendOffer = useCallback(async () => {
    if (!peerConnection.current || !remoteSocketId.current) return false

    try {
      const offer = await peerConnection.current.createOffer()
      await peerConnection.current.setLocalDescription(offer)
      socketRef.current.emit("offer", { offer, target: remoteSocketId.current }, roomId)
      return true
    } catch (error) {
      console.error('Failed to create and send offer:', error)
      return false
    }
  }, [roomId])

  // Start screen sharing
  const startScreenShare = useCallback(async () => {
    if (isScreenSharing) return
    
    setScreenShareStatus('starting')
    
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 },
        },
        audio: true,
      })

      const screenVideoTrack = screenStream.getVideoTracks()[0]
      if (!screenVideoTrack) throw new Error('No video track in screen share stream')

      screenStreamRef.current = screenStream
      
      if (peerConnection.current && isConnected) {
        const replaced = await replaceVideoTrack(screenVideoTrack)
        if (!replaced) {
          peerConnection.current.addTrack(screenVideoTrack, screenStream)
        }
        
        if (remoteSocketId.current) {
          await createAndSendOffer()
        }
      }

      if (localScreenRef.current) {
        localScreenRef.current.srcObject = screenStream
        localScreenRef.current.play().catch(console.error)
      }

      setIsScreenSharing(true)
      setScreenShareStatus(null)
      
      socketRef.current.emit("screen-share-started", roomId)
      showNotification('Screen sharing started', 'success')

      screenVideoTrack.onended = () => {
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

  // Stop screen sharing
  const stopScreenShare = useCallback(async () => {
    if (!isScreenSharing) return
    
    setScreenShareStatus('stopping')
    
    try {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => track.stop())
        screenStreamRef.current = null
      }

      if (peerConnection.current && isConnected) {
        const cameraVideoTrack = streamRef.current?.getVideoTracks()[0]
        
        if (cameraVideoTrack) {
          const replaced = await replaceVideoTrack(cameraVideoTrack)
          if (!replaced) {
            console.warn('Failed to replace track, camera may not be restored properly')
          }
        } else {
          await replaceVideoTrack(null)
        }

        if (remoteSocketId.current) {
          await createAndSendOffer()
        }
      }

      if (localScreenRef.current) {
        localScreenRef.current.srcObject = null
      }

      setIsScreenSharing(false)
      setScreenShareStatus(null)
      
      socketRef.current.emit("screen-share-stopped", roomId)
      showNotification('Screen sharing stopped', 'info')

    } catch (error) {
      console.error('Failed to stop screen sharing:', error)
      setScreenShareStatus('error')
      showNotification('Error stopping screen share', 'error')
      setTimeout(() => setScreenShareStatus(null), 3000)
    }
  }, [isScreenSharing, isConnected, replaceVideoTrack, createAndSendOffer, roomId, showNotification])

  // Auto scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [chat])

  // Initialize socket
  useEffect(() => {
    if (!isLoaded) return

    socketRef.current = io(backendUrl, { transports: ["websocket"] })

    socketRef.current.on("chat-message", (data) => {
      setChat((prev) => [...prev, { 
        username: data.username, 
        message: data.message, 
        timestamp: new Date(),
        id: data.id
      }])
      
      if (!isChatOpen && data.id !== socketRef.current.id) {
        setUnreadMessages(prev => prev + 1)
      }
    })

    socketRef.current.on("screen-share-started", () => {
      setRemoteScreenSharing(true)
      showNotification('Participant started screen sharing', 'info')
    })

    socketRef.current.on("screen-share-stopped", () => {
      setRemoteScreenSharing(false)
      if (remoteScreenRef.current) {
        remoteScreenRef.current.srcObject = null
      }
      showNotification('Participant stopped screen sharing', 'info')
    })

    return () => {
      peerConnection.current?.close()
      streamRef.current?.getTracks?.().forEach((track) => track.stop())
      screenStreamRef.current?.getTracks?.().forEach((track) => track.stop())
      socketRef.current?.disconnect()
    }
  }, [isLoaded, roomId, isChatOpen])

  // Setup signaling
  useEffect(() => {
    if (!isStarted || !isLoaded || !socketRef.current) return

    const socket = socketRef.current

    socket.emit("join-meeting", roomId)
    socket.emit("join", roomId)

    socket.on("user-joined", async ({ socketId }) => {
      remoteSocketId.current = socketId
      
      if (!peerConnection.current && streamRef.current) {
        peerConnection.current = createPeerConnection(socket, socketId)
        
        streamRef.current.getTracks().forEach((track) => {
          peerConnection.current.addTrack(track, streamRef.current)
        })

        if (isScreenSharing && screenStreamRef.current) {
          const screenVideoTrack = screenStreamRef.current.getVideoTracks()[0]
          if (screenVideoTrack) {
            const replaced = await replaceVideoTrack(screenVideoTrack)
            if (!replaced) {
              peerConnection.current.addTrack(screenVideoTrack, screenStreamRef.current)
            }
          }
        }

        await createAndSendOffer()
      }
    })

    socket.on("offer", async ({ offer, from }) => {
      remoteSocketId.current = from
      
      if (!peerConnection.current && streamRef.current) {
        peerConnection.current = createPeerConnection(socket, from)
        
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
      setIsConnected(false)
      setRemoteScreenSharing(false)
      remoteSocketId.current = null
      
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null
      if (remoteScreenRef.current) remoteScreenRef.current.srcObject = null
      
      peerConnection.current?.close()
      peerConnection.current = null
    })

    return () => {
      socket.off("user-joined")
      socket.off("offer")
      socket.off("answer")
      socket.off("ice-candidate")
      socket.off("user-left")
      peerConnection.current?.close()
      peerConnection.current = null
    }
  }, [isStarted, isLoaded, roomId, createAndSendOffer, isScreenSharing, replaceVideoTrack])

  // Create peer connection
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
      
      if (stream) {
        const isScreenStream = 
          stream.id.includes("screen") ||
          event.track.label.includes("screen") ||
          event.track.getSettings().displaySurface ||
          event.track.label.includes("monitor") ||
          event.track.label.includes("window") ||
          event.track.label.includes("tab")

        if (isScreenStream) {
          if (remoteScreenRef.current) {
            remoteScreenRef.current.srcObject = stream
            remoteScreenRef.current.play().catch(console.error)
          }
          setRemoteScreenSharing(true)
        } else {
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = stream
            remoteVideoRef.current.play().catch(console.error)
          }
          if (remoteScreenSharing && !isScreenStream) {
            setRemoteScreenSharing(false)
          }
        }
        setIsConnected(true)
      }
    }

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState
      
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

  // Start meeting
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

  // Leave meeting
  const leaveMeeting = useCallback(() => {
    if (isScreenSharing) {
      stopScreenShare()
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop())
    }

    if (peerConnection.current) {
      peerConnection.current.close()
    }

    if (socketRef.current) {
      socketRef.current.emit("leave-room", roomId)
      socketRef.current.disconnect()
    }

    navigate("/")
  }, [isScreenSharing, stopScreenShare, navigate, roomId])

  // Assign local stream to video
  useEffect(() => {
    if (isStarted && userVideoRef.current && streamRef.current) {
      userVideoRef.current.srcObject = streamRef.current
      userVideoRef.current.play().catch(() => {})
    }
  }, [isStarted])

  // Toggle audio
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

  // Toggle video
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

  // Copy room link
  const copyRoomLink = useCallback(() => {
    navigator.clipboard.writeText(window.location.href)
    showNotification('Room link copied to clipboard!', 'success')
  }, [showNotification])

  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }, [])

  // Open chat
  const openChat = useCallback(() => {
    setIsChatOpen(true)
    setUnreadMessages(0)
  }, [])

  // Mouse move handler
  useEffect(() => {
    const handleMouseMove = () => resetControlsTimeout()
    
    if (isStarted) {
      document.addEventListener('mousemove', handleMouseMove)
      resetControlsTimeout()
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      if (controlsTimeout) clearTimeout(controlsTimeout)
    }
  }, [isStarted, resetControlsTimeout, controlsTimeout])

  // Enhanced Chat Component
  const ChatComponent = () => (
    <Slide direction="left" in={isChatOpen} mountOnEnter unmountOnExit>
      <Paper
        sx={{
          position: 'fixed',
          right: 0,
          top: 0,
          height: '100vh',
          width: { xs: '100vw', md: 400 },
          zIndex: 1300,
          display: 'flex',
          flexDirection: 'column',
          borderRadius: { xs: 0, md: '24px 0 0 24px' },
          background: 'linear-gradient(145deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.95) 100%)',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 25px 50px rgba(0,0,0,0.15)',
          border: '1px solid rgba(255,255,255,0.2)',
        }}
      >
        {/* Chat Header */}
        <Box
          sx={{
            p: 3,
            borderBottom: '1px solid rgba(0,0,0,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            borderRadius: { xs: 0, md: '24px 0 0 0' },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', width: 32, height: 32 }}>
              <Chat sx={{ fontSize: 18 }} />
            </Avatar>
            <Typography variant="h6" fontWeight="bold">
              Chat
            </Typography>
          </Box>
          <IconButton 
            onClick={() => setIsChatOpen(false)} 
            sx={{ 
              color: 'white',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' }
            }}
          >
            <Close />
          </IconButton>
        </Box>

        {/* Messages */}
        <Box
          sx={{
            flex: 1,
            overflowY: 'auto',
            p: 2,
            '&::-webkit-scrollbar': { width: '6px' },
            '&::-webkit-scrollbar-track': { background: 'transparent' },
            '&::-webkit-scrollbar-thumb': {
              background: 'rgba(0,0,0,0.2)',
              borderRadius: '3px',
            },
          }}
        >
          {chat.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
              <Chat sx={{ fontSize: 64, opacity: 0.2, mb: 2 }} />
              <Typography variant="h6" fontWeight="500" mb={1}>No messages yet</Typography>
              <Typography variant="body2">Start the conversation!</Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {chat.map((msg, idx) => {
                const isOwnMessage = msg.username === (user?.username || user?.firstName || "Anonymous")
                return (
                  <Grow key={idx} in timeout={300} style={{ transitionDelay: `${idx * 50}ms` }}>
                    <Box
                      sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: isOwnMessage ? 'flex-end' : 'flex-start',
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{ 
                          color: 'text.secondary', 
                          mb: 0.5, 
                          px: 1,
                          fontWeight: 500
                        }}
                      >
                        {msg.username}
                      </Typography>
                      <Paper
                        elevation={0}
                        sx={{
                          p: 2,
                          maxWidth: '80%',
                          borderRadius: 3,
                          background: isOwnMessage
                            ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                            : 'rgba(0,0,0,0.04)',
                          color: isOwnMessage ? 'white' : 'text.primary',
                          borderBottomRightRadius: isOwnMessage ? 0.5 : 3,
                          borderBottomLeftRadius: isOwnMessage ? 3 : 0.5,
                          boxShadow: isOwnMessage 
                            ? '0 4px 12px rgba(102, 126, 234, 0.3)'
                            : '0 2px 8px rgba(0,0,0,0.05)',
                        }}
                      >
                        <Typography variant="body2" sx={{ lineHeight: 1.5 }}>
                          {msg.message}
                        </Typography>
                      </Paper>
                    </Box>
                  </Grow>
                )
              })}
              <div ref={chatEndRef} />
            </Box>
          )}
        </Box>

        {/* Message Input */}
        <Box
          sx={{
            p: 3,
            borderTop: '1px solid rgba(0,0,0,0.08)',
            display: 'flex',
            gap: 2,
            background: 'rgba(255,255,255,0.8)',
          }}
        >
          <TextField
            fullWidth
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type a message..."
            variant="outlined"
            size="small"
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 4,
                background: 'white',
                border: '1px solid rgba(0,0,0,0.1)',
                '&:hover': {
                  border: '1px solid rgba(102, 126, 234, 0.3)',
                },
                '&.Mui-focused': {
                  border: '1px solid #667eea',
                  boxShadow: '0 0 0 3px rgba(102, 126, 234, 0.1)',
                },
                '& fieldset': { border: 'none' },
              },
            }}
          />
          <IconButton
            onClick={handleSend}
            disabled={!message.trim()}
            sx={{
              background: message.trim() 
                ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                : 'rgba(0,0,0,0.1)',
              color: message.trim() ? 'white' : 'rgba(0,0,0,0.3)',
              width: 48,
              height: 48,
              '&:hover': {
                background: message.trim()
                  ? 'linear-gradient(135deg, #5a67d8 0%, #6b46c1 100%)'
                  : 'rgba(0,0,0,0.15)',
                transform: message.trim() ? 'scale(1.05)' : 'none',
              },
              transition: 'all 0.2s ease',
            }}
          >
            <Send />
          </IconButton>
        </Box>
      </Paper>
    </Slide>
  )

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
    >
      {!isStarted ? (
        // Pre-call screen
        <Container maxWidth="sm" sx={{ flex: 1, display: 'flex', alignItems: 'center', py: 4 }}>
          {/* User Button */}
          <Box
            sx={{
              position: 'absolute',
              top: 24,
              right: 24,
              zIndex: 10,
            }}
          >
            <UserButton
              appearance={{
                elements: {
                  avatarBox: {
                    width: '48px',
                    height: '48px',
                    borderRadius: '16px',
                    border: '2px solid rgba(255,255,255,0.2)',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                  },
                },
              }}
            />
          </Box>

          <Fade in timeout={800}>
            <Card
              sx={{
                width: '100%',
                borderRadius: 6,
                boxShadow: '0 25px 50px rgba(0,0,0,0.15)',
                overflow: 'hidden',
                background: 'rgba(255,255,255,0.95)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,0.2)',
              }}
            >
              <CardContent sx={{ p: 6, textAlign: 'center' }}>
                <Zoom in timeout={1000} style={{ transitionDelay: '200ms' }}>
                  <Box
                    sx={{
                      width: 140,
                      height: 140,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mx: 'auto',
                      mb: 4,
                      boxShadow: '0 20px 40px rgba(102, 126, 234, 0.3)',
                      position: 'relative',
                      '&::before': {
                        content: '""',
                        position: 'absolute',
                        inset: -4,
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        opacity: 0.3,
                        animation: 'pulse 2s infinite',
                      },
                      '@keyframes pulse': {
                        '0%, 100%': { transform: 'scale(1)', opacity: 0.3 },
                        '50%': { transform: 'scale(1.1)', opacity: 0.1 },
                      },
                    }}
                  >
                    <VideoCall sx={{ fontSize: 70, color: 'white' }} />
                  </Box>
                </Zoom>

                <Slide direction="up" in timeout={800} style={{ transitionDelay: '400ms' }}>
                  <Box mb={4}>
                    <Typography variant="h3" fontWeight="bold" color="text.primary" mb={2}>
                      Join Video Call
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                      <Typography variant="h6" color="text.secondary">
                        Room:
                      </Typography>
                      <Chip 
                        label={roomId} 
                        variant="outlined" 
                        sx={{ 
                          fontWeight: 'bold',
                          fontSize: '1rem',
                          height: 36,
                          borderRadius: 3,
                          border: '2px solid #667eea',
                          color: '#667eea',
                        }} 
                      />
                    </Box>
                  </Box>
                </Slide>

                {error && (
                  <Grow in timeout={500}>
                    <Alert 
                      severity="error" 
                      sx={{ 
                        mb: 4, 
                        borderRadius: 3,
                        '& .MuiAlert-icon': { fontSize: '1.5rem' },
                        boxShadow: '0 4px 12px rgba(220, 38, 38, 0.15)',
                      }}
                    >
                      {error}
                    </Alert>
                  </Grow>
                )}

                <Zoom in timeout={800} style={{ transitionDelay: '600ms' }}>
                  <Button
                    onClick={startMeeting}
                    disabled={isLoading}
                    variant="contained"
                    size="large"
                    startIcon={isLoading ? <CircularProgress size={24} color="inherit" /> : <PlayArrow />}
                    sx={{
                      py: 3,
                      px: 8,
                      borderRadius: 5,
                      fontSize: '1.3rem',
                      fontWeight: 'bold',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      boxShadow: '0 15px 30px rgba(102, 126, 234, 0.3)',
                      mb: 4,
                      '&:hover': {
                        transform: 'translateY(-3px)',
                        boxShadow: '0 20px 40px rgba(102, 126, 234, 0.4)',
                      },
                      '&:active': {
                        transform: 'translateY(-1px)',
                      },
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                  >
                    {isLoading ? 'Starting...' : 'Start Call'}
                  </Button>
                </Zoom>

                <Slide direction="up" in timeout={800} style={{ transitionDelay: '800ms' }}>
                  <Paper
                    sx={{
                      p: 4,
                      bgcolor: 'rgba(248,250,252,0.8)',
                      borderRadius: 4,
                      border: '1px solid rgba(0,0,0,0.05)',
                    }}
                  >
                    <Typography variant="body1" color="text.secondary" mb={3} fontWeight="500">
                      Share this link to invite others:
                    </Typography>
                    <Box
                      sx={{
                        p: 3,
                        bgcolor: 'white',
                        borderRadius: 3,
                        border: '1px solid rgba(0,0,0,0.1)',
                        fontFamily: 'monospace',
                        fontSize: '0.95rem',
                        wordBreak: 'break-all',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2,
                      }}
                    >
                      <Typography sx={{ flex: 1 }}>{window.location.href}</Typography>
                      <Tooltip title="Copy link">
                        <IconButton 
                          onClick={copyRoomLink} 
                          sx={{
                            bgcolor: 'rgba(102, 126, 234, 0.1)',
                            '&:hover': {
                              bgcolor: '#667eea',
                              color: 'white',
                              transform: 'scale(1.1)',
                            },
                            transition: 'all 0.2s ease',
                          }}
                        >
                          <ContentCopy />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Paper>
                </Slide>
              </CardContent>
            </Card>
          </Fade>
        </Container>
      ) : (
        // In-call screen
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
          {/* Header */}
          <Slide direction="down" in timeout={500}>
            <Paper
              sx={{
                m: 2,
                p: 3,
                borderRadius: 5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'rgba(255,255,255,0.95)',
                backdropFilter: 'blur(20px)',
                boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <Avatar
                  sx={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    width: 48,
                    height: 48,
                  }}
                >
                  <VideoCall sx={{ fontSize: 24 }} />
                </Avatar>
                <Box>
                  <Typography variant="h5" fontWeight="bold">
                    Video Call
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Room: {roomId}
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Chip
                  icon={
                    isConnected ? (
                      <Circle sx={{ fontSize: 12, color: '#10b981' }} />
                    ) : (
                      <CircularProgress size={12} />
                    )
                  }
                  label={isConnected ? 'Connected' : 'Connecting...'}
                  color={isConnected ? 'success' : 'warning'}
                  variant="outlined"
                  sx={{ borderRadius: 3, fontWeight: 500 }}
                />

                <Tooltip title="Share room link">
                  <IconButton 
                    onClick={copyRoomLink} 
                    sx={{ 
                      borderRadius: 3,
                      '&:hover': { bgcolor: 'rgba(102, 126, 234, 0.1)' }
                    }}
                  >
                    <ContentCopy />
                  </IconButton>
                </Tooltip>

                <Tooltip title="Toggle fullscreen">
                  <IconButton 
                    onClick={toggleFullscreen} 
                    sx={{ 
                      borderRadius: 3,
                      '&:hover': { bgcolor: 'rgba(102, 126, 234, 0.1)' }
                    }}
                  >
                    {isFullscreen ? <FullscreenExit /> : <Fullscreen />}
                  </IconButton>
                </Tooltip>

                <Button
                  onClick={() => setShowLeaveDialog(true)}
                  variant="contained"
                  color="error"
                  startIcon={<CallEnd />}
                  sx={{ 
                    borderRadius: 4,
                    px: 3,
                    py: 1.5,
                    fontWeight: 'bold',
                  }}
                >
                  Leave
                </Button>

                <UserButton
                  appearance={{
                    elements: {
                      avatarBox: {
                        width: '40px',
                        height: '40px',
                        borderRadius: '12px',
                        border: '2px solid rgba(0,0,0,0.1)',
                      },
                    },
                  }}
                />
              </Box>
            </Paper>
          </Slide>

          {/* Video Area */}
          <Box sx={{ flex: 1, p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Screen Share Display */}
            {(isScreenSharing || remoteScreenSharing) && (
              <Grow in timeout={500}>
                <Paper
                  sx={{
                    height: '60vh',
                    borderRadius: 5,
                    overflow: 'hidden',
                    position: 'relative',
                    bgcolor: 'black',
                    boxShadow: '0 15px 35px rgba(0,0,0,0.2)',
                  }}
                >
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 20,
                      left: 20,
                      zIndex: 2,
                      bgcolor: 'rgba(0,0,0,0.8)',
                      color: 'white',
                      px: 3,
                      py: 1.5,
                      borderRadius: 4,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      backdropFilter: 'blur(10px)',
                    }}
                  >
                    <PresentToAll sx={{ fontSize: 20 }} />
                    <Typography variant="body1" fontWeight="bold">
                      {isScreenSharing ? 'Your Screen' : 'Remote Screen'}
                    </Typography>
                  </Box>

                  <video
                    ref={isScreenSharing ? localScreenRef : remoteScreenRef}
                    autoPlay
                    playsInline
                    muted={isScreenSharing}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                    }}
                  />

                  {isScreenSharing && (
                    <Fade in={showControls} timeout={300}>
                      <Box
                        sx={{
                          position: 'absolute',
                          bottom: 20,
                          right: 20,
                          zIndex: 2,
                        }}
                      >
                        <IconButton
                          onClick={stopScreenShare}
                          disabled={screenShareStatus === 'stopping'}
                          sx={{
                            bgcolor: '#dc2626',
                            color: 'white',
                            width: 56,
                            height: 56,
                            '&:hover': {
                              bgcolor: '#b91c1c',
                              transform: 'scale(1.1)',
                            },
                            transition: 'all 0.2s ease',
                          }}
                        >
                          {screenShareStatus === 'stopping' ? (
                            <CircularProgress size={24} color="inherit" />
                          ) : (
                            <StopScreenShare sx={{ fontSize: 24 }} />
                          )}
                        </IconButton>
                      </Box>
                    </Fade>
                  )}
                </Paper>
              </Grow>
            )}

            {/* Participant Videos */}
            <Box
              sx={{
                height: isScreenSharing || remoteScreenSharing ? '35vh' : '70vh',
                display: 'flex',
                gap: 2,
              }}
            >
              {/* Local Video */}
              <Grow in timeout={500}>
                <Paper
                  sx={{
                    flex: 1,
                    borderRadius: 5,
                    overflow: 'hidden',
                    position: 'relative',
                    bgcolor: 'black',
                    boxShadow: '0 15px 35px rgba(0,0,0,0.2)',
                  }}
                >
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 20,
                      left: 20,
                      zIndex: 2,
                      bgcolor: 'rgba(0,0,0,0.8)',
                      color: 'white',
                      px: 3,
                      py: 1.5,
                      borderRadius: 4,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      backdropFilter: 'blur(10px)',
                    }}
                  >
                    <Avatar sx={{ width: 20, height: 20, bgcolor: '#667eea' }}>
                      <Typography variant="caption" fontWeight="bold">
                        {user?.firstName?.[0] || 'Y'}
                      </Typography>
                    </Avatar>
                    <Typography variant="body1" fontWeight="bold">You</Typography>
                  </Box>

                  <video
                    ref={userVideoRef}
                    autoPlay
                    playsInline
                    muted
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      transform: 'scaleX(-1)',
                    }}
                  />

                  {/* Enhanced Controls */}
                  <Fade in={showControls} timeout={300}>
                    <Box
                      sx={{
                        position: 'absolute',
                        bottom: 20,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        display: 'flex',
                        gap: 2,
                        background: 'rgba(0,0,0,0.8)',
                        borderRadius: 5,
                        p: 2,
                        backdropFilter: 'blur(10px)',
                      }}
                    >
                      <Tooltip title={isAudioMuted ? 'Unmute' : 'Mute'}>
                        <IconButton
                          onClick={toggleAudio}
                          sx={{
                            bgcolor: isAudioMuted ? '#dc2626' : 'rgba(255,255,255,0.2)',
                            color: 'white',
                            width: 48,
                            height: 48,
                            '&:hover': {
                              bgcolor: isAudioMuted ? '#b91c1c' : 'rgba(255,255,255,0.3)',
                              transform: 'scale(1.1)',
                            },
                            transition: 'all 0.2s ease',
                          }}
                        >
                          {isAudioMuted ? <MicOff /> : <Mic />}
                        </IconButton>
                      </Tooltip>

                      <Tooltip title={isVideoMuted ? 'Turn on camera' : 'Turn off camera'}>
                        <IconButton
                          onClick={toggleVideo}
                          sx={{
                            bgcolor: isVideoMuted ? '#dc2626' : 'rgba(255,255,255,0.2)',
                            color: 'white',
                            width: 48,
                            height: 48,
                            '&:hover': {
                              bgcolor: isVideoMuted ? '#b91c1c' : 'rgba(255,255,255,0.3)',
                              transform: 'scale(1.1)',
                            },
                            transition: 'all 0.2s ease',
                          }}
                        >
                          {isVideoMuted ? <VideocamOff /> : <Videocam />}
                        </IconButton>
                      </Tooltip>

                      <Tooltip title={isScreenSharing ? 'Stop sharing' : 'Share screen'}>
                        <IconButton
                          onClick={isScreenSharing ? stopScreenShare : startScreenShare}
                          disabled={screenShareStatus === 'starting' || screenShareStatus === 'stopping'}
                          sx={{
                            bgcolor: isScreenSharing ? '#dc2626' : 'rgba(255,255,255,0.2)',
                            color: 'white',
                            width: 48,
                            height: 48,
                            '&:hover': {
                              bgcolor: isScreenSharing ? '#b91c1c' : 'rgba(255,255,255,0.3)',
                              transform: 'scale(1.1)',
                            },
                            '&:disabled': {
                              bgcolor: 'rgba(255,255,255,0.1)',
                              color: 'rgba(255,255,255,0.5)',
                            },
                            transition: 'all 0.2s ease',
                          }}
                        >
                          {screenShareStatus === 'starting' || screenShareStatus === 'stopping' ? (
                            <CircularProgress size={20} color="inherit" />
                          ) : isScreenSharing ? (
                            <StopScreenShare />
                          ) : (
                            <ScreenShare />
                          )}
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Fade>
                </Paper>
              </Grow>

              {/* Remote Video */}
              <Grow in timeout={500} style={{ transitionDelay: '200ms' }}>
                <Paper
                  sx={{
                    flex: 1,
                    borderRadius: 5,
                    overflow: 'hidden',
                    position: 'relative',
                    bgcolor: 'black',
                    boxShadow: '0 15px 35px rgba(0,0,0,0.2)',
                  }}
                >
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 20,
                      left: 20,
                      zIndex: 2,
                      bgcolor: 'rgba(0,0,0,0.8)',
                      color: 'white',
                      px: 3,
                      py: 1.5,
                      borderRadius: 4,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      backdropFilter: 'blur(10px)',
                    }}
                  >
                    <Avatar sx={{ width: 20, height: 20, bgcolor: isConnected ? '#10b981' : '#f59e0b' }}>
                      <Typography variant="caption" fontWeight="bold">
                        {isConnected ? 'P' : '?'}
                      </Typography>
                    </Avatar>
                    <Typography variant="body1" fontWeight="bold">
                      {isConnected ? 'Participant' : 'Waiting...'}
                    </Typography>
                  </Box>

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
                    <Fade in timeout={500}>
                      <Box
                        sx={{
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          transform: 'translate(-50%, -50%)',
                          textAlign: 'center',
                          color: 'white',
                        }}
                      >
                        <Box
                          sx={{
                            width: 80,
                            height: 80,
                            borderRadius: '50%',
                            border: '3px solid rgba(255,255,255,0.3)',
                            borderTop: '3px solid white',
                            animation: 'spin 1s linear infinite',
                            mx: 'auto',
                            mb: 3,
                            '@keyframes spin': {
                              '0%': { transform: 'rotate(0deg)' },
                              '100%': { transform: 'rotate(360deg)' },
                            },
                          }}
                        />
                        <Typography variant="h6" fontWeight="bold" mb={1}>
                          Waiting for participant...
                        </Typography>
                        <Typography variant="body2" sx={{ opacity: 0.8 }}>
                          Share the room link to invite others
                        </Typography>
                      </Box>
                    </Fade>
                  )}
                </Paper>
              </Grow>
            </Box>
          </Box>

          {/* Floating Chat Button */}
          <Zoom in timeout={500} style={{ transitionDelay: '1000ms' }}>
            <Badge
              badgeContent={unreadMessages}
              color="error"
              sx={{
                position: 'fixed',
                bottom: 32,
                right: 32,
                zIndex: 1000,
              }}
            >
              <IconButton
                onClick={openChat}
                sx={{
                  width: 72,
                  height: 72,
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  boxShadow: '0 15px 30px rgba(102, 126, 234, 0.3)',
                  '&:hover': {
                    transform: 'scale(1.1)',
                    boxShadow: '0 20px 40px rgba(102, 126, 234, 0.4)',
                  },
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              >
                <Chat sx={{ fontSize: 32 }} />
              </IconButton>
            </Badge>
          </Zoom>
        </Box>
      )}

      {/* Chat Component */}
      <ChatComponent />

      {/* Leave Dialog */}
      <Dialog
        open={showLeaveDialog}
        onClose={() => setShowLeaveDialog(false)}
        PaperProps={{
          sx: {
            borderRadius: 5,
            p: 3,
            background: 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(20px)',
            minWidth: 400,
          },
        }}
      >
        <DialogTitle sx={{ textAlign: 'center', pb: 2 }}>
          <Zoom in timeout={300}>
            <Box
              sx={{
                width: 100,
                height: 100,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mx: 'auto',
                mb: 3,
                boxShadow: '0 15px 30px rgba(239, 68, 68, 0.3)',
              }}
            >
              <ExitToApp sx={{ fontSize: 50, color: 'white' }} />
            </Box>
          </Zoom>
          <Typography variant="h4" fontWeight="bold">
            Leave Call?
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ textAlign: 'center', pb: 3 }}>
          <Typography variant="body1" color="text.secondary" fontSize="1.1rem">
            Are you sure you want to leave this call? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', gap: 3, p: 0 }}>
          <Button
            onClick={() => setShowLeaveDialog(false)}
            variant="outlined"
            sx={{ 
              borderRadius: 4,
              px: 4,
              py: 2,
              fontSize: '1rem',
              fontWeight: 'bold',
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={leaveMeeting}
            variant="contained"
            color="error"
            sx={{ 
              borderRadius: 4,
              px: 4,
              py: 2,
              fontSize: '1rem',
              fontWeight: 'bold',
            }}
          >
            Leave Call
          </Button>
        </DialogActions>
      </Dialog>

      {/* Notifications */}
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
            borderRadius: 4,
            boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
            fontSize: '1rem',
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
