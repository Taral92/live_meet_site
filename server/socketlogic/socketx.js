const OpenAI = require("openai");
const dotenv = require("dotenv");
const { v4: uuidv4 } = require("uuid");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// --- CONFIG ---
const CACHE_DURATION = 5 * 60 * 1000; // 5 min
const RATE_LIMIT_WINDOW = 60 * 1000;
const MAX_REQUESTS_PER_MINUTE = 60;

// --- IN-MEMORY DATA ---
const transcriptionCache = new Map();
const subtitleRateLimits = new Map();

// --- GHOST/BANNED PHRASE FILTERS ---
const bannedPhrases = [
  "thank you", "bye", "oh", "yeah", "peace", "right", "thanks", "hello", "hi",
  "sorry", "goodbye", "bye.", "right.", "sure", "fine", "what", "how",
  "subs by www.zeoranger.co.uk","you","um"
];

// --- UTILITIES ---
function checkRateLimit(socketId) {
  const now = Date.now();
  const userLimits = subtitleRateLimits.get(socketId) || { requests: [], lastReset: now };
  userLimits.requests = userLimits.requests.filter(ts => now - ts < RATE_LIMIT_WINDOW);
  if (userLimits.requests.length >= MAX_REQUESTS_PER_MINUTE) return false;
  userLimits.requests.push(now);
  subtitleRateLimits.set(socketId, userLimits);
  return true;
}

function generateCacheKey(audioData, translate, targetLanguage) {
  const hash = crypto.createHash("md5");
  hash.update(audioData);
  hash.update(translate.toString());
  hash.update(targetLanguage || "");
  return hash.digest("hex");
}

function cleanCache() {
  const now = Date.now();
  for (const [key, entry] of transcriptionCache.entries()) {
    if (now - entry.timestamp > CACHE_DURATION) {
      transcriptionCache.delete(key);
    }
  }
}
setInterval(cleanCache, 5 * 60 * 1000);

