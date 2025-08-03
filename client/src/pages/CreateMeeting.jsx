import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';

const CreateMeeting = () => {
  const [meetingLink, setMeetingLink] = useState('');
  const navigate = useNavigate();

  const handleCreateMeeting = () => {
    const meetingId = uuidv4();
    const link = `${window.location.origin}/meeting/${meetingId}`;
    setMeetingLink(link);
    navigate(`/meeting/${meetingId}`);
  };

  const handleCopy = () => {
    if (meetingLink) {
      navigator.clipboard.writeText(meetingLink);
      alert('Meeting link copied!');
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 px-4">
      <h1 className="text-3xl font-bold mb-6">Create a New Meeting</h1>
      <button
        onClick={handleCreateMeeting}
        className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition"
      >
        ➕ Create Meeting
      </button>
      {meetingLink && (
        <div className="mt-8 bg-white p-4 rounded shadow-md w-full max-w-md">
          <p className="text-gray-700 mb-2">Meeting Link:</p>
          <div className="flex items-center justify-between">
            <span className="text-blue-600 break-all">{meetingLink}</span>
            <button
              onClick={handleCopy}
              className="ml-2 bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600"
            >
              📋 Copy
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateMeeting;