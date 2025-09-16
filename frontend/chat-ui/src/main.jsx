import React from 'react'
import ReactDOM from 'react-dom/client'
// Amplify resolves to the real library when installed, otherwise a local stub via Vite aliasing.
import { Amplify } from 'aws-amplify'
import App from './App.jsx'
import './index.css'

// Amplify configuration - initialize before any components
const amplifyConfig = {
  API: {
    GraphQL: {
      endpoint: import.meta.env.VITE_AMPLIFY_GRAPHQL_ENDPOINT,
      region: import.meta.env.VITE_AMPLIFY_REGION || 'us-east-1',
      defaultAuthMode: 'apiKey',
      apiKey: import.meta.env.VITE_AMPLIFY_API_KEY
    }
  },
  Auth: {
    Cognito: {
      userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
      userPoolClientId: import.meta.env.VITE_COGNITO_CLIENT_ID,
      loginWith: {
        oauth: {
          domain: import.meta.env.VITE_COGNITO_DOMAIN,
          scopes: ['openid', 'email', 'profile'],
          redirectSignIn: [import.meta.env.VITE_REDIRECT_SIGN_IN || 'https://fruitful-chat.com/'],
          redirectSignOut: [import.meta.env.VITE_REDIRECT_SIGN_OUT || 'https://fruitful-chat.com/'],
          responseType: 'code'
        }
      }
    }
  }
}

// Configure Amplify before rendering
Amplify.configure(amplifyConfig)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
