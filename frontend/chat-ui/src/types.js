/**
 * Represents a single chat message.
 * @typedef {Object} Message
 * @property {string} id - Unique identifier for the message.
 * @property {string} [role] - Role associated with the message sender.
 * @property {string} [sender] - Alternative field for the sender.
 * @property {string} [from] - Original sender of the message.
 * @property {string} [to] - Intended recipient of the message.
 * @property {string} [type] - Type of message, e.g. 'text' or 'file'.
 * @property {string} [content] - Textual content of the message.
 * @property {string} [message] - Alternate field for message content.
 * @property {{path:string,originalname:string}} [file] - File metadata when type is 'file'.
 * @property {number} [timestamp] - Unix epoch timestamp for when the message was created.
 */

/**
 * Represents a chat conversation.
 * @typedef {Object} Conversation
 * @property {string} id - Unique identifier for the conversation.
 * @property {string} title - Display title of the conversation.
 * @property {boolean} [pinned] - Whether the conversation is pinned in the sidebar.
 */

export {};
