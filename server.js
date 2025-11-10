import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { db, init } from './db.js';
import dotenv from 'dotenv';
import morgan from 'morgan';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';

init();

app.use(helmet());
app.use(cors({ origin: '*'}));
app.use(express.json());
app.use(morgan('dev'));
// Simple request logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Health
app.get('/health', (req, res) => res.json({ ok: true }));

// Auth: register
app.post('/auth/register', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  const password_hash = bcrypt.hashSync(password, 10);
  const now = new Date().toISOString();
  db.run('INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)', [email, password_hash, now], function(err) {
    if (err) {
      if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Email already registered' });
      return res.status(500).json({ error: 'DB error' });
    }
    const token = jwt.sign({ id: this.lastID, email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token });
  });
});

// Auth: login
app.post('/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    if (!row) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = bcrypt.compareSync(password, row.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: row.id, email: row.email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token });
  });
});

// Todos CRUD
app.get('/todos', auth, (req, res) => {
  db.all('SELECT id, title, done, created_at FROM todos WHERE user_id = ? ORDER BY id DESC', [req.user.id], (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.json(rows.map(r => ({ id: r.id, title: r.title, done: !!r.done, createdAt: r.created_at })));
  });
});

app.post('/todos', auth, (req, res) => {
  const { title } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });
  const now = new Date().toISOString();
  db.run('INSERT INTO todos (user_id, title, done, created_at) VALUES (?, ?, ?, ?)', [req.user.id, title, 0, now], function(err) {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.status(201).json({ id: this.lastID, title, done: false, createdAt: now });
  });
});

app.patch('/todos/:id', auth, (req, res) => {
  const id = Number(req.params.id);
  const { title, done } = req.body;
  db.get('SELECT * FROM todos WHERE id = ? AND user_id = ?', [id, req.user.id], (err, row) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    if (!row) return res.status(404).json({ error: 'Not found' });
    const newTitle = title ?? row.title;
    const newDone = typeof done === 'boolean' ? (done ? 1 : 0) : row.done;
    db.run('UPDATE todos SET title = ?, done = ? WHERE id = ?', [newTitle, newDone, id], function(updateErr) {
      if (updateErr) return res.status(500).json({ error: 'DB error' });
      res.json({ id, title: newTitle, done: !!newDone, createdAt: row.created_at });
    });
  });
});

app.delete('/todos/:id', auth, (req, res) => {
  const id = Number(req.params.id);
  db.run('DELETE FROM todos WHERE id = ? AND user_id = ?', [id, req.user.id], function(err) {
    if (err) return res.status(500).json({ error: 'DB error' });
    if (this.changes === 0) return res.status(404).json({ error: 'Not found' });
    res.status(204).send();
  });
});

app.listen(PORT, () => console.log(`API listening on http://localhost:${PORT}`));
