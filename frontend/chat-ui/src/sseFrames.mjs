export async function readFrames(reader, events, isClosed) {
  const decoder = new TextDecoder();
  let buffer = '';
  const frame = { type: 'message', data: [], size: 0 };
  while (!isClosed()) {
    const result = await reader.read();
    if (isClosed() || result.done) break;
    buffer += decoder.decode(result.value, { stream: true });
    buffer = consumeLines(buffer, frame, events, isClosed);
    checkSize(buffer.length + frame.size);
  }
}


function parseLine(frame, line, events) {
  if (!line) {
    if (frame.data.length) events.dispatchEvent(new MessageEvent(frame.type, { data: frame.data.join('\n') }));
    frame.type = 'message'; frame.data = []; frame.size = 0;
  } else if (line.startsWith('event:')) frame.type = line.slice(6).replace(/^ /, '') || 'message';
  else if (line.startsWith('data:')) { frame.data.push(line.slice(5).replace(/^ /, '')); frame.size += line.length; }
}

function lineEnd(buffer) {
  const end = buffer.search(/[\r\n]/);
  return end < 0 || (buffer[end] === '\r' && end === buffer.length - 1) ? -1 : end;
}

function consumeLines(buffer, frame, events, isClosed) {
  while (!isClosed()) {
    const end = lineEnd(buffer);
    if (end < 0) break;
    const line = buffer.slice(0, end);
    checkSize(frame.size + line.length);
    const width = buffer[end] === '\r' && buffer[end + 1] === '\n' ? 2 : 1;
    buffer = buffer.slice(end + width);
    parseLine(frame, line, events);
  }
  return buffer;
}

function checkSize(size) {
  if (size > 1024 * 1024) throw new RangeError('Stream frame too large');
}
