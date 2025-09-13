import { promises as dns } from 'node:dns';
import net from 'node:net';
import { URL } from 'node:url';
import awsExports from './aws-exports.js';

// Simple GraphQL query used to verify the connection
const query = /* GraphQL */ `
  query TestConnection {
    __typename
  }
`;

// Check whether the API host is reachable before attempting a fetch
const canReachHost = async (endpoint) => {
  try {
    const { hostname, port } = new URL(endpoint);
    await dns.lookup(hostname);

    return await new Promise((resolve) => {
      const socket = net.connect({ host: hostname, port: Number(port) || 443, timeout: 1000 }, () => {
        socket.end();
        resolve(true);
      });

      socket.on('error', () => {
        socket.destroy();
        resolve(false);
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });
    });
  } catch (err) {
    console.warn('DNS lookup failed:', err.code);
    return false;
  }
};

// Test the connection by posting a GraphQL request
const testAPI = async () => {
  console.log('API Endpoint:', awsExports.aws_appsync_graphqlEndpoint);
  console.log('API Key configured:', !!awsExports.aws_appsync_apiKey);

  if (!(await canReachHost(awsExports.aws_appsync_graphqlEndpoint))) {
    console.warn('Network is unreachable. Skipping API call.');
    return;
  }

  try {
    const response = await fetch(awsExports.aws_appsync_graphqlEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': awsExports.aws_appsync_apiKey,
      },
      body: JSON.stringify({ query }),
    });

    const result = await response.json();
    console.log('Response status:', response.status);
    console.log('Response keys:', Object.keys(result));
    console.log('\u2705 Frontend successfully connected to backend!');
  } catch (error) {
    console.error('\u274c Connection failed:', error.message);
  }
};

testAPI();
