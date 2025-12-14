# JobAgent

AI-powered job search agent that matches your resume to the right opportunities.

> "Yesterday is history, tomorrow is a mystery, today is a gift. That's why it's called the present." — Master Oogway

## Overview

JobAgent helps job seekers find positions that actually match their experience. Upload your resume and get job recommendations based on:

- **Role Alignment** — Matches jobs to the roles you've held throughout your career
- **Experience Level** — Considers your years in specific role types (not just total experience), making it ideal for career pivoters
- **Skills Match** — Analyzes the content of your resume against job requirements

## Features

- Upload resumes in PDF, DOCX, or TXT format
- Real job listings via JSearch API
- Smart categorization: "Recommended" (90%+ confidence) and "Worth Exploring" (70-89%)
- Privacy-focused: uploaded files are deleted after processing
- Dark theme UI inspired by candycode.com

## Tech Stack

- **Backend:** Node.js, Express 5
- **Frontend:** EJS templates, Tailwind CSS v4
- **File Parsing:** pdf-parse, pdf2json, mammoth
- **Job Data:** JSearch API (RapidAPI)

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/jagent.git
cd jagent

# Install dependencies
npm install

# Build CSS
npm run build
```

### Configuration

Create a `.env` file in the project root:

```env
PORT=3001
JSEARCH_API_KEY=your_jsearch_api_key_here
```

Get your JSearch API key from [RapidAPI](https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch).

### Running the App

**Development mode** (with hot reload):

```bash
npm run dev
```

**Production mode:**

```bash
npm start
```

Visit `http://localhost:3001` in your browser.

## Project Structure

```
jagent/
├── src/
│   ├── server.js              # Express server and routes
│   ├── services/
│   │   ├── resumeParser.js    # PDF/DOCX/TXT parsing
│   │   ├── jobSearch.js       # JSearch API integration
│   │   └── jobMatcher.js      # Job matching algorithm
│   ├── views/
│   │   ├── welcome.ejs        # Landing page
│   │   ├── upload.ejs         # Resume upload page
│   │   ├── results.ejs        # Job matches display
│   │   ├── error.ejs          # Error page
│   │   └── partials/
│   │       └── jobCard.ejs    # Job card component
│   └── public/
│       └── css/
│           ├── input.css      # Tailwind source
│           └── output.css     # Compiled CSS
├── uploads/                   # Temporary file storage (auto-cleaned)
├── package.json
└── .env
```

## API Routes

| Method | Route     | Description                      |
|--------|-----------|----------------------------------|
| GET    | /         | Welcome page                     |
| GET    | /upload   | Resume upload page               |
| POST   | /analyze  | Process resume and show results  |

## How Job Matching Works

The matching algorithm uses weighted scoring:

- **40%** Role alignment — How well the job title matches your career path
- **35%** Experience level — Whether the required experience matches your time in similar roles
- **25%** Content match — Skills and keywords from your resume vs job description

Jobs are categorized as:
- **Recommended** — 90-95% confidence score
- **Worth Exploring** — 70-89% confidence score

## License

ISC
