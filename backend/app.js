import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import User from './models/User.js';
import Task from './models/Task.js';
import { protect } from './middleware/auth.js';
import { validateTask, validateAuth } from './middleware/validate.js';
import cache from './config/cache.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

const LOG_FILE = path.join(__dirname, 'logs/requests.log.csv');

// Create logs directory if it doesn't exist
if (!fs.existsSync(path.join(__dirname, 'logs'))) {
  fs.mkdirSync(path.join(__dirname, 'logs'), { recursive: true });
}

if (!fs.existsSync(LOG_FILE)) {
  fs.writeFileSync(LOG_FILE, 'Timestamp,Method,URL,IP,StatusCode\n', 'utf8');
}

const escapeCSV = (field) => {
  const str = String(field ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

const appendLogToCSV = (timestamp, method, url, ip, statusCode) => {
  const row = [
    escapeCSV(timestamp),
    escapeCSV(method),
    escapeCSV(url),
    escapeCSV(ip),
    escapeCSV(statusCode)
  ].join(',') + '\n';

  fs.appendFile(LOG_FILE, row, (err) => {
    if (err) console.error('Error writing request log to CSV:', err.message);
  });
};

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/task-manager';

// Connect to MongoDB
mongoose.connect(MONGO_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

app.enable('trust proxy');
app.use(express.json());

// Enable CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Logging Middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';

  res.on('finish', () => {
    const statusCode = res.statusCode;
    console.log(`[${timestamp}] ${req.method} ${req.url} ${ip} - HTTP ${statusCode}`);
    appendLogToCSV(timestamp, req.method, req.url, ip, statusCode);
  });
  next();
});

// Root Health Endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'Task Management API with Authentication is running',
    version: '1.0.0'
  });
});

// --- AUTH ROUTES ---

// POST /api/auth/register
app.post('/api/auth/register', validateAuth, async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const userExists = await User.findOne({ email });
    if (userExists) return res.status(400).json({ error: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ email, password: hashedPassword });
    
    res.status(201).json({ message: 'User registered successfully', userId: user._id });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login
app.post('/api/auth/login', validateAuth, async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });
    
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: 'Invalid email or password' });

    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: '1h' });
    res.status(200).json({ token, user: { id: user._id, email: user.email } });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me
app.get('/api/auth/me', protect, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.status(200).json(user);
  } catch (err) {
    next(err);
  }
});

// --- TASK ROUTES ---
// Protect all task routes
app.use('/api/tasks', protect);

// GET /api/tasks (with server-side in-memory caching using node-cache)
app.get('/api/tasks', async (req, res, next) => {
  try {
    const cacheKey = req.user?.id ? `tasks_${req.user.id}` : 'all_tasks';
    const cached = cache.get(cacheKey);

    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      return res.status(200).json(cached);
    }

    const tasks = await Task.find({ user: req.user.id });
    const responsePayload = { data: tasks };

    // Store in cache with 60s TTL
    cache.set(cacheKey, responsePayload);

    res.setHeader('X-Cache', 'MISS');
    res.status(200).json(responsePayload);
  } catch (err) {
    next(err);
  }
});

// POST /api/tasks
app.post('/api/tasks', validateTask, async (req, res, next) => {
  try {
    const { title, description } = req.body;
    const task = await Task.create({
      title,
      description,
      user: req.user.id
    });

    // Invalidate cache on write
    const cacheKey = req.user?.id ? `tasks_${req.user.id}` : 'all_tasks';
    cache.del(cacheKey);
    cache.del('all_tasks');

    res.status(201).json(task);
  } catch (err) {
    next(err);
  }
});

// PUT /api/tasks/:id
app.put('/api/tasks/:id', async (req, res, next) => {
  try {
    const { title, description, completed } = req.body;
    const task = await Task.findOne({ _id: req.params.id, user: req.user.id });
    if (!task) return res.status(404).json({ error: 'Task not found' });

    if (title !== undefined) task.title = title;
    if (description !== undefined) task.description = description;
    if (completed !== undefined) task.completed = Boolean(completed);

    await task.save();

    // Invalidate cache on update
    const cacheKey = req.user?.id ? `tasks_${req.user.id}` : 'all_tasks';
    cache.del(cacheKey);
    cache.del('all_tasks');

    res.status(200).json(task);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/tasks/:id
app.delete('/api/tasks/:id', async (req, res, next) => {
  try {
    const task = await Task.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!task) return res.status(404).json({ error: 'Task not found' });

    // Invalidate cache on deletion
    const cacheKey = req.user?.id ? `tasks_${req.user.id}` : 'all_tasks';
    cache.del(cacheKey);
    cache.del('all_tasks');

    res.status(200).json({ message: 'Task deleted' });
  } catch (err) {
    next(err);
  }
});

// 404 Handler
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    error: 'Not Found',
    message: `Route ${req.method} ${req.url} not found`
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Error:', err.message || err);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

app.listen(PORT, () => {
  console.log(`Task Management server running on http://localhost:${PORT}`);
});

export default app;
