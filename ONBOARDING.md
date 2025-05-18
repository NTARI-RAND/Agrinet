# Federation Node Setup Guide

## Welcome to the Fruitful Federation! This guide will walk you through setting up your node, syncing with Mycelium, generating McEliece keys, and providing a UI contract example.

1. Prerequisites
- Node.js (v14+ recommended)
- Git
- Yarn or npm
- Access to the Fruitful repository: https://github.com/NTARI-ForgeLab/Fruitful

2. Clone the Repository
```
bash
git clone https://github.com/NTARI-ForgeLab/Fruitful.git
cd Fruitful
```
3. Install Dependencies
```
bash
# Using yarn
yarn install

# Or using npm

npm install
```
4. Mycelium Sync
Mycelium is the protocol used for synchronizing federation nodes.

a. Configuration
- Locate or create your .env file in the project root.
- Add your node’s configuration, for example:
```
env
MYCELIUM_NODE_NAME=your-node-name
MYCELIUM_PEER_URLS=https://peer1.example.com,https://peer2.example.com
MYCELIUM_PORT=7000
```
b. Start the Mycelium Node
```
bash
yarn mycelium:start

# OR

npm run mycelium:start
```
✅ Ensure logs indicate successful connection to peers.

5. Key Generation (McEliece)
The McEliece cryptosystem is used for secure communication between federation nodes.

a. Generate McEliece Keys
If there is a provided script (e.g., scripts/gen-mceliece.js), run:
```
bash
node scripts/gen-mceliece.js
```
If not, install node-mceliece or another library, and create a script like:
```
js
// scripts/gen-mceliece.js
const mceliece = require('node-mceliece');
const fs = require('fs');

const { publicKey, privateKey } = mceliece.keyPair();
fs.writeFileSync('keys/mceliece_public.key', publicKey);
fs.writeFileSync('keys/mceliece_private.key', privateKey);

console.log('McEliece key pair generated in /keys/');
```
🔒 Add generated keys to your configuration or key directory as required.
📂 Never share your private key.

6. UI Contract Example
A UI contract defines the interaction between the user interface and the federation node’s API.

Example: UI Contract (contracts/uiContract.js)
```
js
/**
 * UI Contract Example
 * Describes methods exposed to the UI for interacting with the federation node.
 */

module.exports = {
  // Authenticate user with McEliece public key
  authenticateUser: async (publicKey) => {
    // implementation
  },

  // Request data sync via Mycelium
  requestSync: async () => {
    // implementation
  },

  // Submit signed transaction to federation
  submitTransaction: async (transaction, signature) => {
    // implementation
  }
};
```
### Integrate with Frontend
- The UI should use these contract methods to interact with the backend (via REST, WebSocket, etc.).
- Ensure authentication and data sync flows use McEliece public keys and Mycelium sync, respectively.

7. Final Steps
- ✅ Test your federation node by running the full stack and verifying connection to at least one peer.
- 🔐 Ensure that the keys are correctly generated and referenced.
- 🔗 Use the UI contract methods in your frontend code integration.

8. Troubleshooting
- 📜 Check logs for errors on startup.
- ⚙️ Verify .env configuration.  
- 🌐 Ensure ports are open and peers are reachable. Use the UI contract methods in your frontend integration

Welcome aboard! 🏁
For questions, open an issue or consult the repository documentation.
