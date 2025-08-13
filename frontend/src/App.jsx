import React, { useState } from 'react';
import RegistrationForm from './components/RegistrationForm';
import OTPVerifyForm from './components/OTPVerifyForm';

function App() {
  const [registeredEmail, setRegisteredEmail] = useState('');

  return (
    <div>
      {!registeredEmail ? (
        <RegistrationForm onRegistered={setRegisteredEmail} />
      ) : (
        <OTPVerifyForm email={registeredEmail} />
      )}
    </div>
  );
}

export default App;