import React from 'react';
import MessageActions from './MessageActions.jsx';

/** @typedef {import('../types').Message} Message */

/**
 * Displays a single chat message.
 * @param {{message: Message}} props
 */
export default function MessageBubble({ message, index = 0 }) {
  const isUser = message.role === 'user' || message.sender === 'user' || message.from === 'user';
  const alignment = isUser ? 'items-end text-right' : 'items-start text-left';
  const bubbleClass = `message-bubble ${isUser ? 'user' : 'assistant'}`;
  const style = {
    animationDelay: `${Math.min(index, 12) * 70}ms`,
  };

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
    <div className={`message-row relative flex ${alignment} group`} style={style}>
      {!isUser && <MessageActions message={message} className="message-actions" />}
      <div className={bubbleClass}>
        {content}
      </div>
    </div>
  );
}
