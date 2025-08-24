const { enqueueSms } = require('../bull/smsQueue');
const language = require('../utils/languageProcessor');
const agriInfo = require('../models/agriInfo');

const handleIncomingSMS = async (req, res) => {
  const { Body, From } = req.body;
  const normalized = language.normalize(Body);
  const [command, ...rest] = normalized.split(' ');
  const target = rest.join(' ');
  let reply;

  if (command === 'price') {
    const price = await agriInfo.getPrice(target);
    reply = price ? `Current price of ${target}: ${price}` : `No price data for ${target}`;
  } else if (command === 'help') {
    reply = 'Commands: PRICE <crop>';
  } else {
    reply = 'Unknown command. Send HELP for options.';
  }

  await enqueueSms(From, reply);
  res.status(200).send('OK');
};

const handleStatusCallback = (req, res) => {
  const { MessageSid, MessageStatus } = req.body;
  console.log(`SMS ${MessageSid} status: ${MessageStatus}`);
  res.status(200).end();
};

module.exports = { handleIncomingSMS, handleStatusCallback };