// --- EXPORT MAIN SOCKET HANDLER ---
module.exports = function setupSocket(io) {
  io.on("connection", (socket) => {
    console.log(`User ${socket.id} connected`);

    // Join room and notify others
    socket.on("join-meeting", (roomId) => {
      socket.join(roomId);
      socket.to(roomId).emit("user-joined", { socketId: socket.id });
      console.log(`User ${socket.id} joined room ${roomId}`);
    });

    // Peer signaling events
    socket.on("offer", ({ offer, target }, roomId) => {
      io.to(target).emit("offer", { offer, from: socket.id });
      console.log(`Offer from ${socket.id} sent to ${target} in room ${roomId}`);
    });
    socket.on("answer", ({ answer, target }, roomId) => {
      io.to(target).emit("answer", { answer, from: socket.id });
      console.log(`Answer from ${socket.id} sent to ${target} in room ${roomId}`);
    });
    socket.on("ice-candidate", ({ candidate, target }, roomId) => {
      io.to(target).emit("ice-candidate", { candidate, from: socket.id });
      console.log(`ICE candidate from ${socket.id} sent to ${target} in room ${roomId}`);
    });

    // Screen share events
    socket.on("screen-share-start", (roomId) => {
      socket.to(roomId).emit("peer-screen-share-start", { from: socket.id });
      console.log(`User ${socket.id} started screen sharing in room ${roomId}`);
    });
    socket.on("screen-share-stop", (roomId) => {
      socket.to(roomId).emit("peer-screen-share-stop", { from: socket.id });
      console.log(`User ${socket.id} stopped screen sharing in room ${roomId}`);
    });

    // Chat
    socket.on("chat-message", (data) => {
      const { roomId, message, username } = data;
      if (roomId && message && username) {
        io.to(roomId).emit("chat-message", {
          message,
          username,
          timestamp: new Date().toISOString(),
        });
        console.log(`Chat message from ${username} in room ${roomId}: ${message}`);
      }
    });

    // Subtitles/Transcription
    socket.on("subtitle-request", async (data) => {
      const { roomId, audioData, translate, targetLanguage, speaker } = data;

      // Check rate limit
      if (!checkRateLimit(socket.id)) {
        socket.emit("subtitle-response", {
          error: "Rate limit exceeded. Please slow down your requests.",
        });
        return;
      }

      try {
        // Validate required fields
        if (!roomId || !audioData || !speaker) {
          socket.emit("subtitle-response", {
            error: "Missing required fields",
          });
          return;
        }

        // Generate cache key
        const cacheKey = generateCacheKey(
          audioData,
          translate || false,
          targetLanguage || "en"
        );

        // Check cache first
        const cachedResult = transcriptionCache.get(cacheKey);
        if (
          cachedResult &&
          Date.now() - cachedResult.timestamp < CACHE_DURATION
        ) {
          console.log(`Cache hit for subtitle request from ${socket.id}`);
          socket.emit("subtitle-response", {
            id: cacheKey,
            text: cachedResult.text,
            speaker,
            confidence: cachedResult.confidence,
            translated: !!cachedResult.translated
          });
          return;
        }

        // Convert base64 audio data to buffer
        const audioBuffer = Buffer.from(audioData.split(",")[1], "base64");

        // Skip very small audio files (likely silence)
        if (audioBuffer.length < 2048) {
          return; // Don't send response for very short audio
        }

        // Create a temporary file for OpenAI Whisper
        const tempDir = path.join(__dirname, "temp");
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }

        const tempFilePath = path.join(
          tempDir,
          `audio_${socket.id}_${Date.now()}.webm`
        );
        fs.writeFileSync(tempFilePath, audioBuffer);

        try {
          // Transcribe audio using OpenAI Whisper
          const transcription = await openai.audio.transcriptions.create({
            file: fs.createReadStream(tempFilePath),
            model: "whisper-1",
            language: "en", // Auto-detect language
            response_format: "verbose_json", // Get confidence scores
          });

          let finalText = transcription.text;
          let confidence = null;

          // Advanced ghost filter block
          const trimmed = (finalText || "").trim();
          let numWords = trimmed === "" ? 0 : trimmed.split(/\s+/).length;

          // Extract confidence if available
          if (transcription.segments && transcription.segments.length > 0) {
            const avgConfidence = transcription.segments.reduce(
              (sum, segment) => sum + (segment.avg_logprob || 0), 0
            ) / transcription.segments.length;
            confidence = Math.max(0, Math.min(1, Math.exp(avgConfidence)));

            // --- Banned phrase ghost filter ---
            const cleaned = trimmed.toLowerCase().replace(/[.?!]/g, "");
            if (
              bannedPhrases.includes(cleaned)
            ) {
              console.log(`Banned ghost phrase: "${trimmed}" (${confidence})`);
              return;
            }
            // --- Short phrase ghost/low-confidence filter ---
            if (
              numWords < 3 && (confidence === null || confidence < 0.5) ||
              numWords >= 3 && (confidence === null || confidence < 0.2)
            ) {
              console.log(
                `Discarded low-confidence/short subtitle: "${trimmed}" (${confidence})`
              );
              return;
            }
          }
          // Empty/short after everything
          if (!trimmed || numWords === 0 || trimmed.length < 3) {
            return;
          }

          // --- UNIQUE SUBTITLE ID ---
          const subtitleId = `${socket.id}_${Date.now()}_${Math.floor(Math.random()*100000)}`;

          // 1. Emit the original (English or source language)
          socket.emit("subtitle-response", {
            id: subtitleId,
            text: trimmed,
            speaker,
            confidence,
            translated: false
          });

          // 2. If translation requested and target is different, emit translation
          if (translate && targetLanguage && targetLanguage !== "auto") {
            try {
              const translation = await openai.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages: [
                  {
                    role: "system",
                    content: `You are a professional translator. Translate the following text to ${targetLanguage}. Only return the translated text, nothing else. If the text is already in the target language, return it as is.`,
                  },
                  { role: "user", content: trimmed }
                ],
                max_tokens: 200,
                temperature: 0.3,
              });

              if (
                translation.choices &&
                translation.choices[0] &&
                translation.choices[0].message
              ) {
                const translatedText = translation.choices[0].message.content.trim();
                socket.emit("subtitle-response", {
                  id: subtitleId,
                  text: translatedText,
                  speaker,
                  confidence,
                  translated: true
                });
              }
            } catch (translationError) {
              console.error("Translation error:", translationError);
            }
          }

          // Cache only the original transcription (could expand to translation too)
          transcriptionCache.set(cacheKey, {
            text: trimmed,
            confidence,
            translated: !!translate,
            timestamp: Date.now(),
          });

          console.log(
            `Subtitle processed for ${speaker} in room ${roomId}: "${trimmed.substring(0, 50)}..."`
          );
        } catch (openaiError) {
          console.error("OpenAI API error:", openaiError);
          socket.emit("subtitle-response", {
            error: "Speech recognition service temporarily unavailable",
          });
        } finally {
          // Clean up temporary file
          try {
            fs.unlinkSync(tempFilePath);
          } catch (cleanupError) {
            console.error("Failed to cleanup temp file:", cleanupError);
          }
        }
      } catch (error) {
        console.error("Subtitle request error:", error);
        socket.emit("subtitle-response", {
          error: "Failed to process speech recognition request",
        });
      }
    });

    // Room exit/cleanup events
    socket.on("leave-room", (roomId) => {
      socket.leave(roomId);
      socket.to(roomId).emit("user-left", { socketId: socket.id });
      console.log(`User ${socket.id} left room ${roomId}`);
    });
    socket.on("disconnecting", () => {
      const rooms = Array.from(socket.rooms).filter((r) => r !== socket.id);
      rooms.forEach((roomId) => {
        socket.to(roomId).emit("user-left", { socketId: socket.id });
        console.log(`User ${socket.id} disconnected from room ${roomId}`);
      });
    });
    socket.on("disconnect", () => {
      subtitleRateLimits.delete(socket.id);
      console.log(`User ${socket.id} disconnected`);
    });
  });
};
