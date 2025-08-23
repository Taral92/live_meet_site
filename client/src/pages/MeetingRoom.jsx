"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { io } from "socket.io-client"
import { useUser } from "@clerk/clerk-react"
import { UserButton } from "@clerk/clerk-react"
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
  Subtitles,
  Translate,
  ExpandMore,
} from "@mui/icons-material"

const backendUrl = "http://localhost:3000"

const SUPPORTED_LANGUAGES = [
  { code: "en", name: "English" },
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "it", name: "Italian" },
  { code: "pt", name: "Portuguese" },
  { code: "ru", name: "Russian" },
  { code: "ja", name: "Japanese" },
  { code: "ko", name: "Korean" },
  { code: "zh", name: "Chinese" },
  { code: "ar", name: "Arabic" },
  { code: "hi", name: "Hindi" },
]

const VideoPlayer = ({ stream, isMuted = false, isFlipped = false, label = "", className = "" }) => (
  <div
    className={`relative w-full h-full bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl overflow-hidden shadow-2xl border border-gray-700/50 transition-all duration-300 ${className}`}
  >
    <video
      ref={(el) => {
        if (el && stream) {
          el.srcObject = stream
          el.play().catch(console.error)
        }
      }}
      autoPlay
      playsInline
      muted={isMuted}
      className={`w-full h-full object-cover transition-transform duration-300 ${isFlipped ? "scale-x-[-1]" : ""}`}
      style={{ transform: isFlipped ? "scaleX(-1)" : "none" }}
    />
    {label && (
      <div className="absolute top-4 left-4 px-3 py-2 bg-black/80 backdrop-blur-md text-white text-sm rounded-xl border border-cyan-500/30 shadow-lg transition-all duration-300">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-cyan-400 rounded-full shadow-lg shadow-cyan-400/50"></div>
          <span className="font-medium">{label}</span>
        </div>
      </div>
    )}
    {!stream && (
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6">
        <div className="w-16 h-16 bg-gradient-to-r from-gray-700/50 to-gray-600/50 rounded-full flex items-center justify-center mb-4 shadow-lg">
          <VideoCall className="w-8 h-8 text-gray-400" />
        </div>
        <p className="text-gray-400 font-medium mb-2">Camera Off</p>
        <p className="text-gray-500 text-sm">Video is currently disabled</p>
      </div>
    )}
  </div>
)

