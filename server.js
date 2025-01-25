const express = require('express');
const cors = require('cors');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

const bodyParser = require('body-parser');

const bcrypt = require('bcrypt');
const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
// ... existing imports ...
require('dotenv').config();

// Replace the serviceAccount initialization with environment variables
const serviceAccount = {
  type: process.env.FIREBASE_TYPE,
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: process.env.FIREBASE_AUTH_URI,
  token_uri: process.env.FIREBASE_TOKEN_URI,
  auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
  client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
  universe_domain: process.env.FIREBASE_UNIVERSE_DOMAIN
};

// Initialize Firebase Admin SDK with the environment variables
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://nissan-58a39-default-rtdb.firebaseio.com/'
});

// ... rest of your server code ...

const db = admin.firestore();


app.use(bodyParser.json());
// Store data in memory
let data = [];

// Middleware
app.use(cors({
  origin: ['https://nissan-frontend.onrender.com'], // Add your frontend URL
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));

app.use(express.json());

// Load CSV data
const loadData = () => {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(path.join(__dirname, 'Test Try 2.csv'))
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => {
        resolve(results);
      })
      .on('error', (error) => reject(error));
  });
};

// Routes
app.get('/data', async (req, res) => {
  try {
    // Return the data stored in memory instead of fetching it again
    console.log('Sample data:', data.slice(0, 5));
    res.json(data);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});

app.get('/feedback/:model', (req, res) => {
  const { model } = req.params;
  const modelFeedback = data.filter(item => 
    item.model?.toLowerCase() === model?.toLowerCase()
  );
  res.json(modelFeedback);
});
// Update the feedback details route
app.get('/feedback/details/:model/:index/:date', (req, res) => {
  const { model, index, date } = req.params;
  try {
    // Convert the date format if needed
    const formattedDate = date.split('-').reverse().join('-'); // Convert DD-MM-YYYY to YYYY-MM-DD if needed
    
    const modelFeedback = data.filter(item => 
      item.model?.toLowerCase() === model?.toLowerCase() && 
      item.date === date // Use the original date format from your data
    );

    if (!modelFeedback.length) {
      return res.status(404).json({ error: 'Feedback not found' });
    }

    const selectedFeedback = modelFeedback[parseInt(index)];
    
    if (!selectedFeedback) {
      return res.status(404).json({ error: 'Feedback index not found' });
    }

    res.json(selectedFeedback);
  } catch (error) {
    console.error('Error fetching feedback details:', error);
    res.status(500).json({ error: 'Failed to fetch feedback details' });
  }
});
// ... existing code ...

// Add both routes to handle the detailed summary
app.get(['/detailed-summary', '/api/detailed-summary'], (req, res) => {
  const { category, models, date, brand } = req.query;
  
  console.log('Received request with params:', { category, models, date, brand });
  
  try {
    if (!category || !models || !date || !brand) {
      console.log('Missing parameters:', { category, models, date, brand });
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const modelsList = models.split(',').filter(model => model); // Remove empty strings
    
    console.log('Filtering with models:', modelsList);
    
    const summaryData = data.filter(item => 
      modelsList.includes(item.model) &&
      item.date === date &&
      item.brand === brand &&
      item.fact === category
    );

    console.log(`Found ${summaryData.length} matching records`);

    if (!summaryData.length) {
      return res.status(404).json({ error: 'No data found for the specified criteria' });
    }
    
    res.json(summaryData);
  } catch (error) {
    console.error('Error fetching detailed summary:', error);
    res.status(500).json({ error: 'Failed to fetch detailed summary' });
  }
});

// ... existing code ...
// Sign-up endpoint
app.post('/signup', async (req, res) => {
  const { username, email, password } = req.body;
  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Save user data to Firestore
    await db.collection('users').doc(email).set({
      username,
      email,
      password: hashedPassword
    });

    res.status(201).json({ message: 'User signed up successfully!' });
  } catch (error) {
    console.error('Error signing up user:', error);
    res.status(500).json({ message: 'Failed to sign up user!' });
  }
});

// Sign-in endpoint
app.post('/signin', async (req, res) => {
  const { email, password } = req.body;
  try {
    const userSnapshot = await db.collection('users').doc(email).get();
    if (!userSnapshot.exists) {
      return res.status(404).json({ message: 'User not found!' });
    }
    const user = userSnapshot.data();
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ message: 'Invalid credentials!' });
    }
    res.status(200).json({ message: 'User signed in successfully!', user });
  } catch (error) {
    console.error('Error signing in user:', error);
    res.status(500).json({ message: 'Failed to sign in!' });
  }
});

app.get('/feedback/:model/:feature/:sentiment', (req, res) => {
  const { model, feature, sentiment } = req.params;
  const feedbackData = data.filter(item => 
    item.model?.toLowerCase() === model?.toLowerCase() &&
    item.Feature === feature &&
    item.fact === sentiment
  );
  
  if (!feedbackData.length) {
    return res.status(404).json({ error: 'Feedback not found' });
  }
  
  res.json(feedbackData);
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, async () => {
  try {
    data = await loadData();
    console.log(`Server running on port ${PORT}`);
    console.log('Data loaded successfully');
  } catch (error) {
    console.error('Failed to load initial data:', error);
    process.exit(1);
  }
});