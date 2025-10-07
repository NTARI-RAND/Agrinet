import React, { useEffect, useRef, useState } from 'react';

const MESSAGES = [
  'Preparing crop insights…',
  'Mapping soil data for accuracy…',
  'Forecasting weather windows…',
  'Rotating strategies for resilience…',
];

const RATE = 100; // characters per second

export default function ThinkingTicker({ active }) {
  const [display, setDisplay] = useState('');
  const frameRef = useRef(0);
  const phraseRef = useRef(0);
  const bufferRef = useRef('');
  const startRef = useRef(null);

  useEffect(() => {
    if (!active) {
      setDisplay('');
      cancelAnimationFrame(frameRef.current);
      startRef.current = null;
      return () => {};
    }

    bufferRef.current = MESSAGES[phraseRef.current % MESSAGES.length];
    setDisplay('');
    let lastLength = 0;

    const step = (time) => {
      if (!startRef.current) startRef.current = time;
      const elapsed = (time - startRef.current) / 1000;
      const allowed = Math.floor(elapsed * RATE);
      if (allowed !== lastLength) {
        const slice = bufferRef.current.slice(0, allowed);
        setDisplay(slice);
        lastLength = slice.length;
      }

      if (lastLength >= bufferRef.current.length) {
        phraseRef.current = (phraseRef.current + 1) % MESSAGES.length;
        bufferRef.current = MESSAGES[phraseRef.current];
        startRef.current = time + 500;
        lastLength = 0;
      }

      frameRef.current = requestAnimationFrame(step);
    };

    frameRef.current = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(frameRef.current);
      startRef.current = null;
    };
  }, [active]);

  if (!active || !display) return null;

  return (
    <div className="thinking-indicator" role="status" aria-live="polite">
      <svg viewBox="0 0 24 24">
        <path d="M12 3v3m0 12v3M4.6 6.6l2.1 2.1m10.6 10.6 2.1 2.1M3 12h3m12 0h3M6.7 17.3l-2.1 2.1m14.8-12.8-2.1 2.1" />
      </svg>
      <span>{display}</span>
    </div>
  );
}
