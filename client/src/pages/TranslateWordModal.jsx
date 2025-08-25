import React, { useState } from "react";
import { Close } from "@mui/icons-material";

const openaiApiKey = import.meta.env.VITE_OPENAI_API_KEY;

export default function TranslateWordModal({ open, onClose }) {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleTranslate() {
    setLoading(true);
    setOutput("");
    const prompt = `Translate this to English:\n\n${input.trim()}`;
    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${openaiApiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 100,
          temperature: 0.2,
        }),
      });
      const data = await response.json();
      setOutput(data.choices?.[0]?.message?.content ?? "Translation failed");
    } catch (err) {
      setOutput("Error processing translation.");
      console.error("Translate error:", err);
    }
    setLoading(false);
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-5">
      <div className="bg-gradient-to-br from-indigo-100 to-white w-full max-w-md rounded-3xl shadow-2xl border border-indigo-300 p-6 relative flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-indigo-800 font-extrabold text-xl tracking-wide drop-shadow-sm">
            Translate to English
          </h2>
          <button
            onClick={onClose}
            className="text-indigo-700 hover:text-red-600 transition-transform hover:scale-110"
            aria-label="Close Translate Modal"
          >
            <Close fontSize="large" />
          </button>
        </div>

        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={3}
          placeholder="Paste or type any word or sentence in any language..."
          className="resize-none w-full p-3 rounded-xl border border-indigo-300 bg-indigo-50 text-indigo-900 placeholder-indigo-400 shadow-inner focus:outline-none focus:ring-2 focus:ring-indigo-400 transition shadow-md"
          spellCheck="true"
          aria-label="Input text for translation"
        />

        <button
          onClick={handleTranslate}
          disabled={!input.trim() || loading}
          className={`mt-5 w-full py-3 font-semibold rounded-full text-white shadow-lg transition-transform ${
            loading
              ? "bg-indigo-300 cursor-wait"
              : "bg-indigo-600 hover:bg-indigo-700 active:scale-95 cursor-pointer"
          }`}
          aria-live="polite"
        >
          {loading ? "Translating..." : "Translate"}
        </button>

        {output && (
          <div
            tabIndex={-1}
            className="mt-6 max-h-48 overflow-y-auto rounded-lg border border-indigo-400 bg-indigo-50 p-4 text-indigo-900 font-medium whitespace-pre-wrap shadow-inner"
            aria-label="Translation output"
          >
            <strong className="block mb-2 text-indigo-700">English:</strong> {output}
          </div>
        )}
      </div>
    </div>
  );
}
