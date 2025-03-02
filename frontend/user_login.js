import { useState, useEffect } from "react";
import axios from "axios";

export default function AuthPage() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [message, setMessage] = useState("");
  const [key, setKey] = useState("");
  const [keyMessage, setKeyMessage] = useState("");
  const [users, setUsers] = useState([]);
  const [keys, setKeys] = useState([]);
  const [adminView, setAdminView] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      setAdminView(true);
      fetchUsers();
      fetchKeys();
    }
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleLogin = async () => {
    try {
      const res = await axios.post("http://localhost:5000/auth/login", form);
      localStorage.setItem("token", res.data.token);
      setMessage("Login successful!");
      setAdminView(true);
      fetchUsers();
      fetchKeys();
    } catch (error) {
      setMessage("Login failed. Check credentials.");
    }
  };

  const handleKeyValidation = async () => {
    try {
      const res = await axios.post("http://localhost:5000/keys/validate-key", { key });
      setKeyMessage("Key validated successfully!");
    } catch (error) {
      setKeyMessage("Invalid or expired key.");
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await axios.get("http://localhost:5000/admin/users");
      setUsers(res.data);
    } catch (error) {
      console.error("Failed to fetch users");
    }
  };

  const fetchKeys = async () => {
    try {
      const res = await axios.get("http://localhost:5000/admin/keys");
      setKeys(res.data);
    } catch (error) {
      console.error("Failed to fetch keys");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      {!adminView ? (
        <>
          <h1 className="text-2xl mb-4">Login</h1>
          <input
            type="email"
            name="email"
            placeholder="Email"
            className="border p-2 mb-2"
            onChange={handleChange}
          />
          <input
            type="password"
            name="password"
            placeholder="Password"
            className="border p-2 mb-2"
            onChange={handleChange}
          />
          <button className="bg-blue-500 text-white p-2 rounded" onClick={handleLogin}>
            Login
          </button>
          {message && <p className="mt-2">{message}</p>}
        </>
      ) : (
        <div className="w-3/4">
          <h1 className="text-2xl mb-4">Admin Dashboard</h1>
          <h2 className="text-xl mb-2">User List</h2>
          <ul className="border p-4">
            {users.map((user) => (
              <li key={user._id}>{user.email} - {user.role}</li>
            ))}
          </ul>
          <h2 className="text-xl mt-4 mb-2">Issued Keys</h2>
          <ul className="border p-4">
            {keys.map((keyItem) => (
              <li key={keyItem._id}>{keyItem.key} - {keyItem.expiresAt}</li>
            ))}
          </ul>
          <h2 className="text-xl mt-4 mb-2">Validate Key</h2>
          <input
            type="text"
            name="key"
            placeholder="Enter Key"
            className="border p-2 mb-2"
            onChange={(e) => setKey(e.target.value)}
          />
          <button className="bg-green-500 text-white p-2 rounded" onClick={handleKeyValidation}>
            Validate Key
          </button>
          {keyMessage && <p className="mt-2">{keyMessage}</p>}
        </div>
      )}
    </div>
  );
}