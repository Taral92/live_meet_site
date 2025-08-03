import React, { useState } from "react";

const Controls = ({ peer }) => {
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);

  const toggleTrack = (kind) => {
    const senders = peer.getSenders();
    const track = senders.find((s) => s.track.kind === kind).track;
    track.enabled = !track.enabled;
    kind === "audio" ? setMicOn(track.enabled) : setCamOn(track.enabled);
  };

  return (
    <div className="space-x-4">
      <button onClick={() => toggleTrack("audio")} className="px-4 py-2 bg-gray-700 text-white rounded">
        {micOn ? "Mute" : "Unmute"}
      </button>
      <button onClick={() => toggleTrack("video")} className="px-4 py-2 bg-gray-700 text-white rounded">
        {camOn ? "Stop Video" : "Start Video"}
      </button>
    </div>
  );
};

export default Controls;