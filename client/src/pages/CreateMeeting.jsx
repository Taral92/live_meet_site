"use client"

import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { v4 as uuidv4 } from "uuid"
import { UserButton } from "@clerk/clerk-react"

const CreateMeeting = () => {
  const [meetingLink, setMeetingLink] = useState("")
  const [showCopyAlert, setShowCopyAlert] = useState(false)
  const navigate = useNavigate()

  const handleCreateMeeting = () => {
    const meetingId = uuidv4()
    const link = `${window.location.origin}/meeting/${meetingId}`
    setMeetingLink(link)
    navigate(`/meeting/${meetingId}`)
  }

  const handleCopy = () => {
    if (meetingLink) {
      navigator.clipboard.writeText(meetingLink)
      setShowCopyAlert(true)
      setTimeout(() => setShowCopyAlert(false), 3000)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative flex flex-col overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-3xl animate-pulse delay-500"></div>
      </div>

      {/* Header with User Button */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-20">
        <div className="backdrop-blur-md bg-white/10 rounded-2xl p-1 border border-white/20 shadow-2xl">
          <UserButton
            appearance={{
              elements: {
                avatarBox: {
                  width: "44px",
                  height: "44px",
                  borderRadius: "12px",
                  border: "2px solid rgba(255,255,255,0.2)",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
                },
                userButtonPopoverCard: {
                  borderRadius: "16px",
                  boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  backgroundColor: "rgba(15, 23, 42, 0.95)",
                  backdropFilter: "blur(20px)",
                },
                userButtonPopoverActionButton: {
                  borderRadius: "12px",
                  "&:hover": {
                    backgroundColor: "rgba(255,255,255,0.1)",
                  },
                },
                userButtonPopoverActionButtonText: {
                  color: "#e2e8f0",
                  fontWeight: "500",
                },
                userButtonPopoverActionButtonIcon: {
                  color: "#94a3b8",
                },
              },
            }}
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-8 sm:py-12 relative z-10">
        <div className="w-full max-w-md sm:max-w-lg lg:max-w-xl">
          <div className="text-center space-y-6 sm:space-y-8 animate-fade-in">
            {/* Icon with glow effect */}
            <div className="flex justify-center mb-6 sm:mb-8">
              <div className="relative">
                <div className="w-20 h-20 sm:w-24 sm:h-24 lg:w-28 lg:h-28 bg-gradient-to-br from-cyan-400 to-purple-500 rounded-full flex items-center justify-center shadow-2xl animate-pulse">
                  <div className="absolute inset-0 bg-gradient-to-br from-cyan-400 to-purple-500 rounded-full blur-xl opacity-50 animate-pulse"></div>
                  <svg
                    className="w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 text-white relative z-10"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4zM14 13h-3v3H9v-3H6v-2h3V8h2v3h3v2z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Title Section */}
            <div className="space-y-3 sm:space-y-4">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-white via-cyan-200 to-purple-200 bg-clip-text text-transparent leading-tight">
                Create Meeting
              </h1>
              <p className="text-slate-300 text-base sm:text-lg lg:text-xl font-medium max-w-md mx-auto leading-relaxed">
                Start a new video meeting instantly with advanced features
              </p>
            </div>

            {/* Create Button */}
            <div className="pt-4 sm:pt-6">
              <button
                onClick={handleCreateMeeting}
                className="group relative w-full sm:w-auto px-8 sm:px-12 py-4 sm:py-5 bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 rounded-2xl font-semibold text-white text-base sm:text-lg transition-all duration-300 transform hover:scale-105 hover:shadow-2xl hover:shadow-cyan-500/25 focus:outline-none focus:ring-4 focus:ring-cyan-500/50"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-2xl blur-xl opacity-50 group-hover:opacity-75 transition-opacity duration-300"></div>
                <div className="relative flex items-center justify-center space-x-3">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Create Meeting</span>
                </div>
              </button>
            </div>

            {/* Meeting Link Display */}
            {meetingLink && (
              <div className="animate-slide-up pt-6 sm:pt-8">
                <div className="backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl p-4 sm:p-6 shadow-2xl">
                  <div className="flex items-center justify-center space-x-2 mb-4">
                    <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                      />
                    </svg>
                    <h3 className="text-lg sm:text-xl font-semibold text-white">Meeting Link</h3>
                  </div>

                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-3 sm:space-y-0 sm:space-x-3 p-3 sm:p-4 bg-slate-800/50 border border-slate-700/50 rounded-xl">
                      <div className="flex-1 font-mono text-xs sm:text-sm text-cyan-300 break-all text-center sm:text-left py-2 sm:py-0">
                        {meetingLink}
                      </div>
                      <button
                        onClick={handleCopy}
                        className="flex-shrink-0 w-full sm:w-auto px-4 py-3 sm:px-4 sm:py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 rounded-lg font-medium text-white transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                      >
                        <div className="flex items-center justify-center space-x-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                            />
                          </svg>
                          <span className="sm:hidden">Copy Link</span>
                          <span className="hidden sm:inline">Copy</span>
                        </div>
                      </button>
                    </div>

                    <p className="text-slate-400 text-sm text-center leading-relaxed">
                      Share this link with participants to join the meeting
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Tips Section */}
            <div className="pt-6 sm:pt-8">
              <div className="backdrop-blur-md bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-400/20 rounded-2xl p-4 sm:p-6 shadow-xl">
                <div className="flex items-center justify-center space-x-2 mb-3">
                  <span className="text-xl">💡</span>
                  <h4 className="text-base sm:text-lg font-semibold text-blue-200">Quick Start Tips</h4>
                </div>
                <div className="text-blue-100 text-sm sm:text-base space-y-2 text-center sm:text-left">
                  <div className="flex items-center justify-center sm:justify-start space-x-2">
                    <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full flex-shrink-0"></span>
                    <span>Allow camera and microphone access when prompted</span>
                  </div>
                  <div className="flex items-center justify-center sm:justify-start space-x-2">
                    <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full flex-shrink-0"></span>
                    <span>Share the meeting link with participants</span>
                  </div>
                  <div className="flex items-center justify-center sm:justify-start space-x-2">
                    <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full flex-shrink-0"></span>
                    <span>Meeting starts as soon as you join</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Copy Success Alert */}
      {showCopyAlert && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 animate-slide-up">
          <div className="backdrop-blur-md bg-emerald-500/90 border border-emerald-400/50 rounded-xl px-6 py-4 shadow-2xl">
            <div className="flex items-center space-x-3">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-white font-medium">Meeting link copied to clipboard!</span>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.8s ease-out;
        }
        .animate-slide-up {
          animation: slide-up 0.6s ease-out;
        }
      `}</style>
    </div>
  )
}

export default CreateMeeting
