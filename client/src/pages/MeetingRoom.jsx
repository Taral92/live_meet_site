"use client"

import React from "react"

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

const backendUrl = "https://live-meet-site@onredner.com"

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

const SubtitleDisplay = React.memo(({ subtitles, isVisible }) => {
  if (!isVisible || !subtitles.length) return null

  // Get only the latest subtitle
  const latestSubtitle = subtitles[subtitles.length - 1]
  if (!latestSubtitle) return null

  return (
    <div className="fixed bottom-20 sm:bottom-28 left-2 right-2 sm:left-4 sm:right-4 z-30 flex justify-center pointer-events-none">
      <div className="max-w-xs sm:max-w-2xl w-full">
        <div className="bg-black/95 backdrop-blur-md rounded-lg px-2 py-1.5 sm:px-3 sm:py-2 border border-white/20 shadow-2xl">
          {/* Compact header */}
          <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
            <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-red-500 rounded-full animate-pulse"></div>
            <span className="text-red-400 text-xs font-medium">LIVE</span>
            <span className="text-blue-300 text-xs font-medium truncate max-w-20 sm:max-w-none">
              {latestSubtitle.speaker}
            </span>
            {latestSubtitle.confidence && (
              <span className="text-green-400 text-xs hidden sm:inline">
                {Math.round(latestSubtitle.confidence * 100)}%
              </span>
            )}
          </div>

          {/* Latest subtitle content - compact and scrollable */}
          <div className="max-h-12 sm:max-h-16 overflow-y-auto scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
            {/* Original text */}
            <p className="text-white text-xs sm:text-sm leading-relaxed mb-1">{latestSubtitle.text}</p>

            {/* Translation if available */}
            {latestSubtitle.translatedText && latestSubtitle.translatedText !== latestSubtitle.text && (
              <div className="bg-emerald-500/20 border border-emerald-400/30 rounded px-1.5 py-0.5 sm:px-2 sm:py-1 mt-1">
                <p className="text-emerald-100 text-xs leading-relaxed">{latestSubtitle.translatedText}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
})

const VideoPlayer = React.memo(({ stream, isLocal = false, isMuted = false, label }) => {
  const videoRef = useRef(null)

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream
    }
  }, [stream])

  return (
    <div className="relative w-full h-full bg-slate-900 rounded-2xl overflow-hidden border border-slate-700/40">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isMuted}
        className="w-full h-full object-cover"
        style={{ transform: isLocal ? "scaleX(-1)" : "none" }}
      />
      {label && (
        <div className="absolute bottom-3 left-3 px-2 py-1 bg-black/60 backdrop-blur-sm rounded-lg text-white text-sm font-medium">
          {label}
        </div>
      )}
    </div>
  )
})

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
        className="flex items-center gap-3 px-4 py-2.5 bg-slate-700/60 hover:bg-slate-600/60 border border-slate-600/40 rounded-xl text-white text-sm transition-all duration-300 hover:border-indigo-400/40 hover:shadow-lg hover:shadow-indigo-500/10"
      >
        <Translate className="w-4 h-4 text-indigo-400" />
        <span className="font-medium">
          {SUPPORTED_LANGUAGES.find((lang) => lang.code === selectedLanguage)?.name || "English"}
        </span>
        <ExpandMore className={`w-4 h-4 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute bottom-full mb-3 left-0 w-52 bg-slate-800/95 backdrop-blur-2xl border border-slate-700/50 rounded-2xl shadow-2xl max-h-72 overflow-y-auto z-50 animate-slideUp">
          <div className="p-3">
            {SUPPORTED_LANGUAGES.map((language) => (
              <button
                key={language.code}
                onClick={() => {
                  onLanguageChange(language.code)
                  onToggle(false)
                }}
                className={`w-full text-left px-4 py-3 rounded-xl text-sm transition-all duration-300 ${
                  selectedLanguage === language.code
                    ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shadow-lg"
                    : "text-slate-300 hover:bg-slate-700/60 hover:text-white"
                }`}
              >
                <span className="font-medium">{language.name}</span>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-2xl animate-fadeIn">
      {/* Chat overlay container */}
      <div className="w-full h-full max-w-5xl mx-auto flex flex-col bg-slate-900/95 backdrop-blur-2xl border border-slate-700/40 rounded-none md:rounded-3xl md:h-[90vh] md:m-6 shadow-2xl animate-slideUp">
        {/* Chat Header */}
        <div className="p-6 md:p-8 border-b border-slate-700/40 flex justify-between items-center bg-slate-800/40">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 md:w-16 md:h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-500/25 transition-transform duration-300 hover:scale-105">
              <ChatBubble className="w-7 h-7 md:w-8 md:h-8 text-white" />
            </div>
            <div>
              <h3 className="text-white font-bold text-xl md:text-2xl tracking-tight">Meeting Chat</h3>
              <p className="text-slate-400 text-sm font-medium">Real-time messaging</p>
            </div>
          </div>
          <div className="flex items-center gap-5">
            {chat.length > 0 && (
              <div className="flex items-center gap-3 px-4 py-2 bg-indigo-500/20 text-indigo-300 text-sm rounded-full border border-indigo-500/30 backdrop-blur-sm">
                <div className="w-2.5 h-2.5 bg-indigo-400 rounded-full animate-pulse"></div>
                <span className="font-semibold">
                  {chat.length} message{chat.length !== 1 ? "s" : ""}
                </span>
              </div>
            )}
            <button
              onClick={onClose}
              className="w-12 h-12 md:w-14 md:h-14 bg-slate-700/50 hover:bg-slate-600/60 rounded-2xl flex items-center justify-center transition-all duration-300 group hover:scale-105"
            >
              <Close className="w-6 h-6 md:w-7 md:h-7 text-slate-300 group-hover:text-white transition-colors duration-300" />
            </button>
          </div>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 md:space-y-8 scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-transparent">
          {chat.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-16">
              <div className="w-24 h-24 md:w-28 md:h-28 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-3xl flex items-center justify-center mb-8 shadow-2xl backdrop-blur-sm border border-slate-600/30">
                <ChatBubble className="w-12 h-12 md:w-14 md:h-14 text-slate-400" />
              </div>
              <h4 className="text-white font-bold text-xl md:text-2xl mb-3 tracking-tight">No messages yet</h4>
              <p className="text-slate-400 text-base md:text-lg mb-6 leading-relaxed">
                Start the conversation with your participants
              </p>
              <div className="flex items-center gap-3 text-slate-500 text-sm md:text-base">
                <div className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse"></div>
                <span className="font-medium">Ready to chat</span>
              </div>
            </div>
          ) : (
            <>
              {chat.map((msg, idx) => {
                const isOwnMessage = msg.username === (user?.username || user?.firstName || "Anonymous")
                return (
                  <div
                    key={msg.id || idx}
                    className={`flex flex-col animate-slideIn ${isOwnMessage ? "items-end" : "items-start"}`}
                  >
                    <div className="flex items-center gap-3 mb-3 px-2">
                      <div className="w-8 h-8 bg-gradient-to-br from-slate-600 to-slate-700 rounded-full flex items-center justify-center shadow-lg">
                        <span className="text-sm font-bold text-white">{msg.username.charAt(0).toUpperCase()}</span>
                      </div>
                      <span className="text-sm font-semibold text-slate-300">{msg.username}</span>
                      <span className="text-xs text-slate-500 font-medium">
                        {new Date(msg.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {isOwnMessage && (
                        <div className="flex items-center gap-2">
                          {msg.seen ? (
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 text-indigo-400">
                                <svg fill="currentColor" viewBox="0 0 20 20">
                                  <path
                                    fillRule="evenodd"
                                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                              </div>
                              <span className="text-xs text-indigo-400 font-medium">Seen</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 text-slate-500">
                                <svg fill="currentColor" viewBox="0 0 20 20">
                                  <path
                                    fillRule="evenodd"
                                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                              </div>
                              <span className="text-xs text-slate-500 font-medium">Sent</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div
                      className={`max-w-[80%] md:max-w-[65%] px-6 md:px-8 py-4 md:py-5 rounded-3xl md:rounded-3xl shadow-xl transition-all duration-300 hover:scale-[1.02] ${
                        isOwnMessage
                          ? "bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-indigo-500/25"
                          : "bg-slate-800/80 text-slate-100 border border-slate-700/40 shadow-slate-900/50"
                      }`}
                    >
                      <p className="text-sm md:text-base break-words leading-relaxed font-medium">{msg.message}</p>
                    </div>
                  </div>
                )
              })}
              <div ref={chatEndRef} />
            </>
          )}
        </div>

        {/* Chat Input */}
        <div className="p-6 md:p-8 border-t border-slate-700/40 bg-slate-800/30">
          <div className="flex gap-4 md:gap-5">
            <div className="flex-1 relative">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your message..."
                disabled={!socketConnected}
                className="w-full px-6 md:px-8 py-4 md:py-5 bg-slate-800/60 border border-slate-600/50 rounded-2xl md:rounded-2xl text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500/60 focus:ring-4 focus:ring-indigo-500/20 transition-all duration-300 text-sm md:text-base font-medium backdrop-blur-sm"
                autoFocus
              />
              {!socketConnected && (
                <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                  <div className="w-3 h-3 bg-red-400 rounded-full animate-pulse"></div>
                </div>
              )}
            </div>
            <button
              onClick={handleSend}
              disabled={!message.trim() || !socketConnected}
              className={`w-14 h-14 md:w-16 md:h-16 rounded-2xl md:rounded-2xl flex items-center justify-center transition-all duration-300 ${
                message.trim() && socketConnected
                  ? "bg-gradient-to-br from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 shadow-xl shadow-indigo-500/25 hover:scale-105 hover:shadow-indigo-500/40"
                  : "bg-slate-700/50 text-slate-500 cursor-not-allowed"
              }`}
            >
              <Send className="w-6 h-6 md:w-7 md:h-7" />
            </button>
          </div>
          <div className="flex items-center justify-between mt-4 text-xs text-slate-500">
            <span className="font-medium">Press Enter to send • Shift+Enter for new line</span>
            <div className="flex items-center gap-3">
              <div
                className={`w-2.5 h-2.5 rounded-full ${socketConnected ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`}
              ></div>
              <span className="font-medium">{socketConnected ? "Connected" : "Disconnected"}</span>
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

  const [subtitlesEnabled, setSubtitlesEnabled] = useState(false)
  const [translationEnabled, setTranslationEnabled] = useState(false)
  const [selectedLanguage, setSelectedLanguage] = useState(() => {
    return localStorage.getItem("subtitleLanguage") || "en"
  })
  const [subtitles, setSubtitles] = useState([])
  const [pendingSubtitle, setPendingSubtitle] = useState(null)
  const pendingTimerRef = useRef(null)
  const SUBTITLE_MERGE_DELAY = 800

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
          const audioBlob = new Blob(audioChunksRef.current, {
            type: "audio/webm",
          })

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

      mediaRecorder.start()
      recordingIntervalRef.current = setInterval(() => {
        if (mediaRecorderRef.current?.state === "recording") {
          mediaRecorderRef.current.stop()
          mediaRecorderRef.current.start()
        }
      }, 1000)
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
      const { id, text, speaker, confidence, translated, error: subtitleResponseError } = data

      if (subtitleResponseError || !text || !text.trim()) {
        return
      }

      if (!translated) {
        const newSubtitle = {
          id,
          text: text.trim(),
          speaker,
          confidence,
          timestamp: new Date(),
          translatedText: null,
          translated: false,
        }

        setSubtitles((prevSubtitles) => {
          const updated = [...prevSubtitles, newSubtitle].slice(-15)
          return updated
        })
      } else {
        setSubtitles((prevSubtitles) =>
          prevSubtitles.map((sub) =>
            sub.id === id
              ? {
                  ...sub,
                  translatedText: text.trim(),
                  translated: true,
                  confidence: confidence || sub.confidence,
                }
              : sub,
          ),
        )
      }
    })

    return cleanup
  }, [isLoaded, cleanup])
  useEffect(() => {
    if (!subtitlesEnabled && pendingTimerRef.current) {
      clearTimeout(pendingTimerRef.current)
      setPendingSubtitle(null)
    }
  }, [subtitlesEnabled])

  const subtitleList = subtitles.slice(-8) // Show last 8 subtitles

  const startMeeting = async () => {
    setError(null)
    setIsLoading(true)

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
    pipViews.push({
      stream: localStreamRef.current,
      label: "You (Camera)",
      isFlipped: true,
      isMuted: true,
    })
    if (remoteStream)
      pipViews.push({
        stream: remoteStream,
        label: "Participant",
        isMuted: false,
      })
  } else if (isRemoteScreenSharing) {
    pipViews.push({
      stream: localStream,
      label: "You",
      isFlipped: true,
      isMuted: true,
    })
    if (remoteStream)
      pipViews.push({
        stream: remoteStream,
        label: "Participant (Camera)",
        isMuted: true,
      })
  }

  // Pre-meeting join screen
  if (!isStarted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-purple-900 flex items-center justify-center p-6 relative overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl animate-pulse"></div>
          <div
            className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl animate-pulse"
            style={{ animationDelay: "1s" }}
          ></div>
        </div>

        {/* Header with user info */}
        <div className="absolute top-4 sm:top-6 md:top-8 right-4 sm:right-6 md:right-8 z-10">
          <div className="scale-125 sm:scale-100">
            <UserButton />
          </div>
        </div>

        <div className="w-full max-w-lg relative z-10">
          {isLoading && (
            <div className="text-center mb-12 animate-fadeIn">
              <div className="relative mx-auto w-20 h-20 mb-6">
                <div className="absolute inset-0 border-4 border-indigo-500/30 border-t-indigo-400 rounded-full animate-spin"></div>
                <div className="absolute inset-2 border-4 border-transparent border-t-purple-400/50 rounded-full animate-spin animate-reverse"></div>
              </div>
              <p className="text-slate-300 text-lg font-medium">Connecting to server...</p>
            </div>
          )}

          {error && (
            <div className="mb-8 p-5 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 text-sm backdrop-blur-sm animate-slideIn">
              <div className="font-semibold">{error}</div>
            </div>
          )}

          {!isLoading && (
            <div className="bg-slate-800/40 backdrop-blur-2xl border border-slate-700/40 rounded-3xl p-10 shadow-2xl animate-slideUp">
              <div className="text-center mb-10">
                <div className="w-24 h-24 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-indigo-500/25 transition-transform duration-500 hover:scale-110">
                  <VideoCall className="w-12 h-12 text-white" />
                </div>
                <h1 className="text-4xl font-bold text-white mb-4 tracking-tight">Join Meeting</h1>
                <div className="flex items-center justify-center gap-3 text-slate-400">
                  <span className="text-lg font-medium">Room:</span>
                  <span className="px-4 py-2 bg-slate-700/50 rounded-xl text-indigo-300 font-mono text-base font-semibold border border-slate-600/30">
                    {roomId}
                  </span>
                </div>
              </div>

              <button
                onClick={startMeeting}
                disabled={!socketConnected}
                className="w-full py-5 bg-gradient-to-br from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 disabled:from-slate-600 disabled:to-slate-700 text-white font-bold text-lg rounded-2xl transition-all duration-300 shadow-xl shadow-indigo-500/25 hover:shadow-indigo-500/40 flex items-center justify-center gap-4 hover:scale-105 disabled:hover:scale-100"
              >
                <PlayArrow className="w-6 h-6" />
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
    <div className="h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-purple-900 flex flex-col overflow-hidden relative">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 right-20 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl animate-pulse"></div>
        <div
          className="absolute bottom-20 left-20 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "2s" }}
        ></div>
      </div>

      {/* Header - Desktop only */}
      <div className="hidden md:flex items-center justify-between p-6 bg-slate-800/30 backdrop-blur-2xl border-b border-slate-700/40 relative z-10">
        <div className="flex items-center gap-5">
          <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-500/25 transition-transform duration-300 hover:scale-110">
            <VideoCall className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-white font-bold text-xl tracking-tight">Meeting Room</h2>
            <p className="text-slate-400 text-sm font-mono font-medium">{roomId}</p>
          </div>
        </div>
        <div className="flex items-center gap-5">
          <button
            onClick={copyMeetingLink}
            className="flex items-center gap-3 px-5 py-3 bg-slate-700/50 hover:bg-slate-600/60 border border-slate-600/40 rounded-2xl text-white transition-all duration-300 hover:border-indigo-400/40 hover:shadow-lg hover:shadow-indigo-500/10 relative"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
            <span className="text-sm font-semibold">Copy Link</span>
            {linkCopied && (
              <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 px-4 py-2 bg-emerald-500/20 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs whitespace-nowrap font-semibold animate-fadeIn">
                Link copied!
              </div>
            )}
          </button>

          <div className="flex items-center gap-3 px-4 py-2 bg-slate-700/30 rounded-2xl border border-slate-600/30">
            <div
              className={`w-3 h-3 rounded-full ${isConnected ? "bg-emerald-400 animate-pulse" : "bg-amber-400 animate-pulse"}`}
            ></div>
            <span className="text-sm text-slate-300 font-semibold">{isConnected ? "Connected" : "Waiting..."}</span>
          </div>
          {(isScreenSharing || isRemoteScreenSharing) && (
            <div className="flex items-center gap-3 px-4 py-2 bg-purple-500/20 border border-purple-500/30 rounded-2xl">
              <ScreenShare className="w-5 h-5 text-purple-400" />
              <span className="text-sm text-purple-400 font-semibold">
                {isScreenSharing ? "Sharing Screen" : "Viewing Screen"}
              </span>
            </div>
          )}
          <UserButton />
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden relative z-10">
        {/* Video display area */}
        <div className="flex-1 p-3 md:p-6 pb-24 md:pb-32 transition-all duration-500">
          <div className="w-full h-full relative">
            {(isScreenSharing || isRemoteScreenSharing) && mainViewStream ? (
              <>
                <div className="flex gap-3 md:gap-6 h-full transition-all duration-500">
                  {/* Main screen share area */}
                  <div className="flex-1 bg-black rounded-2xl md:rounded-3xl overflow-hidden shadow-2xl transition-all duration-300">
                    <VideoPlayer stream={mainViewStream} label={mainViewLabel} className="w-full h-full" />
                  </div>

                  <div className="w-52 md:w-72 lg:w-96 flex flex-col gap-3 md:gap-4 transition-all duration-500">
                    <div className="flex-1 bg-gradient-to-br from-slate-800/60 to-slate-900/60 rounded-2xl md:rounded-3xl p-4 md:p-6 backdrop-blur-2xl border border-slate-700/40 shadow-2xl">
                      <div className="flex items-center gap-3 mb-4 md:mb-6">
                        <div className="w-4 h-4 bg-gradient-to-r from-indigo-400 to-purple-400 rounded-full shadow-lg shadow-indigo-400/60 animate-pulse"></div>
                        <span className="text-white text-sm md:text-base font-bold tracking-wide">Participants</span>
                        <div className="ml-auto px-3 py-1 bg-slate-700/50 rounded-full text-xs text-slate-300 font-semibold border border-slate-600/30">
                          {remoteStream ? "2" : "1"}
                        </div>
                      </div>

                      <div className="space-y-3 md:space-y-4">
                        <div className="aspect-video bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl md:rounded-2xl overflow-hidden border border-slate-600/40 shadow-xl transition-all duration-300 hover:border-indigo-500/30 hover:shadow-indigo-500/10">
                          <VideoPlayer
                            stream={localStreamRef.current || localStream}
                            isMuted
                            isFlipped
                            label="You (Camera)"
                            className="w-full h-full"
                          />
                        </div>

                        {remoteStream && (
                          <div className="aspect-video bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl md:rounded-2xl overflow-hidden border border-slate-600/40 shadow-xl transition-all duration-300 hover:border-purple-500/30 hover:shadow-purple-500/10">
                            <VideoPlayer stream={remoteStream} label="Participant (Camera)" className="w-full h-full" />
                          </div>
                        )}

                        {!remoteStream && (
                          <div className="aspect-video bg-gradient-to-br from-slate-900/50 to-slate-800/50 rounded-xl md:rounded-2xl border border-slate-600/40 border-dashed flex flex-col items-center justify-center text-center p-4 transition-all duration-300 hover:border-slate-500/60">
                            <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-slate-700/50 to-slate-600/50 rounded-2xl flex items-center justify-center mb-3 shadow-xl">
                              <VideoCall className="w-5 h-5 md:w-6 md:h-6 text-slate-400" />
                            </div>
                            <p className="text-slate-400 text-xs md:text-sm font-semibold mb-2">
                              Waiting for participants
                            </p>
                            <div className="flex items-center gap-1">
                              <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-pulse"></div>
                              <div
                                className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-pulse"
                                style={{ animationDelay: "0.2s" }}
                              ></div>
                              <div
                                className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-pulse"
                                style={{ animationDelay: "0.4s" }}
                              ></div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="absolute top-3 md:top-6 left-3 md:left-6 flex flex-col gap-3">
                  {isScreenSharing && (
                    <div className="px-4 md:px-5 py-3 bg-red-500/20 border border-red-500/30 rounded-xl md:rounded-2xl text-red-400 text-xs md:text-sm backdrop-blur-2xl shadow-xl transition-all duration-300 animate-slideIn">
                      <div className="flex items-center gap-3">
                        <div className="w-2.5 h-2.5 bg-red-400 rounded-full shadow-lg shadow-red-400/60 animate-pulse"></div>
                        <span className="hidden sm:inline font-semibold">You are sharing your screen</span>
                        <span className="sm:hidden font-semibold">Sharing</span>
                      </div>
                    </div>
                  )}
                  {isRemoteScreenSharing && (
                    <div className="px-4 md:px-5 py-3 bg-purple-500/20 border border-purple-500/30 rounded-xl md:rounded-2xl text-purple-400 text-xs md:text-sm backdrop-blur-2xl shadow-xl transition-all duration-300 animate-slideIn">
                      <div className="flex items-center gap-3">
                        <div className="w-2.5 h-2.5 bg-purple-400 rounded-full shadow-lg shadow-purple-400/60 animate-pulse"></div>
                        <span className="hidden sm:inline font-semibold">Viewing shared screen</span>
                        <span className="sm:hidden font-semibold">Viewing</span>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              // Simplified video grid to prevent flickering
              <div className="flex gap-3 md:gap-6 h-full flex-col md:flex-row transition-all duration-500">
                {/* Self view - more prominent */}
                <div className="flex-1 transition-all duration-300 relative">
                  <div className="absolute top-4 left-4 z-10 px-3 py-1.5 bg-indigo-500/20 border border-indigo-500/30 rounded-xl text-indigo-300 text-xs font-semibold backdrop-blur-xl">
                    Your Camera (Mirror)
                  </div>
                  <VideoPlayer stream={localStreamRef.current || localStream} isMuted isFlipped label="" />
                </div>

                {/* Participant view */}
                <div className="flex-1 transition-all duration-300 relative">
                  <div className="absolute top-4 left-4 z-10 px-3 py-1.5 bg-purple-500/20 border border-purple-500/30 rounded-xl text-purple-300 text-xs font-semibold backdrop-blur-xl">
                    {isConnected ? "Participant" : "Waiting..."}
                  </div>
                  <VideoPlayer stream={remoteStream} label="" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Fixed control bar - always visible at bottom */}
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-2xl border-t border-slate-700/40 p-5 md:p-8">
          {/* Control buttons */}
          <div className="flex justify-center">
            <div className="flex items-center gap-2 sm:gap-4 md:gap-5 p-3 sm:p-4 md:p-5 bg-slate-800/90 backdrop-blur-2xl rounded-xl sm:rounded-2xl md:rounded-3xl border border-slate-700/40 shadow-2xl max-w-fit overflow-x-auto">
              {/* Mobile copy link button */}
              <button
                onClick={copyMeetingLink}
                className="md:hidden w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center bg-slate-700/50 text-white border border-slate-600/40 transition-all duration-300 relative hover:bg-slate-600/60 hover:scale-105 flex-shrink-0"
              >
                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
                {linkCopied && (
                  <div className="absolute -top-12 sm:-top-14 left-1/2 transform -translate-x-1/2 px-2 py-1 sm:px-3 sm:py-2 bg-emerald-500/20 border border-emerald-500/30 rounded-lg sm:rounded-xl text-emerald-400 text-xs whitespace-nowrap font-semibold animate-fadeIn">
                    Copied!
                  </div>
                )}
              </button>

              {/* Audio toggle */}
              <button
                onClick={toggleAudio}
                className={`w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-xl sm:rounded-2xl flex items-center justify-center transition-all duration-300 hover:scale-105 flex-shrink-0 ${
                  isAudioMuted
                    ? "bg-red-500/20 text-red-400 border border-red-500/30 shadow-lg shadow-red-500/20"
                    : "bg-slate-700/50 text-white border border-slate-600/40 hover:bg-slate-600/60 shadow-lg"
                }`}
              >
                {isAudioMuted ? (
                  <MicOff className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7" />
                ) : (
                  <Mic className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7" />
                )}
              </button>

              {/* Video toggle */}
              <button
                onClick={toggleVideo}
                className={`w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-xl sm:rounded-2xl flex items-center justify-center transition-all duration-300 hover:scale-105 flex-shrink-0 ${
                  isVideoMuted
                    ? "bg-red-500/20 text-red-400 border border-red-500/30 shadow-lg shadow-red-500/20"
                    : "bg-slate-700/50 text-white border border-slate-600/40 hover:bg-slate-600/60 shadow-lg"
                }`}
              >
                {isVideoMuted ? (
                  <VideocamOff className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7" />
                ) : (
                  <Videocam className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7" />
                )}
              </button>

              {/* Screen share toggle */}
              <button
                onClick={toggleScreenShare}
                disabled={isScreenShareLoading}
                className={`w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-xl sm:rounded-2xl flex items-center justify-center transition-all duration-300 hover:scale-105 flex-shrink-0 ${
                  isScreenSharing
                    ? "bg-purple-500/20 text-purple-400 border border-purple-500/30 shadow-lg shadow-purple-500/20"
                    : "bg-slate-700/50 text-white border border-slate-600/40 hover:bg-slate-600/60 shadow-lg"
                } ${isScreenShareLoading ? "opacity-50 cursor-not-allowed hover:scale-100" : ""}`}
              >
                {isScreenShareLoading ? (
                  <div className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                ) : isScreenSharing ? (
                  <StopScreenShare className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7" />
                ) : (
                  <ScreenShare className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7" />
                )}
              </button>

              <button
                onClick={toggleSubtitles}
                className={`w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-xl sm:rounded-2xl flex items-center justify-center transition-all duration-300 hover:scale-105 flex-shrink-0 ${
                  subtitlesEnabled
                    ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 shadow-lg shadow-indigo-500/20"
                    : "bg-slate-700/50 text-white border border-slate-600/40 hover:bg-slate-600/60 shadow-lg"
                }`}
              >
                <Subtitles className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7" />
              </button>

              {/* Chat toggle */}
              <button
                onClick={toggleChat}
                className={`w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-xl sm:rounded-2xl flex items-center justify-center transition-all duration-300 hover:scale-105 relative flex-shrink-0 ${
                  isChatOpen
                    ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 shadow-lg shadow-indigo-500/20"
                    : "bg-slate-700/50 text-white border border-slate-600/40 hover:bg-slate-600/60 shadow-lg"
                }`}
              >
                <ChatBubble className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7" />
                {unreadCount > 0 && !isChatOpen && (
                  <div className="absolute -top-1 -right-1 sm:-top-2 sm:-right-2 w-5 h-5 sm:w-6 sm:h-6 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg animate-bounce">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </div>
                )}
              </button>

              {/* Leave button */}
              <button
                onClick={leaveMeeting}
                className="w-14 h-14 sm:w-16 sm:h-16 md:w-18 md:h-18 bg-red-500/20 text-red-400 border-2 border-red-500/50 rounded-xl sm:rounded-2xl transition-all duration-300 flex items-center justify-center ml-2 sm:ml-3 hover:bg-red-500/30 hover:scale-105 shadow-lg shadow-red-500/20 flex-shrink-0"
              >
                <CallEnd className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8" />
              </button>
            </div>
          </div>

          {subtitlesEnabled && (
            <div className="flex justify-center mt-4">
              <div className="flex items-center gap-4 p-3 bg-slate-800/90 backdrop-blur-2xl rounded-2xl border border-slate-700/40 shadow-xl">
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 bg-indigo-400 rounded-full animate-pulse shadow-lg shadow-indigo-400/60"></div>
                  <span className="text-indigo-300 text-sm font-bold">Live Subtitles</span>
                </div>

                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-3 text-sm text-slate-300 font-medium">
                    <input
                      type="checkbox"
                      checked={translationEnabled}
                      onChange={(e) => setTranslationEnabled(e.target.checked)}
                      className="w-4 h-4 text-indigo-500 bg-slate-700 border-slate-600 rounded focus:ring-indigo-500 focus:ring-2"
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
          <div className="md:hidden flex justify-center mt-4 gap-6 text-xs">
            <div className="flex items-center gap-2">
              <div
                className={`w-2.5 h-2.5 rounded-full ${isConnected ? "bg-emerald-400 animate-pulse" : "bg-amber-400 animate-pulse"}`}
              ></div>
              <span className="text-slate-300 font-medium">{isConnected ? "Connected" : "Waiting..."}</span>
            </div>
            {(isScreenSharing || isRemoteScreenSharing) && (
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 bg-purple-400 rounded-full animate-pulse"></div>
                <span className="text-purple-400 font-medium">{isScreenSharing ? "Sharing" : "Viewing"}</span>
              </div>
            )}
            {subtitlesEnabled && (
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 bg-indigo-400 rounded-full animate-pulse"></div>
                <span className="text-indigo-400 font-medium">Subtitles</span>
              </div>
            )}
          </div>
        </div>

        {/* Header with user info */}
        <div className="flex items-center justify-between p-4 sm:p-6 md:p-8">
          <div className="scale-125 sm:scale-100">
            <UserButton />
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
        <div className="fixed bottom-8 left-6 right-6 md:left-8 md:right-auto md:max-w-md bg-red-500/10 border border-red-500/30 rounded-2xl p-5 text-red-400 text-sm z-50 backdrop-blur-2xl shadow-2xl animate-slideIn">
          <div className="flex justify-between items-start gap-4">
            <p className="font-medium">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-red-400/70 hover:text-red-400 transition-colors duration-300"
            >
              <Close className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {subtitleError && (
        <div className="fixed bottom-8 right-6 md:right-8 max-w-md bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 text-amber-400 text-sm z-50 backdrop-blur-2xl shadow-2xl animate-slideIn">
          <div className="flex justify-between items-start gap-4">
            <p className="font-medium">{subtitleError}</p>
            <button
              onClick={() => setSubtitleError(null)}
              className="text-amber-400/70 hover:text-amber-400 transition-colors duration-300"
            >
              <Close className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default MeetingRoom
