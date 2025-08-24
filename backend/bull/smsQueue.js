let Queue, Worker, twilio;
try {
  ({ Queue, Worker } = require('bullmq'));
} catch (e) {
  Queue = class { async add() {} };
  Worker = class {};
}
try {
  twilio = require('twilio');
} catch (e) {
  twilio = () => ({ messages: { create: async () => {} } });
}

const connection = {
  host: 'localhost',
  port: 6379,
  maxRetriesPerRequest: null,
};

const smsQueue = new Queue('sms-outgoing', { connection });

const worker = new Worker(
  'sms-outgoing',
  async job => {
    const { to, body } = job.data;
    if (!process.env.TWILIO_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_FROM_NUMBER) {
      console.log('Twilio credentials missing. Mock send for', to);
      return;
    }
    const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);
    await client.messages.create({
      to,
      from: process.env.TWILIO_FROM_NUMBER,
      body,
      statusCallback: process.env.TWILIO_STATUS_CALLBACK_URL,
    });
  },
  { connection }
);

const enqueueSms = async (to, body) => {
  await smsQueue.add('send', { to, body }, { attempts: 5, backoff: 60 * 1000 });
};

module.exports = { enqueueSms };
