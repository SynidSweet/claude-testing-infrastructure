const express = require('express');
const { calculateSum, processData } = require('./utils');
const UserService = require('./services/UserService');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Basic route
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to test API' });
});

// Calculate sum endpoint
app.post('/calculate', (req, res) => {
  const { numbers } = req.body;
  if (!Array.isArray(numbers)) {
    return res.status(400).json({ error: 'Numbers must be an array' });
  }
  
  const sum = calculateSum(numbers);
  res.json({ result: sum });
});

// User endpoints
const userService = new UserService();

app.get('/users', (req, res) => {
  const users = userService.getAllUsers();
  res.json(users);
});

app.post('/users', (req, res) => {
  const { name, email } = req.body;
  try {
    const user = userService.createUser(name, email);
    res.status(201).json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Start server
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;