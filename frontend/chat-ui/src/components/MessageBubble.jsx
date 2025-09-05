import React from 'react';
import MessageActions from './MessageActions.jsx';

/** @typedef {import('../types').Message} Message */

/**
 * Displays a single chat message.
 * @param {{message: Message}} props
 */
export default function MessageBubble({ message }) {
  const isUser = message.role === 'user' || message.sender === 'user' || message.from === 'user';
  const alignment = isUser ? 'items-end text-right' : 'items-start text-left';
  const bg = isUser ? 'bg-blue-500 text-white' : 'bg-gray-200';

  let content;
  if (message.type === 'file' && message.file) {
    content = (
      <a href={message.file.path} target="_blank" rel="noopener noreferrer" className="underline">
        {message.file.originalname}
      </a>
    );
  } else {
    const text = message.content || message.message || '';
    content = <pre className="whitespace-pre-wrap break-words">{text}</pre>;
  }

  return (
    <div className={`relative flex ${alignment} group`}>
      {!isUser && <MessageActions message={message} />}
      <div className={`max-w-xl p-2 rounded shadow ${bg}`}>
        {content}
      </div>
    </div>
  );
}
