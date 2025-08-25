"use client"

import { useState } from "react"
import { Close, Translate } from "@mui/icons-material"

const TranslateWordModal = ({ open, onClose }) => {
  const [inputText, setInputText] = useState("")
  const [translatedText, setTranslatedText] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [targetLanguage, setTargetLanguage] = useState("es")

  const languages = [
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

  const handleTranslate = async () => {
    if (!inputText.trim()) return

    setIsLoading(true)
    try {
      // Mock translation - replace with actual translation API
      await new Promise((resolve) => setTimeout(resolve, 1000))
      setTranslatedText(`[${targetLanguage.toUpperCase()}] ${inputText}`)
    } catch (error) {
      console.error("Translation error:", error)
      setTranslatedText("Translation failed. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleTranslate()
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/80 backdrop-blur-2xl animate-fadeIn">
      <div className="w-full max-w-2xl mx-4 mb-32 bg-slate-900/95 backdrop-blur-2xl border border-slate-700/40 rounded-3xl shadow-2xl animate-slideUp">
        {/* Header */}
        <div className="p-6 border-b border-slate-700/40 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-500/25">
              <Translate className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-white font-bold text-xl tracking-tight">Quick Translate</h3>
              <p className="text-slate-400 text-sm font-medium">Translate any word or sentence</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 bg-slate-700/50 hover:bg-slate-600/60 rounded-xl flex items-center justify-center transition-all duration-300 group"
          >
            <Close className="w-5 h-5 text-slate-300 group-hover:text-white transition-colors duration-300" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Language Selection */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-3">Translate to:</label>
            <select
              value={targetLanguage}
              onChange={(e) => setTargetLanguage(e.target.value)}
              className="w-full px-4 py-3 bg-slate-800/60 border border-slate-600/50 rounded-xl text-white focus:outline-none focus:border-indigo-500/60 focus:ring-4 focus:ring-indigo-500/20 transition-all duration-300"
            >
              {languages.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.name}
                </option>
              ))}
            </select>
          </div>

          {/* Input Text */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-3">Text to translate:</label>
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Enter text to translate..."
              className="w-full px-4 py-3 bg-slate-800/60 border border-slate-600/50 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500/60 focus:ring-4 focus:ring-indigo-500/20 transition-all duration-300 resize-none"
              rows={3}
              autoFocus
            />
          </div>

          {/* Translate Button */}
          <button
            onClick={handleTranslate}
            disabled={!inputText.trim() || isLoading}
            className={`w-full py-3 rounded-xl font-semibold transition-all duration-300 ${
              inputText.trim() && !isLoading
                ? "bg-gradient-to-br from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white shadow-xl shadow-indigo-500/25 hover:scale-105"
                : "bg-slate-700/50 text-slate-500 cursor-not-allowed"
            }`}
          >
            {isLoading ? (
              <div className="flex items-center justify-center gap-3">
                <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                Translating...
              </div>
            ) : (
              "Translate"
            )}
          </button>

          {/* Translation Result */}
          {translatedText && (
            <div className="p-4 bg-slate-800/80 border border-slate-700/40 rounded-xl">
              <label className="block text-sm font-semibold text-slate-300 mb-2">Translation:</label>
              <p className="text-white text-base leading-relaxed">{translatedText}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-700/40 text-center">
          <p className="text-slate-500 text-sm">Press Enter to translate • Shift+Enter for new line</p>
        </div>
      </div>
    </div>
  )
}

export default TranslateWordModal
