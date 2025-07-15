import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import bodyParser from 'body-parser';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());

const MONGODB_URI = process.env.MONGODB_URI;

mongoose.connect(MONGODB_URI)
  .then(() => console.log('MongoDB connected successfully'))
  .catch(err => console.error('MongoDB connection error:', err));

// Basic root route
app.get('/', (req, res) => {
  res.send('Hello from Grojet Server');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Access: http://localhost:${PORT}`);
});
