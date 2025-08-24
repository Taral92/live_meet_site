// src/components/TranslateWordModal.jsx
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
    setLoading(false);
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md border border-indigo-400 shadow-2xl">
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-bold text-lg text-indigo-700">Translate to English</h2>
          <button onClick={onClose} className="text-lg px-2 text-indigo-700 hover:text-red-500">
            <Close />
          </button>
        </div>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          rows={2}
          className="w-full p-2 bg-gray-100 rounded text-gray-800 mb-3 border"
          placeholder="Paste or type any word or sentence in any language..."
        />
        <button
          className="px-4 py-2 bg-indigo-500 text-white rounded font-semibold hover:bg-indigo-600 transition disabled:opacity-50"
          disabled={!input || loading}
          onClick={handleTranslate}
        >
          {loading ? "Translating..." : "Translate"}
        </button>
        {output && (
          <div className="mt-4 p-3 bg-gray-100 rounded text-indigo-800 border border-indigo-400/20">
            <b>English:</b> {output}
          </div>
        )}
      </div>
    </div>
  );
}
