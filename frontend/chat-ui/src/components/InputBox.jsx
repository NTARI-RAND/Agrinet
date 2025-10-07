import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { post } from '../api';

export default function InputBox() {
  const { state, dispatch } = useStore();
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [fileData, setFileData] = useState('');
  const [pending, setPending] = useState(false);
  const fileInputRef = useRef();
  const physicsRef = useRef({ current: 1, velocity: 0, target: 1 });
  const frameRef = useRef();
  const [sendScale, setSendScale] = useState(1);
  const timeoutRef = useRef();

  useEffect(() => {
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const animateTo = (target) => {
    physicsRef.current.target = target;
    if (frameRef.current) return;

    const step = () => {
      const physics = physicsRef.current;
      const displacement = physics.target - physics.current;
      physics.velocity += displacement * 0.18;
      physics.velocity *= 0.72;
      physics.current += physics.velocity;
      if (Math.abs(physics.velocity) < 0.001 && Math.abs(displacement) < 0.001) {
        physics.current = physics.target;
        physics.velocity = 0;
        frameRef.current = undefined;
        setSendScale(physics.current);
        return;
      }
      setSendScale(physics.current);
      frameRef.current = requestAnimationFrame(step);
    };

    frameRef.current = requestAnimationFrame(step);
  };

  const send = async () => {
    if (!state.currentConversation || (!text && !file) || pending) return;
    setPending(true);
    try {
      const id = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();
      const payload = {
        id,
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
      await post(`/messages/${state.currentConversation.id}`, payload);
      dispatch({ type: 'ADD_MESSAGE', message: payload });
      setText('');
      setFile(null);
      setFileData('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      dispatch({ type: 'SET_AI_THINKING', value: true });
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
    <div className="input-row">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={(e) => handleFile(e.target.files[0])}
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        className="micro-icon"
        title="Attach"
        disabled={pending}
      >
        📎
      </button>
      {file && (
        <span className="text-sm text-[var(--color-muted)]" title={file.name}>
          {file.name}
        </span>
      )}
      <button
        onClick={voice}
        className="micro-icon"
        title="Voice input"
        disabled={pending}
      >
        🗣
      </button>
      <textarea
        className=""
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
      <button
        onClick={send}
        className="farm-button"
        title="Send"
        disabled={pending}
        style={{ transform: `scale(${sendScale.toFixed(3)})` }}
        onPointerDown={() => animateTo(0.9)}
        onPointerUp={() => {
          animateTo(1.05);
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          timeoutRef.current = setTimeout(() => animateTo(1), 140);
        }}
        onPointerLeave={() => animateTo(1)}
      >
        🚜 Send
      </button>
    </div>
  );
}
