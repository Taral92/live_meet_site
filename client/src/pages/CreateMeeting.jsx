"use client"

import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { v4 as uuidv4 } from "uuid"
import { Box, Button, Typography, Paper, Container, IconButton, Snackbar, Alert, Zoom, Fade } from "@mui/material"
import { Add, ContentCopy, VideoCall, Link as LinkIcon } from "@mui/icons-material"

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
    }
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "#f8f9fa",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        px: { xs: 2, sm: 4 },
      }}
    >
      <Container maxWidth="sm">
        <Zoom in timeout={600}>
          <Box
            sx={{
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
            }}
          >
            {/* Icon */}
            <Box
              sx={{
                width: 120,
                height: 120,
                borderRadius: "50%",
                bgcolor: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
                mb: 2,
              }}
            >
              <VideoCall sx={{ fontSize: 60, color: "#1976d2" }} />
            </Box>

            {/* Title */}
            <Box>
              <Typography
                variant="h3"
                fontWeight="600"
                color="#1a1a1a"
                sx={{
                  mb: 2,
                  fontSize: { xs: "2rem", sm: "2.5rem", md: "3rem" },
                }}
              >
                Create Meeting
              </Typography>
              <Typography
                variant="h6"
                color="#6b7280"
                sx={{
                  fontWeight: 400,
                  fontSize: { xs: "1rem", sm: "1.25rem" },
                }}
              >
                Start a new video meeting instantly
              </Typography>
            </Box>

            {/* Create Button */}
            <Button
              onClick={handleCreateMeeting}
              startIcon={<Add />}
              sx={{
                px: 6,
                py: 2.5,
                borderRadius: 2,
                fontSize: "1.1rem",
                fontWeight: "600",
                bgcolor: "#1976d2",
                color: "white",
                textTransform: "none",
                boxShadow: "0 2px 8px rgba(25,118,210,0.2)",
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
                    p: 4,
                    bgcolor: "white",
                    borderRadius: 2,
                    border: "1px solid #e5e7eb",
                    width: "100%",
                    maxWidth: 500,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                    <LinkIcon sx={{ fontSize: 20, color: "#6b7280" }} />
                    <Typography variant="h6" fontWeight="600" color="#1a1a1a">
                      Meeting Link
                    </Typography>
                  </Box>

                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 2,
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
                        fontSize: "0.875rem",
                        color: "#1976d2",
                        wordBreak: "break-all",
                        lineHeight: 1.4,
                      }}
                    >
                      {meetingLink}
                    </Typography>
                    <IconButton
                      onClick={handleCopy}
                      sx={{
                        width: 40,
                        height: 40,
                        bgcolor: "#10b981",
                        color: "white",
                        "&:hover": {
                          bgcolor: "#059669",
                          transform: "scale(1.05)",
                        },
                        transition: "all 0.2s ease",
                      }}
                    >
                      <ContentCopy sx={{ fontSize: 18 }} />
                    </IconButton>
                  </Box>

                  <Typography variant="body2" color="#6b7280" sx={{ mt: 2, textAlign: "center" }}>
                    Share this link with participants to join the meeting
                  </Typography>
                </Paper>
              </Fade>
            )}

            {/* Additional Info */}
            <Paper
              sx={{
                p: 3,
                bgcolor: "#eff6ff",
                border: "1px solid #bfdbfe",
                borderRadius: 2,
                maxWidth: 400,
              }}
            >
              <Typography variant="body2" color="#1e40af" sx={{ fontWeight: 500, mb: 1 }}>
                💡 Quick Start Tips
              </Typography>
              <Typography variant="body2" color="#1e40af" sx={{ lineHeight: 1.6 }}>
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
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        >
          <Alert
            onClose={() => setShowCopyAlert(false)}
            severity="success"
            sx={{
              bgcolor: "#10b981",
              color: "white",
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
  )
}

export default CreateMeeting
