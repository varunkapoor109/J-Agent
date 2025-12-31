const express = require('express');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
require('dotenv').config();

// Services
const resumeParser = require('./services/resumeParser');
const jobSearch = require('./services/jobSearch');
const jobMatcher = require('./services/jobMatcher');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, DOCX, and TXT files are allowed.'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ============================================
// ROUTES
// ============================================

// Home/Welcome page
app.get('/', (req, res) => {
  res.render('welcome');
});

// Upload page
app.get('/upload', (req, res) => {
  res.render('upload');
});

// Analyze resume and find jobs
app.post('/analyze', upload.single('resume'), async (req, res) => {
  try {
    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).render('error', {
        message: 'Please upload a resume file',
        error: {}
      });
    }

    console.log('Processing resume:', req.file.originalname);

    // Step 1: Parse the resume
    const resumeData = await resumeParser.parse(req.file.path);
    console.log('Resume parsed:', {
      roles: resumeData.roles.length,
      skills: resumeData.skills.technical.length,
      primaryRole: resumeData.primaryRole?.title,
      totalYears: resumeData.totalYearsExperience
    });
    // Debug: Show extracted text preview
    console.log('--- RAW TEXT PREVIEW (first 500 chars) ---');
    console.log(resumeData.rawText?.substring(0, 500));
    console.log('--- END PREVIEW ---');

    // Step 2: Search for relevant jobs
    const jobs = await jobSearch.searchJobs(resumeData);
    console.log('Jobs found:', jobs.length);

    // Step 3: Match and categorize jobs
    const matchedJobs = jobMatcher.matchJobs(resumeData, jobs);
    console.log('Matched:', {
      recommended: matchedJobs.recommended.length,
      worthExploring: matchedJobs.worthExploring.length
    });

    // Clean up uploaded file (privacy)
    fs.unlink(req.file.path, (err) => {
      if (err) console.error('Error deleting file:', err);
    });

    // Render results page
    res.render('results', {
      resumeData,
      recommended: matchedJobs.recommended,
      worthExploring: matchedJobs.worthExploring,
      totalJobs: matchedJobs.all.length
    });

  } catch (error) {
    console.error('Error analyzing resume:', error);

    // Clean up uploaded file on error
    if (req.file?.path) {
      fs.unlink(req.file.path, () => {});
    }

    res.status(500).render('error', {
      message: 'We had trouble analyzing your resume. Please try again with a different file.',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
});

// API endpoint for job details (optional AJAX support)
app.get('/api/job/:id', (req, res) => {
  // For future use - could store job details in session and retrieve here
  res.json({ error: 'Not implemented' });
});

// ============================================
// ERROR HANDLERS
// ============================================

// Multer error handling
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).render('error', {
        message: 'File is too large. Maximum size is 5MB.',
        error: {}
      });
    }
  }
  next(err);
});

// General error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('error', {
    message: err.message || 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).render('error', {
    message: 'Page not found',
    error: {}
  });
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════════════╗
  ║                                           ║
  ║   🌟 JobAgent is running!                 ║
  ║                                           ║
  ║   Local: http://localhost:${PORT}            ║
  ║                                           ║
  ║   "Today is a gift"                       ║
  ║                                           ║
  ╚═══════════════════════════════════════════╝

  Routes:
  • GET  /         - Welcome page
  • GET  /upload   - Resume upload page
  • POST /analyze  - Process resume & show results
  `);
});

module.exports = app;
