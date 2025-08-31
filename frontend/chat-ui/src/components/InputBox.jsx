import React, { useState, useRef } from 'react';
import { useStore } from '../store';

export default function InputBox() {
  const { state, dispatch } = useStore();
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [fileData, setFileData] = useState('');
  const [pending, setPending] = useState(false);
  const fileInputRef = useRef();

  const send = async () => {
    if (!state.currentConversation || (!text && !file) || pending) return;
    setPending(true);
    try {
      const payload = {
        from: 'user',
        to: 'assistant',
        content: text,
        type: file ? 'file' : 'text',
        timestamp: Date.now(),
      };
      if (file) {
        payload.file = {
          name: file.name,
          type: file.type,
          data: fileData,
        };
      }
      await fetch(`/messages/${state.currentConversation.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': import.meta.env.VITE_API_KEY,
        },
        body: JSON.stringify(payload),
      });
      dispatch({ type: 'ADD_MESSAGE', message: { id: Date.now().toString(), ...payload } });
      setText('');
      setFile(null);
      setFileData('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (e) {
      console.error(e);
    } finally {
      setPending(false);
    }
  };

  const handleFile = (f) => {
    if (!f) return;
    setFile(f);
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(',')[1];
      setFileData(base64);
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsDataURL(f);
  };

  const voice = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const rec = new SpeechRecognition();
    rec.lang = 'en-US';
    rec.onresult = (e) => {
      setText((t) => t + e.results[0][0].transcript);
    };
    rec.start();
  };

  return (
    <div className="p-2 border-t flex items-center space-x-2">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={(e) => handleFile(e.target.files[0])}
      />
      <button onClick={() => fileInputRef.current?.click()} className="p-2" title="Attach" disabled={pending}>
        📎
      </button>
      {file && (
        <span className="text-sm" title={file.name}>{file.name}</span>
      )}
      <button onClick={voice} className="p-2" title="Voice input" disabled={pending}>🎤</button>
      <textarea
        className="flex-1 border rounded p-2"
        rows={1}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            send();
          }
        }}
        aria-label="Chat input"
        disabled={pending}
      />
      <button onClick={send} className="p-2" title="Send" disabled={pending}>
        📨
      </button>
    </div>
  );
}
