"use client"

import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { v4 as uuidv4 } from "uuid"
import { UserButton } from "@clerk/clerk-react"
import { 
  Box, 
  Button, 
  Typography, 
  Paper, 
  Container, 
  IconButton, 
  Snackbar, 
  Alert, 
  Zoom, 
  Fade,
  useTheme,
  useMediaQuery 
} from "@mui/material"
import { Add, ContentCopy, VideoCall, Link as LinkIcon } from "@mui/icons-material"

const CreateMeeting = () => {
  const [meetingLink, setMeetingLink] = useState("")
  const [showCopyAlert, setShowCopyAlert] = useState(false)
  const navigate = useNavigate()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const isTablet = useMediaQuery(theme.breakpoints.down('md'))

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
    }
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "#f8f9fa",
        position: "relative",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header with User Button */}
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
                width: isMobile ? "36px" : "44px",
                height: isMobile ? "36px" : "44px",
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

      {/* Main Content */}
      <Box
        sx={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          px: { xs: 2, sm: 3, md: 4 },
          py: { xs: 4, sm: 6 },
        }}
      >
        <Container 
          maxWidth="sm" 
          sx={{
            width: "100%",
            maxWidth: { xs: "100%", sm: "500px", md: "600px" }
          }}
        >
          <Zoom in timeout={600}>
            <Box
              sx={{
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: { xs: 3, sm: 4 },
                pt: { xs: 6, sm: 4 }, // Extra top padding on mobile for user button
              }}
            >
              {/* Icon */}
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
                  mb: { xs: 1, sm: 2 },
                }}
              >
                <VideoCall sx={{ 
                  fontSize: { xs: 40, sm: 50, md: 60 }, 
                  color: "#1976d2" 
                }} />
              </Box>

              {/* Title */}
              <Box sx={{ px: { xs: 1, sm: 0 } }}>
                <Typography
                  variant="h3"
                  fontWeight="600"
                  color="#1a1a1a"
                  sx={{
                    mb: { xs: 1, sm: 2 },
                    fontSize: { 
                      xs: "1.75rem", 
                      sm: "2.25rem", 
                      md: "2.75rem",
                      lg: "3rem" 
                    },
                    lineHeight: { xs: 1.2, sm: 1.1 },
                  }}
                >
                  Create Meeting
                </Typography>
                <Typography
                  variant="h6"
                  color="#6b7280"
                  sx={{
                    fontWeight: 400,
                    fontSize: { xs: "0.95rem", sm: "1.1rem", md: "1.25rem" },
                    lineHeight: 1.4,
                    px: { xs: 2, sm: 0 },
                  }}
                >
                  Start a new video meeting instantly
                </Typography>
              </Box>

              {/* Create Button */}
              <Button
                onClick={handleCreateMeeting}
                startIcon={<Add sx={{ fontSize: { xs: 20, sm: 24 } }} />}
                sx={{
                  px: { xs: 4, sm: 6 },
                  py: { xs: 2, sm: 2.5 },
                  borderRadius: 2,
                  fontSize: { xs: "1rem", sm: "1.1rem" },
                  fontWeight: "600",
                  bgcolor: "#1976d2",
                  color: "white",
                  textTransform: "none",
                  boxShadow: "0 2px 8px rgba(25,118,210,0.2)",
                  minHeight: { xs: 48, sm: 56 }, // Touch-friendly height
                  width: { xs: "100%", sm: "auto" },
                  maxWidth: { xs: "280px", sm: "none" },
                  "&:hover": {
                    bgcolor: "#1565c0",
                    boxShadow: "0 4px 12px rgba(25,118,210,0.3)",
                    transform: "translateY(-1px)",
                  },
                  transition: "all 0.2s ease",
                }}
              >
                Create Meeting
              </Button>

              {/* Meeting Link Display */}
              {meetingLink && (
                <Fade in timeout={800}>
                  <Paper
                    sx={{
                      p: { xs: 3, sm: 4 },
                      bgcolor: "white",
                      borderRadius: 2,
                      border: "1px solid #e5e7eb",
                      width: "100%",
                      maxWidth: { xs: "100%", sm: "500px" },
                      boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                    }}
                  >
                    <Box sx={{ 
                      display: "flex", 
                      alignItems: "center", 
                      gap: 1, 
                      mb: 2,
                      justifyContent: { xs: "center", sm: "flex-start" }
                    }}>
                      <LinkIcon sx={{ fontSize: 20, color: "#6b7280" }} />
                      <Typography 
                        variant="h6" 
                        fontWeight="600" 
                        color="#1a1a1a"
                        sx={{ fontSize: { xs: "1.1rem", sm: "1.25rem" } }}
                      >
                        Meeting Link
                      </Typography>
                    </Box>

                    <Box
                      sx={{
                        display: "flex",
                        flexDirection: { xs: "column", sm: "row" },
                        alignItems: { xs: "stretch", sm: "center" },
                        gap: { xs: 2, sm: 2 },
                        p: 2,
                        bgcolor: "#f9fafb",
                        borderRadius: 1,
                        border: "1px solid #e5e7eb",
                      }}
                    >
                      <Typography
                        sx={{
                          flex: 1,
                          fontFamily: "monospace",
                          fontSize: { xs: "0.8rem", sm: "0.875rem" },
                          color: "#1976d2",
                          wordBreak: "break-all",
                          lineHeight: 1.4,
                          textAlign: { xs: "center", sm: "left" },
                          p: { xs: 1, sm: 0 },
                        }}
                      >
                        {meetingLink}
                      </Typography>
                      <IconButton
                        onClick={handleCopy}
                        sx={{
                          width: { xs: 48, sm: 40 },
                          height: { xs: 48, sm: 40 },
                          bgcolor: "#10b981",
                          color: "white",
                          alignSelf: { xs: "center", sm: "auto" },
                          "&:hover": {
                            bgcolor: "#059669",
                            transform: "scale(1.05)",
                          },
                          transition: "all 0.2s ease",
                        }}
                      >
                        <ContentCopy sx={{ fontSize: { xs: 20, sm: 18 } }} />
                      </IconButton>
                    </Box>

                    <Typography 
                      variant="body2" 
                      color="#6b7280" 
                      sx={{ 
                        mt: 2, 
                        textAlign: "center",
                        fontSize: { xs: "0.85rem", sm: "0.875rem" },
                        lineHeight: 1.5,
                      }}
                    >
                      Share this link with participants to join the meeting
                    </Typography>
                  </Paper>
                </Fade>
              )}

              {/* Additional Info */}
              <Paper
                sx={{
                  p: { xs: 2.5, sm: 3 },
                  bgcolor: "#eff6ff",
                  border: "1px solid #bfdbfe",
                  borderRadius: 2,
                  width: "100%",
                  maxWidth: { xs: "100%", sm: "400px" },
                }}
              >
                <Typography 
                  variant="body2" 
                  color="#1e40af" 
                  sx={{ 
                    fontWeight: 500, 
                    mb: 1,
                    fontSize: { xs: "0.9rem", sm: "0.875rem" },
                    textAlign: { xs: "center", sm: "left" }
                  }}
                >
                  💡 Quick Start Tips
                </Typography>
                <Typography 
                  variant="body2" 
                  color="#1e40af" 
                  sx={{ 
                    lineHeight: 1.6,
                    fontSize: { xs: "0.85rem", sm: "0.875rem" },
                    textAlign: { xs: "center", sm: "left" }
                  }}
                >
                  • Allow camera and microphone access when prompted
                  <br />• Share the meeting link with participants
                  <br />• Meeting starts as soon as you join
                </Typography>
              </Paper>
            </Box>
          </Zoom>

          {/* Copy Success Alert */}
          <Snackbar
            open={showCopyAlert}
            autoHideDuration={3000}
            onClose={() => setShowCopyAlert(false)}
            anchorOrigin={{ 
              vertical: "bottom", 
              horizontal: "center" 
            }}
            sx={{
              bottom: { xs: 80, sm: 24 }, // Higher on mobile to avoid nav bars
            }}
          >
            <Alert
              onClose={() => setShowCopyAlert(false)}
              severity="success"
              sx={{
                bgcolor: "#10b981",
                color: "white",
                fontSize: { xs: "0.85rem", sm: "0.875rem" },
                "& .MuiAlert-icon": {
                  color: "white",
                },
              }}
            >
              Meeting link copied to clipboard!
            </Alert>
          </Snackbar>
        </Container>
      </Box>
    </Box>
  )
}

export default CreateMeeting
