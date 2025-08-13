// const express = require('express');
// const router = express.Router();
// const User = require('../models/user'); // Ensure path is correct

// // GET /users - fetch all users, omit sensitive data
// router.get('/', async (req, res) => {
//   try {
//     const users = await User.find({}, '-password'); // omit password field
//     res.json(users);
//   } catch (err) {
//     console.error("Error fetching users:", err);
//     res.status(500).json({ error: "Failed to fetch users" });
//   }
// });

// // POST /users - create a new user
// router.post('/', async (req, res) => {
//   try {
//     const newUser = await User.create(req.body);
//     res.status(201).json({ message: "User created", user: newUser });
//   } catch (err) {
//     console.error("User creation error:", err);
//     res.status(400).json({ error: err.message });
//   }
// });

// router.get('/', async (req, res) => {
//   try {
//     const query = {};
//     if (req.query.role) query.role = req.query.role;
//     if (req.query.location) query.location = req.query.location;

//     const users = await User.find(query, '-password');
//     res.json(users);
//   } catch (err) {
//     res.status(500).json({ error: "Failed to fetch filtered users" });
//   }
// });

// module.exports = router;

const express = require('express');
const router = express.Router();
const userController = require('../controllers/user_controller');

// In-memory registration and verification endpoints
router.post('/register', userController.registerUser);
router.post('/verify', userController.verifyUser);

module.exports = router;