const SubtitleDisplay = ({ subtitles, isVisible }) => {
  if (!isVisible || !subtitles.length) return null

  return (
    <div className="fixed bottom-20 md:bottom-28 left-4 right-4 z-30 flex justify-center pointer-events-none">
      <div className="max-w-4xl w-full">
        <div className="bg-black/80 backdrop-blur-xl rounded-xl px-4 py-3 border border-gray-700/50 shadow-2xl">
          <div className="space-y-1 max-h-20 overflow-hidden">
            {subtitles.slice(-3).map((subtitle, index) => (
              <div key={subtitle.id} className="flex items-start gap-3">
                <div className="flex items-center gap-2 min-w-0 flex-shrink-0">
                  <div className="w-2 h-2 bg-cyan-400 rounded-full shadow-lg shadow-cyan-400/50"></div>
                  <span className="text-cyan-400 text-sm font-medium truncate">{subtitle.speaker}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm leading-relaxed break-words">{subtitle.text}</p>
                  {subtitle.confidence && subtitle.confidence < 0.6 && (
                    <div className="flex items-center gap-1 mt-1">
                      <div className="w-1 h-1 bg-yellow-400 rounded-full"></div>
                      <span className="text-yellow-400 text-xs">Low confidence</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

const LanguageDropdown = ({ selectedLanguage, onLanguageChange, isOpen, onToggle }) => {
  const dropdownRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        onToggle(false)
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isOpen, onToggle])

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => onToggle(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-gray-700/50 hover:bg-gray-600/50 border border-gray-600/30 rounded-lg text-white text-sm transition-colors duration-200"
      >
        <Translate className="w-4 h-4" />
        <span>{SUPPORTED_LANGUAGES.find((lang) => lang.code === selectedLanguage)?.name || "English"}</span>
        <ExpandMore className={`w-4 h-4 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute bottom-full mb-2 left-0 w-48 bg-gray-800/95 backdrop-blur-xl border border-gray-700/50 rounded-xl shadow-2xl max-h-64 overflow-y-auto z-50">
          <div className="p-2">
            {SUPPORTED_LANGUAGES.map((language) => (
              <button
                key={language.code}
                onClick={() => {
                  onLanguageChange(language.code)
                  onToggle(false)
                }}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors duration-200 ${
                  selectedLanguage === language.code
                    ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                    : "text-gray-300 hover:bg-gray-700/50"
                }`}
              >
                {language.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const ChatComponent = ({ chat, user, message, setMessage, handleSend, socketConnected, onClose }) => {
  const chatEndRef = useRef(null)

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [chat])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xl">
      {/* Chat overlay container */}
      <div className="w-full h-full max-w-4xl mx-auto flex flex-col bg-gray-900/95 backdrop-blur-xl border border-gray-700/50 rounded-none md:rounded-3xl md:h-[85vh] md:m-4 shadow-2xl">
        {/* Chat Header */}
        <div className="p-4 md:p-6 border-b border-gray-700/50 flex justify-between items-center bg-gray-800/50">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/25">
              <ChatBubble className="w-5 h-5 md:w-6 md:h-6 text-white" />
            </div>
            <div>
              <h3 className="text-white font-bold text-lg md:text-xl">Meeting Chat</h3>
              <p className="text-gray-400 text-sm">Real-time messaging</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {chat.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-1 bg-cyan-500/20 text-cyan-400 text-sm rounded-full border border-cyan-500/30">
                <div className="w-2 h-2 bg-cyan-400 rounded-full"></div>{" "}
                {/* Removed animate-pulse to prevent shaking */}
                {chat.length} message{chat.length !== 1 ? "s" : ""}
              </div>
            )}
            <button
              onClick={onClose}
              className="w-10 h-10 md:w-12 md:h-12 bg-gray-700/50 hover:bg-gray-600/50 rounded-xl flex items-center justify-center transition-all duration-300 group"
            >
              <Close className="w-5 h-5 md:w-6 md:h-6 text-gray-300 group-hover:text-white" />
            </button>
          </div>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 md:space-y-6 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">
          {chat.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <div className="w-20 h-20 md:w-24 md:h-24 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 rounded-full flex items-center justify-center mb-6">
                <ChatBubble className="w-10 h-10 md:w-12 md:h-12 text-gray-400" />
              </div>
              <h4 className="text-white font-semibold text-lg md:text-xl mb-2">No messages yet</h4>
              <p className="text-gray-400 text-sm md:text-base mb-4">Start the conversation with your participants</p>
              <div className="flex items-center gap-2 text-gray-500 text-xs md:text-sm">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span>Ready to chat</span>
              </div>
            </div>
          ) : (
            <>
              {chat.map((msg, idx) => {
                const isOwnMessage = msg.username === (user?.username || user?.firstName || "Anonymous")
                return (
                  <div key={msg.id || idx} className={`flex flex-col ${isOwnMessage ? "items-end" : "items-start"}`}>
                    <div className="flex items-center gap-2 mb-2 px-1">
                      <div className="w-6 h-6 bg-gradient-to-r from-gray-600 to-gray-700 rounded-full flex items-center justify-center">
                        <span className="text-xs font-semibold text-white">{msg.username.charAt(0).toUpperCase()}</span>
                      </div>
                      <span className="text-sm font-medium text-gray-300">{msg.username}</span>
                      <span className="text-xs text-gray-500">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      {isOwnMessage && (
                        <div className="flex items-center gap-1">
                          {msg.seen ? (
                            <div className="flex items-center gap-1">
                              <div className="w-3 h-3 text-cyan-400">
                                <svg fill="currentColor" viewBox="0 0 20 20">
                                  <path
                                    fillRule="evenodd"
                                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                              </div>
                              <span className="text-xs text-cyan-400">Seen</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <div className="w-3 h-3 text-gray-500">
                                <svg fill="currentColor" viewBox="0 0 20 20">
                                  <path
                                    fillRule="evenodd"
                                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                              </div>
                              <span className="text-xs text-gray-500">Sent</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div
                      className={`max-w-[75%] md:max-w-[60%] px-4 md:px-6 py-3 md:py-4 rounded-2xl md:rounded-3xl shadow-lg ${
                        isOwnMessage
                          ? "bg-gradient-to-r from-cyan-500 to-purple-500 text-white shadow-cyan-500/25"
                          : "bg-gray-800/80 text-gray-100 border border-gray-700/50"
                      }`}
                    >
                      <p className="text-sm md:text-base break-words leading-relaxed">{msg.message}</p>
                    </div>
                  </div>
                )
              })}
              <div ref={chatEndRef} />
            </>
          )}
        </div>

        {/* Chat Input */}
        <div className="p-4 md:p-6 border-t border-gray-700/50 bg-gray-800/30">
          <div className="flex gap-3 md:gap-4">
            <div className="flex-1 relative">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your message..."
                disabled={!socketConnected}
                className="w-full px-4 md:px-6 py-3 md:py-4 bg-gray-800/50 border border-gray-600/50 rounded-xl md:rounded-2xl text-white placeholder-gray-400 focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 transition-all text-sm md:text-base"
                autoFocus
              />
              {!socketConnected && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></div>
                </div>
              )}
            </div>
            <button
              onClick={handleSend}
              disabled={!message.trim() || !socketConnected}
              className={`w-12 h-12 md:w-14 md:h-14 rounded-xl md:rounded-2xl flex items-center justify-center transition-all duration-300 ${
                message.trim() && socketConnected
                  ? "bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-400 hover:to-purple-400 shadow-lg shadow-cyan-500/25 hover:scale-105"
                  : "bg-gray-700/50 text-gray-500 cursor-not-allowed"
              }`}
            >
              <Send className="w-5 h-5 md:w-6 md:h-6" />
            </button>
          </div>
          <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
            <span>Press Enter to send • Shift+Enter for new line</span>
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${socketConnected ? "bg-green-400 animate-pulse" : "bg-red-400"}`}
              ></div>
              <span>{socketConnected ? "Connected" : "Disconnected"}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const MeetingRoom = () => {
  const { roomId } = useParams()
  const { user, isLoaded } = useUser()
  const navigate = useNavigate()

  // Refs
  const socketRef = useRef(null)
  const peerConnectionRef = useRef(null)
  const localStreamRef = useRef(null)
  const localScreenStreamRef = useRef(null)
  const remoteStreamRef = useRef(null)
  const remoteScreenStreamRef = useRef(null)
  const originalVideoTrackRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const recordingIntervalRef = useRef(null)

  // States
  const [localStream, setLocalStream] = useState(null)
  const [remoteStream, setRemoteStream] = useState(null)
  const [isStarted, setIsStarted] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [socketConnected, setSocketConnected] = useState(false)
  const [error, setError] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  const [chat, setChat] = useState([])
  const [message, setMessage] = useState("")
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  const [isAudioMuted, setIsAudioMuted] = useState(false)
  const [isVideoMuted, setIsVideoMuted] = useState(false)
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [isRemoteScreenSharing, setIsRemoteScreenSharing] = useState(false)
  const [isScreenShareLoading, setIsScreenShareLoading] = useState(false)

  const [linkCopied, setLinkCopied] = useState(false)

  const [subtitlesEnabled, setSubtitlesEnabled] = useState(() => {
    return localStorage.getItem("subtitlesEnabled") === "true"
  })
  const [translationEnabled, setTranslationEnabled] = useState(() => {
    return localStorage.getItem("translationEnabled") === "true"
  })
  const [selectedLanguage, setSelectedLanguage] = useState(() => {
    return localStorage.getItem("subtitleLanguage") || "en"
  })
  const [subtitles, setSubtitles] = useState([])
  const [isLanguageDropdownOpen, setIsLanguageDropdownOpen] = useState(false)
  const [subtitleError, setSubtitleError] = useState(null)

  useEffect(() => {
    localStorage.setItem("subtitlesEnabled", subtitlesEnabled.toString())
  }, [subtitlesEnabled])

  useEffect(() => {
    localStorage.setItem("translationEnabled", translationEnabled.toString())
  }, [translationEnabled])

  useEffect(() => {
    localStorage.setItem("subtitleLanguage", selectedLanguage)
  }, [selectedLanguage])

  const copyMeetingLink = async () => {
    try {
      const meetingLink = `${window.location.origin}/meeting/${roomId}`
      await navigator.clipboard.writeText(meetingLink)
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2000)
    } catch (err) {
      console.error("Failed to copy link:", err)
      // Fallback for older browsers
      const textArea = document.createElement("textarea")
      textArea.value = `${window.location.origin}/meeting/${roomId}`
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand("copy")
      document.body.removeChild(textArea)
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2000)
    }
  }

  const startSubtitleRecording = useCallback(() => {
    if (!localStreamRef.current || !subtitlesEnabled) return

    try {
      // Create a new MediaRecorder for audio only
      const audioStream = new MediaStream()
      const audioTrack = localStreamRef.current.getAudioTracks()[0]
      if (!audioTrack) return

      audioStream.addTrack(audioTrack)

      const mediaRecorder = new MediaRecorder(audioStream, {
        mimeType: "audio/webm;codecs=opus",
      })

      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        if (audioChunksRef.current.length > 0) {
          const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" })

          // Only send if blob is substantial (> 1KB to avoid empty audio)
          if (audioBlob.size > 1024) {
            const reader = new FileReader()
            reader.onload = () => {
              const audioData = reader.result
              socketRef.current?.emit("subtitle-request", {
                roomId,
                audioData,
                translate: translationEnabled,
                targetLanguage: selectedLanguage,
                speaker: user?.username || user?.firstName || "Anonymous",
              })
            }
            reader.readAsDataURL(audioBlob)
          }
        }
        audioChunksRef.current = []
      }

      // Record in 3-second chunks for real-time processing
      mediaRecorder.start()
      recordingIntervalRef.current = setInterval(() => {
        if (mediaRecorderRef.current?.state === "recording") {
          mediaRecorderRef.current.stop()
          mediaRecorderRef.current.start()
        }
      }, 3000)
    } catch (err) {
      console.error("Failed to start subtitle recording:", err)
      setSubtitleError("Failed to start speech recognition")
    }
  }, [subtitlesEnabled, translationEnabled, selectedLanguage, roomId, user])

  const stopSubtitleRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop()
    }
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current)
      recordingIntervalRef.current = null
    }
    mediaRecorderRef.current = null
  }, [])

  const toggleSubtitles = useCallback(() => {
    const newState = !subtitlesEnabled
    setSubtitlesEnabled(newState)
    setSubtitleError(null)

    if (newState) {
      startSubtitleRecording()
    } else {
      stopSubtitleRecording()
      setSubtitles([])
    }
  }, [subtitlesEnabled, startSubtitleRecording, stopSubtitleRecording])

  useEffect(() => {
    if (subtitlesEnabled && localStreamRef.current && socketConnected) {
      startSubtitleRecording()
    } else {
      stopSubtitleRecording()
    }

    return () => {
      stopSubtitleRecording()
    }
  }, [subtitlesEnabled, socketConnected, startSubtitleRecording, stopSubtitleRecording])

  const cleanup = useCallback(() => {
    console.log("Cleaning up resources...")

    stopSubtitleRecording()

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop())
      localStreamRef.current = null
    }

    if (localScreenStreamRef.current) {
      localScreenStreamRef.current.getTracks().forEach((track) => track.stop())
      localScreenStreamRef.current = null
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close()
      peerConnectionRef.current = null
    }

    if (socketRef.current) {
      socketRef.current.disconnect()
      socketRef.current = null
    }

    remoteStreamRef.current = null
    remoteScreenStreamRef.current = null
    originalVideoTrackRef.current = null
    setLocalStream(null)
    setRemoteStream(null)
    setIsConnected(false)
    setIsScreenSharing(false)
    setIsRemoteScreenSharing(false)
    setSubtitles([])
  }, [stopSubtitleRecording])

  useEffect(() => {
    if (!isLoaded) return

    socketRef.current = io(backendUrl, {
      reconnectionAttempts: 5,
      timeout: 10000,
      forceNew: true,
    })

    socketRef.current.on("connect", () => {
      console.log("✅ Socket connected:", socketRef.current.id)
      setSocketConnected(true)
      setIsLoading(false)
      setError(null)
    })

    socketRef.current.on("connect_error", (err) => {
      console.error("❌ Socket connection error:", err)
      setError(`Server connection failed. Make sure server is running on ${backendUrl}`)
      setIsLoading(false)
      setSocketConnected(false)
    })

    socketRef.current.on("disconnect", (reason) => {
      console.log("❌ Socket disconnected:", reason)
      setSocketConnected(false)
      setIsConnected(false)
    })

    socketRef.current.on("subtitle-response", (data) => {
      const { text, speaker, confidence, error: subtitleResponseError } = data

      if (subtitleResponseError) {
        console.error("Subtitle error:", subtitleResponseError)
        setSubtitleError("Speech recognition temporarily unavailable")
        return
      }

      if (text && text.trim()) {
        const newSubtitle = {
          id: Date.now() + Math.random(),
          text: text.trim(),
          speaker: speaker || "Unknown",
          confidence,
          timestamp: new Date(),
        }

        setSubtitles((prev) => {
          const updated = [...prev, newSubtitle]
          // Keep only last 10 subtitles for performance
          return updated.slice(-10)
        })

        // Clear any previous errors
        setSubtitleError(null)
      }
    })

    return cleanup
  }, [isLoaded, cleanup])

  const startMeeting = async () => {
    setError(null)
    setIsLoading(true)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })

      localStreamRef.current = stream
      originalVideoTrackRef.current = stream.getVideoTracks()[0]
      setLocalStream(stream)
      setIsStarted(true)

      if (socketRef.current?.connected) {
        socketRef.current.emit("join-meeting", roomId)
      }
    } catch (err) {
      console.error("❌ Failed to get media devices:", err)
      let errorMessage = "Could not access camera/microphone. "
      if (err.name === "NotAllowedError") errorMessage += "Please allow camera and microphone permissions."
      else if (err.name === "NotFoundError") errorMessage += "No camera or microphone found."
      else errorMessage += err.message
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const handleUserLeft = useCallback(() => {
    console.log("👋 Remote user left the meeting")
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close()
      peerConnectionRef.current = null
    }
    remoteStreamRef.current = null
    remoteScreenStreamRef.current = null
    setRemoteStream(null)
    setIsConnected(false)
    setIsRemoteScreenSharing(false)
  }, [])

  const createPeerConnection = useCallback(
    (targetSocketId) => {
      if (peerConnectionRef.current) peerConnectionRef.current.close()

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      })

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socketRef.current.emit("ice-candidate", { candidate: event.candidate, target: targetSocketId }, roomId)
        }
      }

      pc.ontrack = (event) => {
        const stream = event.streams[0]
        if (event.track.kind === "video") {
          const isScreenTrack =
            event.track.getSettings().displaySurface || event.track.label.toLowerCase().includes("screen")
          if (isScreenTrack) {
            remoteScreenStreamRef.current = stream
            setIsRemoteScreenSharing(true)
          } else {
            remoteStreamRef.current = stream
            setRemoteStream(stream)
          }
        } else if (event.track.kind === "audio") {
          if (!remoteStreamRef.current) remoteStreamRef.current = new MediaStream()
          remoteStreamRef.current.getAudioTracks().forEach((track) => remoteStreamRef.current.removeTrack(track))
          remoteStreamRef.current.addTrack(event.track)
          setRemoteStream(new MediaStream(remoteStreamRef.current.getTracks()))
        }
      }

      pc.oniceconnectionstatechange = () => {
        const state = pc.iceConnectionState
        if (state === "connected" || state === "completed") setIsConnected(true)
        else if (["disconnected", "failed", "closed"].includes(state)) handleUserLeft()
      }

      localStreamRef.current.getTracks().forEach((track) => pc.addTrack(track, localStreamRef.current))
      peerConnectionRef.current = pc
      return pc
    },
    [handleUserLeft, roomId],
  )

  useEffect(() => {
    if (!isStarted || !socketConnected || !socketRef.current) return

    const socket = socketRef.current

    const signalingHandlers = {
      "user-joined": async ({ socketId }) => {
        const pc = createPeerConnection(socketId)
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        socket.emit("offer", { offer, target: socketId }, roomId)
      },
      offer: async ({ offer, from }) => {
        const pc = createPeerConnection(from)
        await pc.setRemoteDescription(new RTCSessionDescription(offer))
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        socket.emit("answer", { answer, target: from }, roomId)
      },
      answer: async ({ answer }) => {
        if (peerConnectionRef.current)
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer))
      },
      "ice-candidate": async ({ candidate }) => {
        if (peerConnectionRef.current && candidate)
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate))
      },
      "user-left": handleUserLeft,
      "peer-screen-share-start": () => {
        console.log("Participant started screen sharing")
        setIsRemoteScreenSharing(true)
      },
      "peer-screen-share-stop": () => {
        console.log("Participant stopped screen sharing - returning to normal video call")
        setIsRemoteScreenSharing(false)
        // Clear any remote screen stream references
        remoteScreenStreamRef.current = null
      },
      "chat-message": (data) => {
        setChat((prev) => [...prev, { ...data, seen: false, id: Date.now() + Math.random() }])
        const currentUsername = user?.username || user?.firstName || "Anonymous"
        if (!isChatOpen && data.username !== currentUsername) {
          setUnreadCount((prev) => prev + 1)
        }
      },
    }

    Object.entries(signalingHandlers).forEach(([event, handler]) => socket.on(event, handler))

    return () => Object.keys(signalingHandlers).forEach((event) => socket.off(event))
  }, [isStarted, socketConnected, roomId, createPeerConnection, handleUserLeft, isChatOpen, user])

  const toggleAudio = () => {
    if (!localStreamRef.current) return
    localStreamRef.current.getAudioTracks().forEach((track) => {
      track.enabled = !track.enabled
      setIsAudioMuted(!track.enabled)
    })
  }

  const toggleVideo = () => {
    if (!localStreamRef.current) return
    localStreamRef.current.getVideoTracks().forEach((track) => {
      track.enabled = !track.enabled
      setIsVideoMuted(!track.enabled)
    })
  }

  const toggleScreenShare = async () => {
    if (isScreenShareLoading) return
    setIsScreenShareLoading(true)
    setError(null)

    const videoSender = peerConnectionRef.current?.getSenders().find((s) => s.track?.kind === "video")
    const audioSender = peerConnectionRef.current?.getSenders().find((s) => s.track?.kind === "audio")

    try {
      if (isScreenSharing) {
        if (localScreenStreamRef.current) {
          localScreenStreamRef.current.getTracks().forEach((track) => track.stop())
          localScreenStreamRef.current = null
        }

        // Restore original video track
        if (videoSender && originalVideoTrackRef.current) {
          await videoSender.replaceTrack(originalVideoTrackRef.current)
        }

        // Restore original audio track
        const originalAudioTrack = localStreamRef.current?.getAudioTracks()[0]
        if (audioSender && originalAudioTrack) {
          await audioSender.replaceTrack(originalAudioTrack)
        }

        setIsScreenSharing(false)
        socketRef.current?.emit("screen-share-stop", roomId)
        console.log("Screen sharing stopped - notified participants")
      } else {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            cursor: "always",
            displaySurface: "monitor",
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: false,
            sampleRate: 48000, // Better audio quality for system sounds
          },
        })

        const screenVideoTrack = screenStream.getVideoTracks()[0]
        const screenAudioTrack = screenStream.getAudioTracks()[0]

        if (!screenVideoTrack) throw new Error("No screen video track found.")

        // Store original video track if not already stored
        if (!originalVideoTrackRef.current && localStreamRef.current) {
          originalVideoTrackRef.current = localStreamRef.current.getVideoTracks()[0]
        }

        // Replace video track with screen
        if (videoSender) await videoSender.replaceTrack(screenVideoTrack)

        if (screenAudioTrack && audioSender) {
          // Create audio context for mixing system audio with microphone
          const audioContext = new AudioContext()
          const destination = audioContext.createMediaStreamDestination()

          // Add screen audio
          const screenAudioSource = audioContext.createMediaStreamSource(screenStream)
          screenAudioSource.connect(destination)

          // Add microphone audio if available
          if (localStreamRef.current?.getAudioTracks()[0]) {
            const micAudioSource = audioContext.createMediaStreamSource(localStreamRef.current)
            const micGain = audioContext.createGain()
            micGain.gain.value = 0.7 // Reduce mic volume slightly when screen sharing
            micAudioSource.connect(micGain)
            micGain.connect(destination)
          }

          const mixedAudioTrack = destination.stream.getAudioTracks()[0]
          await audioSender.replaceTrack(mixedAudioTrack)
          console.log("Mixed audio track created for system sound + microphone")
        }

        screenVideoTrack.onended = () => {
          console.log("Screen share ended by user - cleaning up")
          if (isScreenSharing) {
            setIsScreenSharing(false)

            // Clean up screen stream
            if (localScreenStreamRef.current) {
              localScreenStreamRef.current.getTracks().forEach((track) => track.stop())
              localScreenStreamRef.current = null
            }

            // Restore original tracks
            if (videoSender && originalVideoTrackRef.current) {
              videoSender.replaceTrack(originalVideoTrackRef.current).catch(console.error)
            }
            if (audioSender && localStreamRef.current?.getAudioTracks()[0]) {
              audioSender.replaceTrack(localStreamRef.current.getAudioTracks()[0]).catch(console.error)
            }

            socketRef.current?.emit("screen-share-stop", roomId)
          }
        }

        localScreenStreamRef.current = screenStream
        setIsScreenSharing(true)
        socketRef.current?.emit("screen-share-start", roomId)
        console.log("Screen sharing started - notified participants")
      }
    } catch (err) {
      console.error("Screen sharing error:", err)
      setError("Could not start screen sharing. Please grant permission and try again.")

      if (localScreenStreamRef.current) {
        localScreenStreamRef.current.getTracks().forEach((track) => track.stop())
        localScreenStreamRef.current = null
      }

      setIsScreenSharing(false)
      socketRef.current?.emit("screen-share-stop", roomId)
    } finally {
      setIsScreenShareLoading(false)
    }
  }

  const handleSend = () => {
    if (!message.trim() || !socketConnected) return
    const msgData = {
      roomId,
      message: message.trim(),
      username: user?.username || user?.firstName || "Anonymous",
    }
    socketRef.current.emit("chat-message", msgData)
    setMessage("")
  }

  const leaveMeeting = () => {
    try {
      if (socketRef.current?.connected) {
        socketRef.current.emit("leave-room", roomId)
      }
      cleanup()
      navigate("/")
    } catch (error) {
      console.error("Error leaving meeting:", error)
      navigate("/")
    }
  }

  const toggleChat = () => {
    if (!isChatOpen) {
      setChat((prev) => prev.map((msg) => ({ ...msg, seen: true })))
      setUnreadCount(0)
    }
    setIsChatOpen(!isChatOpen)
  }

  const mainViewStream = isScreenSharing
    ? localScreenStreamRef.current
    : isRemoteScreenSharing
      ? remoteScreenStreamRef.current || remoteStream
      : remoteStream
  const mainViewLabel = isScreenSharing ? "Your Screen" : isRemoteScreenSharing ? "Participant's Screen" : "Participant"

  const pipViews = []
  if (isScreenSharing) {
    pipViews.push({ stream: localStreamRef.current, label: "You (Camera)", isFlipped: true, isMuted: true })
    if (remoteStream) pipViews.push({ stream: remoteStream, label: "Participant", isMuted: false })
  } else if (isRemoteScreenSharing) {
    pipViews.push({ stream: localStream, label: "You", isFlipped: true, isMuted: true })
    if (remoteStream) pipViews.push({ stream: remoteStream, label: "Participant (Camera)", isMuted: true })
  }

  // Pre-meeting join screen
  if (!isStarted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center p-4">
        <div className="absolute top-6 right-6">
          <UserButton />
        </div>

        <div className="w-full max-w-md">
          {isLoading && (
            <div className="text-center mb-8">
              <div className="relative mx-auto w-16 h-16 mb-4">
                <div className="absolute inset-0 border-4 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin"></div>
                <div className="absolute inset-0 border-4 border-transparent border-t-purple-400/50 rounded-full animate-spin animate-reverse"></div>
              </div>
              <p className="text-gray-300">Connecting to server...</p>
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
              {error}
            </div>
          )}

          {!isLoading && (
            <div className="bg-gray-800/50 backdrop-blur-xl border border-gray-700/50 rounded-3xl p-8 shadow-2xl">
              <div className="text-center mb-8">
                <div className="w-20 h-20 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-cyan-500/25">
                  <VideoCall className="w-10 h-10 text-white" />
                </div>
                <h1 className="text-3xl font-bold text-white mb-2">Join Meeting</h1>
                <div className="flex items-center justify-center gap-2 text-gray-400">
                  <span>Room:</span>
                  <span className="px-3 py-1 bg-gray-700/50 rounded-lg text-cyan-400 font-mono text-sm">{roomId}</span>
                </div>
              </div>

              <button
                onClick={startMeeting}
                disabled={!socketConnected}
                className="w-full py-4 bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-400 hover:to-purple-400 disabled:from-gray-600 disabled:to-gray-700 text-white font-semibold rounded-xl transition-all duration-300 shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 flex items-center justify-center gap-3"
              >
                <PlayArrow className="w-5 h-5" />
                Join Now
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Main meeting interface
  return (
    <div className="h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex flex-col overflow-hidden">
      {/* Header - Desktop only */}
      <div className="hidden md:flex items-center justify-between p-4 bg-gray-800/30 backdrop-blur-xl border-b border-gray-700/50">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/25">
            <VideoCall className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-white font-semibold">Meeting Room</h2>
            <p className="text-gray-400 text-sm font-mono">{roomId}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={copyMeetingLink}
            className="flex items-center gap-2 px-4 py-2 bg-gray-700/50 hover:bg-gray-600/50 border border-gray-600/30 rounded-xl text-white transition-colors duration-200"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
            <span className="text-sm">Copy Link</span>
            {linkCopied && (
              <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 px-3 py-1 bg-green-500/20 border border-green-500/30 rounded-lg text-green-400 text-xs whitespace-nowrap">
                Link copied!
              </div>
            )}
          </button>

          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-400" : "bg-yellow-400"}`}></div>
            <span className="text-sm text-gray-300">{isConnected ? "Connected" : "Waiting..."}</span>
          </div>
          {(isScreenSharing || isRemoteScreenSharing) && (
            <div className="flex items-center gap-2 px-3 py-1 bg-purple-500/20 border border-purple-500/30 rounded-full">
              <ScreenShare className="w-4 h-4 text-purple-400" />
              <span className="text-sm text-purple-400">{isScreenSharing ? "Sharing Screen" : "Viewing Screen"}</span>
            </div>
          )}
          <UserButton />
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Video display area */}
        <div className="flex-1 p-2 md:p-4 pb-20 md:pb-24 transition-all duration-500">
          <div className="w-full h-full relative">
            {(isScreenSharing || isRemoteScreenSharing) && mainViewStream ? (
              <>
                <div className="flex gap-2 md:gap-4 h-full transition-all duration-500">
                  {/* Main screen share area */}
                  <div className="flex-1 bg-black rounded-xl md:rounded-2xl overflow-hidden shadow-2xl transition-all duration-300">
                    <VideoPlayer stream={mainViewStream} label={mainViewLabel} className="w-full h-full" />
                  </div>

                  <div className="w-48 md:w-64 lg:w-80 flex flex-col gap-2 md:gap-3 transition-all duration-500">
                    <div className="flex-1 bg-gradient-to-br from-gray-800/60 to-gray-900/60 rounded-xl md:rounded-2xl p-3 md:p-4 backdrop-blur-xl border border-gray-700/50 shadow-xl">
                      <div className="flex items-center gap-2 mb-3 md:mb-4">
                        <div className="w-3 h-3 bg-gradient-to-r from-cyan-400 to-purple-400 rounded-full shadow-lg shadow-cyan-400/50"></div>
                        <span className="text-white text-sm md:text-base font-semibold">Participants</span>
                        <div className="ml-auto px-2 py-1 bg-gray-700/50 rounded-full text-xs text-gray-300">
                          {remoteStream ? "2" : "1"}
                        </div>
                      </div>

                      <div className="space-y-2 md:space-y-3">
                        <div className="aspect-video bg-gradient-to-br from-gray-900 to-gray-800 rounded-lg md:rounded-xl overflow-hidden border border-gray-600/50 shadow-lg transition-all duration-300 hover:border-cyan-500/30">
                          <VideoPlayer
                            stream={localStreamRef.current || localStream}
                            isMuted
                            isFlipped
                            label="You (Camera)"
                            className="w-full h-full"
                          />
                        </div>

                        {remoteStream && (
                          <div className="aspect-video bg-gradient-to-br from-gray-900 to-gray-800 rounded-lg md:rounded-xl overflow-hidden border border-gray-600/50 shadow-lg transition-all duration-300 hover:border-purple-500/30">
                            <VideoPlayer stream={remoteStream} label="Participant (Camera)" className="w-full h-full" />
                          </div>
                        )}

                        {!remoteStream && (
                          <div className="aspect-video bg-gradient-to-br from-gray-900/50 to-gray-800/50 rounded-lg md:rounded-xl border border-gray-600/50 border-dashed flex flex-col items-center justify-center text-center p-3 transition-all duration-300">
                            <div className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-r from-gray-700/50 to-gray-600/50 rounded-full flex items-center justify-center mb-2 shadow-lg">
                              <VideoCall className="w-4 h-4 md:w-5 md:h-5 text-gray-400" />
                            </div>
                            <p className="text-gray-400 text-xs md:text-sm font-medium">Waiting for participants</p>
                            <div className="mt-2 flex items-center gap-1">
                              <div className="w-1 h-1 bg-gray-500 rounded-full animate-pulse"></div>
                              <div
                                className="w-1 h-1 bg-gray-500 rounded-full animate-pulse"
                                style={{ animationDelay: "0.2s" }}
                              ></div>
                              <div
                                className="w-1 h-1 bg-gray-500 rounded-full animate-pulse"
                                style={{ animationDelay: "0.4s" }}
                              ></div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="absolute top-2 md:top-4 left-2 md:left-4 flex flex-col gap-2">
                  {isScreenSharing && (
                    <div className="px-3 md:px-4 py-2 bg-red-500/20 border border-red-500/30 rounded-lg md:rounded-xl text-red-400 text-xs md:text-sm backdrop-blur-xl shadow-lg transition-all duration-300">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-red-400 rounded-full shadow-lg shadow-red-400/50"></div>
                        <span className="hidden sm:inline font-medium">You are sharing your screen</span>
                        <span className="sm:hidden font-medium">Sharing</span>
                      </div>
                    </div>
                  )}
                  {isRemoteScreenSharing && (
                    <div className="px-3 md:px-4 py-2 bg-purple-500/20 border border-purple-500/30 rounded-lg md:rounded-xl text-purple-400 text-xs md:text-sm backdrop-blur-xl shadow-lg transition-all duration-300">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-purple-400 rounded-full shadow-lg shadow-purple-400/50"></div>
                        <span className="hidden sm:inline font-medium">Viewing shared screen</span>
                        <span className="sm:hidden font-medium">Viewing</span>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex gap-2 md:gap-4 h-full flex-col md:flex-row transition-all duration-500">
                <div className="flex-1 transition-all duration-300">
                  <VideoPlayer stream={localStream} isMuted isFlipped label="You" />
                </div>
                <div className="flex-1 transition-all duration-300">
                  <VideoPlayer
                    stream={remoteStream}
                    label={isConnected ? "Participant" : "Waiting for participant..."}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Fixed control bar - always visible at bottom */}
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-gray-900/95 backdrop-blur-xl border-t border-gray-700/50 p-4 md:p-6">
          <div className="flex justify-center">
            <div className="flex items-center gap-3 md:gap-4 p-3 md:p-4 bg-gray-800/90 backdrop-blur-xl rounded-xl md:rounded-2xl border border-gray-700/50 shadow-2xl max-w-fit">
              {/* Mobile copy link button */}
              <button
                onClick={copyMeetingLink}
                className="md:hidden w-12 h-12 rounded-xl flex items-center justify-center bg-gray-700/50 text-white border border-gray-600/30 transition-colors duration-200 relative"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
                {linkCopied && (
                  <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 px-3 py-1 bg-green-500/20 border border-green-500/30 rounded-lg text-green-400 text-xs whitespace-nowrap">
                    Copied!
                  </div>
                )}
              </button>

              {/* Audio toggle */}
              <button
                onClick={toggleAudio}
                className={`w-12 h-12 md:w-14 md:h-14 rounded-xl flex items-center justify-center transition-colors duration-200 ${
                  isAudioMuted
                    ? "bg-red-500/20 text-red-400 border border-red-500/30"
                    : "bg-gray-700/50 text-white border border-gray-600/30 hover:bg-gray-600/50"
                }`}
              >
                {isAudioMuted ? (
                  <MicOff className="w-5 h-5 md:w-6 md:h-6" />
                ) : (
                  <Mic className="w-5 h-5 md:w-6 md:h-6" />
                )}
              </button>

              {/* Video toggle */}
              <button
                onClick={toggleVideo}
                className={`w-12 h-12 md:w-14 md:h-14 rounded-xl flex items-center justify-center transition-colors duration-200 ${
                  isVideoMuted
                    ? "bg-red-500/20 text-red-400 border border-red-500/30"
                    : "bg-gray-700/50 text-white border border-gray-600/30 hover:bg-gray-600/50"
                }`}
              >
                {isVideoMuted ? (
                  <VideocamOff className="w-5 h-5 md:w-6 md:h-6" />
                ) : (
                  <Videocam className="w-5 h-5 md:w-6 md:h-6" />
                )}
              </button>

              {/* Screen share toggle */}
              <button
                onClick={toggleScreenShare}
                disabled={isScreenShareLoading}
                className={`w-12 h-12 md:w-14 md:h-14 rounded-xl flex items-center justify-center transition-colors duration-200 ${
                  isScreenSharing
                    ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                    : "bg-gray-700/50 text-white border border-gray-600/30 hover:bg-gray-600/50"
                } ${isScreenShareLoading ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {isScreenShareLoading ? (
                  <div className="w-5 h-5 md:w-6 md:h-6 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                ) : isScreenSharing ? (
                  <StopScreenShare className="w-5 h-5 md:w-6 md:h-6" />
                ) : (
                  <ScreenShare className="w-5 h-5 md:w-6 md:h-6" />
                )}
              </button>

              <button
                onClick={toggleSubtitles}
                className={`w-12 h-12 md:w-14 md:h-14 rounded-xl flex items-center justify-center transition-colors duration-200 ${
                  subtitlesEnabled
                    ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                    : "bg-gray-700/50 text-white border border-gray-600/30 hover:bg-gray-600/50"
                }`}
              >
                <Subtitles className="w-5 h-5 md:w-6 md:h-6" />
              </button>

              {/* Chat toggle */}
              <button
                onClick={toggleChat}
                className={`w-12 h-12 md:w-14 md:h-14 rounded-xl flex items-center justify-center transition-colors duration-200 relative ${
                  isChatOpen
                    ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                    : "bg-gray-700/50 text-white border border-gray-600/30 hover:bg-gray-600/50"
                }`}
              >
                <ChatBubble className="w-5 h-5 md:w-6 md:h-6" />
                {unreadCount > 0 && !isChatOpen && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </div>
                )}
              </button>

              {/* Leave button */}
              <button
                onClick={leaveMeeting}
                className="w-12 h-12 md:w-14 md:h-14 bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl transition-colors duration-200 flex items-center justify-center ml-2 hover:bg-red-500/30"
              >
                <CallEnd className="w-5 h-5 md:w-6 md:h-6" />
              </button>
            </div>
          </div>

          {subtitlesEnabled && (
            <div className="flex justify-center mt-3">
              <div className="flex items-center gap-3 p-2 bg-gray-800/90 backdrop-blur-xl rounded-xl border border-gray-700/50 shadow-xl">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></div>
                  <span className="text-cyan-400 text-sm font-medium">Live Subtitles</span>
                </div>

                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-sm text-gray-300">
                    <input
                      type="checkbox"
                      checked={translationEnabled}
                      onChange={(e) => setTranslationEnabled(e.target.checked)}
                      className="w-4 h-4 text-cyan-500 bg-gray-700 border-gray-600 rounded focus:ring-cyan-500 focus:ring-2"
                    />
                    Translate
                  </label>

                  {translationEnabled && (
                    <LanguageDropdown
                      selectedLanguage={selectedLanguage}
                      onLanguageChange={setSelectedLanguage}
                      isOpen={isLanguageDropdownOpen}
                      onToggle={setIsLanguageDropdownOpen}
                    />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Mobile status indicators */}
          <div className="md:hidden flex justify-center mt-3 gap-4 text-xs">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-400" : "bg-yellow-400"}`}></div>
              <span className="text-gray-300">{isConnected ? "Connected" : "Waiting..."}</span>
            </div>
            {(isScreenSharing || isRemoteScreenSharing) && (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                <span className="text-purple-400">{isScreenSharing ? "Sharing" : "Viewing"}</span>
              </div>
            )}
            {subtitlesEnabled && (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-cyan-400 rounded-full"></div>
                <span className="text-cyan-400">Subtitles</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <SubtitleDisplay subtitles={subtitles} isVisible={subtitlesEnabled} />

      {/* Chat Component */}
      {isChatOpen && (
        <ChatComponent
          onClose={() => setIsChatOpen(false)}
          {...{ chat, user, message, setMessage, handleSend, socketConnected }}
        />
      )}

      {/* Error notification */}
      {error && (
        <div className="fixed bottom-6 left-4 right-4 md:left-6 md:right-auto md:max-w-md bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm z-50 backdrop-blur-xl">
          <div className="flex justify-between items-start gap-3">
            <p>{error}</p>
            <button onClick={() => setError(null)} className="text-red-400/70 hover:text-red-400 transition-colors">
              <Close className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {subtitleError && (
        <div className="fixed bottom-6 right-4 md:right-6 max-w-md bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 text-yellow-400 text-sm z-50 backdrop-blur-xl">
          <div className="flex justify-between items-start gap-3">
            <p>{subtitleError}</p>
            <button
              onClick={() => setSubtitleError(null)}
              className="text-yellow-400/70 hover:text-yellow-400 transition-colors"
            >
              <Close className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default MeetingRoom
