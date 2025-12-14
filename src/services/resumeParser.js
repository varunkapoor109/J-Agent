const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const PDFParser = require('pdf2json');
const mammoth = require('mammoth');

/**
 * Resume Parser Service
 * Extracts structured information from resume files (PDF, DOCX, TXT)
 */

class ResumeParser {
  constructor() {
    // Common job titles/roles to identify
    this.roleTitles = [
      // Engineering
      'software engineer', 'senior software engineer', 'staff engineer', 'principal engineer',
      'frontend engineer', 'backend engineer', 'full stack engineer', 'fullstack engineer',
      'devops engineer', 'site reliability engineer', 'sre', 'platform engineer',
      'data engineer', 'machine learning engineer', 'ml engineer', 'ai engineer',
      'qa engineer', 'test engineer', 'automation engineer',
      // Product & Design
      'product manager', 'senior product manager', 'product owner', 'program manager',
      'product designer', 'ux designer', 'ui designer', 'ux/ui designer',
      'graphic designer', 'visual designer', 'interaction designer',
      // Data
      'data scientist', 'data analyst', 'business analyst', 'analytics engineer',
      // Management
      'engineering manager', 'technical lead', 'tech lead', 'team lead',
      'director of engineering', 'vp of engineering', 'cto', 'ceo',
      'project manager', 'scrum master', 'agile coach',
      // Marketing & Sales
      'marketing manager', 'digital marketing', 'content manager', 'seo specialist',
      'sales manager', 'account executive', 'business development',
      // Other
      'consultant', 'analyst', 'specialist', 'coordinator', 'administrator',
      'intern', 'associate', 'junior', 'senior', 'lead', 'head of', 'chief'
    ];

    // Skills to extract
    this.technicalSkills = [
      // Programming Languages
      'javascript', 'typescript', 'python', 'java', 'c++', 'c#', 'go', 'golang', 'rust',
      'ruby', 'php', 'swift', 'kotlin', 'scala', 'r', 'matlab', 'sql',
      // Frontend
      'react', 'reactjs', 'react.js', 'angular', 'vue', 'vuejs', 'vue.js', 'svelte',
      'next.js', 'nextjs', 'nuxt', 'gatsby', 'html', 'css', 'sass', 'scss', 'tailwind',
      // Backend
      'node.js', 'nodejs', 'express', 'django', 'flask', 'fastapi', 'spring', 'spring boot',
      '.net', 'rails', 'laravel', 'graphql', 'rest api', 'microservices',
      // Databases
      'mysql', 'postgresql', 'postgres', 'mongodb', 'redis', 'elasticsearch',
      'dynamodb', 'cassandra', 'sqlite', 'oracle', 'sql server',
      // Cloud & DevOps
      'aws', 'amazon web services', 'azure', 'gcp', 'google cloud',
      'docker', 'kubernetes', 'k8s', 'terraform', 'ansible', 'jenkins',
      'ci/cd', 'github actions', 'gitlab', 'circleci',
      // Data & ML
      'tensorflow', 'pytorch', 'scikit-learn', 'pandas', 'numpy', 'spark',
      'hadoop', 'kafka', 'airflow', 'tableau', 'power bi',
      // Tools
      'git', 'jira', 'confluence', 'figma', 'sketch', 'adobe xd', 'photoshop',
      'agile', 'scrum', 'kanban'
    ];

    // Experience level indicators
    this.seniorityIndicators = {
      entry: ['intern', 'internship', 'junior', 'entry level', 'associate', 'graduate', 'trainee'],
      mid: ['mid-level', 'mid level', 'intermediate', '2+ years', '3+ years', '2-4 years'],
      senior: ['senior', 'sr.', 'lead', 'principal', '5+ years', '6+ years', '7+ years'],
      manager: ['manager', 'director', 'head of', 'vp', 'chief', 'c-level', 'executive']
    };
  }

  /**
   * Parse a resume file and extract structured data
   */
  async parse(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    let text = '';

    try {
      switch (ext) {
        case '.pdf':
          text = await this.parsePDF(filePath);
          break;
        case '.docx':
          text = await this.parseDOCX(filePath);
          break;
        case '.txt':
          text = await this.parseTXT(filePath);
          break;
        default:
          throw new Error(`Unsupported file format: ${ext}`);
      }

      return this.extractInformation(text);
    } catch (error) {
      console.error('Error parsing resume:', error);
      throw error;
    }
  }

  /**
   * Parse PDF file - tries multiple methods
   */
  async parsePDF(filePath) {
    // Method 1: Try pdf-parse first
    try {
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdfParse(dataBuffer);
      // Check if we got meaningful text (not just whitespace)
      const cleanText = data.text.replace(/\s+/g, ' ').trim();
      if (cleanText.length > 50) {
        console.log('PDF parsed with pdf-parse, text length:', cleanText.length);
        return data.text;
      }
    } catch (err) {
      console.log('pdf-parse failed, trying pdf2json:', err.message);
    }

    // Method 2: Try pdf2json as fallback
    return new Promise((resolve, reject) => {
      const pdfParser = new PDFParser();

      pdfParser.on('pdfParser_dataReady', (pdfData) => {
        try {
          // Extract text from all pages
          let text = '';
          if (pdfData.Pages) {
            pdfData.Pages.forEach(page => {
              if (page.Texts) {
                page.Texts.forEach(textItem => {
                  if (textItem.R) {
                    textItem.R.forEach(r => {
                      if (r.T) {
                        text += decodeURIComponent(r.T) + ' ';
                      }
                    });
                  }
                });
                text += '\n';
              }
            });
          }
          console.log('PDF parsed with pdf2json, text length:', text.length);
          resolve(text);
        } catch (err) {
          reject(err);
        }
      });

      pdfParser.on('pdfParser_dataError', (errData) => {
        reject(new Error(errData.parserError));
      });

      pdfParser.loadPDF(filePath);
    });
  }

  /**
   * Parse DOCX file
   */
  async parseDOCX(filePath) {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  }

  /**
   * Parse TXT file
   */
  async parseTXT(filePath) {
    return fs.readFileSync(filePath, 'utf-8');
  }

  /**
   * Extract structured information from resume text
   */
  extractInformation(text) {
    const normalizedText = text.toLowerCase();

    // Extract roles/positions held
    const roles = this.extractRoles(text, normalizedText);

    // Calculate years of experience per role type
    const experienceByRole = this.calculateExperienceByRole(text, roles);

    // Extract skills
    const skills = this.extractSkills(normalizedText);

    // Determine overall seniority level
    const seniorityLevel = this.determineSeniorityLevel(normalizedText, experienceByRole);

    // Extract education (bonus for matching)
    const education = this.extractEducation(normalizedText);

    // Get primary role (most recent or most experienced)
    const primaryRole = this.determinePrimaryRole(roles, experienceByRole);

    return {
      rawText: text,
      roles,
      experienceByRole,
      totalYearsExperience: this.calculateTotalExperience(experienceByRole),
      skills,
      seniorityLevel,
      education,
      primaryRole,
      keywords: this.extractKeywords(text)
    };
  }

  /**
   * Extract job roles/titles from resume
   */
  extractRoles(text, normalizedText) {
    const foundRoles = [];
    const lines = text.split('\n');

    // Look for role patterns
    for (const line of lines) {
      const normalizedLine = line.toLowerCase().trim();

      for (const role of this.roleTitles) {
        if (normalizedLine.includes(role)) {
          // Try to extract the full title and company
          const roleInfo = this.parseRoleLine(line, role);
          if (roleInfo && !foundRoles.some(r => r.title.toLowerCase() === roleInfo.title.toLowerCase())) {
            foundRoles.push(roleInfo);
          }
        }
      }
    }

    // Also look for patterns like "Role at Company" or "Role | Company"
    const rolePatterns = [
      /([A-Z][a-zA-Z\s]+(?:Engineer|Developer|Designer|Manager|Analyst|Scientist|Lead|Director|Specialist|Consultant))\s+(?:at|@|\||-)\s+([A-Za-z0-9\s&.]+)/gi,
      /([A-Z][a-zA-Z\s]+(?:Engineer|Developer|Designer|Manager|Analyst|Scientist|Lead|Director|Specialist|Consultant))\s*[\n,]\s*([A-Za-z0-9\s&.]+)/gi
    ];

    for (const pattern of rolePatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const title = match[1].trim();
        const company = match[2].trim();
        if (!foundRoles.some(r => r.title.toLowerCase() === title.toLowerCase())) {
          foundRoles.push({ title, company, years: null });
        }
      }
    }

    return foundRoles;
  }

  /**
   * Parse a line containing a role to extract details
   */
  parseRoleLine(line, matchedRole) {
    // Clean up the line
    const cleanLine = line.trim();

    // Try to find years (e.g., "2019 - 2023", "2019 - Present")
    const yearPattern = /(\d{4})\s*[-–]\s*(\d{4}|present|current)/i;
    const yearMatch = cleanLine.match(yearPattern);

    let years = null;
    if (yearMatch) {
      const startYear = parseInt(yearMatch[1]);
      const endYear = yearMatch[2].toLowerCase() === 'present' || yearMatch[2].toLowerCase() === 'current'
        ? new Date().getFullYear()
        : parseInt(yearMatch[2]);
      years = endYear - startYear;
    }

    // Extract title (capitalize properly)
    const title = this.capitalizeTitle(matchedRole);

    return { title, years, rawLine: cleanLine };
  }

  /**
   * Capitalize a job title properly
   */
  capitalizeTitle(title) {
    return title.split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  /**
   * Calculate years of experience grouped by role type
   */
  calculateExperienceByRole(text, roles) {
    const experienceMap = {};

    // Parse dates from the resume to calculate experience
    const datePatterns = [
      /(\w+\s+\d{4})\s*[-–]\s*(\w+\s+\d{4}|present|current)/gi,
      /(\d{4})\s*[-–]\s*(\d{4}|present|current)/gi
    ];

    // Group roles by type
    const roleTypes = {
      'Engineering': ['engineer', 'developer', 'architect', 'devops', 'sre'],
      'Product': ['product manager', 'product owner', 'program manager'],
      'Design': ['designer', 'ux', 'ui'],
      'Data': ['data scientist', 'data analyst', 'data engineer', 'ml engineer'],
      'Management': ['manager', 'director', 'lead', 'head of', 'vp', 'chief']
    };

    for (const role of roles) {
      const roleTitle = role.title.toLowerCase();

      for (const [type, keywords] of Object.entries(roleTypes)) {
        if (keywords.some(kw => roleTitle.includes(kw))) {
          if (!experienceMap[type]) {
            experienceMap[type] = { years: 0, roles: [] };
          }
          experienceMap[type].roles.push(role.title);
          if (role.years) {
            experienceMap[type].years += role.years;
          }
        }
      }
    }

    // If we couldn't extract years, estimate from resume length and role count
    for (const type of Object.keys(experienceMap)) {
      if (experienceMap[type].years === 0 && experienceMap[type].roles.length > 0) {
        // Estimate 2 years per role as a fallback
        experienceMap[type].years = experienceMap[type].roles.length * 2;
      }
    }

    return experienceMap;
  }

  /**
   * Calculate total years of experience
   */
  calculateTotalExperience(experienceByRole) {
    let total = 0;
    for (const type of Object.values(experienceByRole)) {
      total += type.years;
    }
    // Account for overlapping roles (rough estimate)
    return Math.min(total, 30); // Cap at 30 years
  }

  /**
   * Extract technical and soft skills
   */
  extractSkills(normalizedText) {
    const foundSkills = {
      technical: [],
      tools: [],
      other: []
    };

    for (const skill of this.technicalSkills) {
      // Use word boundary matching to avoid partial matches
      const regex = new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (regex.test(normalizedText)) {
        foundSkills.technical.push(this.capitalizeTitle(skill));
      }
    }

    // Remove duplicates
    foundSkills.technical = [...new Set(foundSkills.technical)];

    return foundSkills;
  }

  /**
   * Determine seniority level based on resume content
   */
  determineSeniorityLevel(normalizedText, experienceByRole) {
    const totalYears = this.calculateTotalExperience(experienceByRole);

    // Check for explicit indicators
    for (const [level, indicators] of Object.entries(this.seniorityIndicators)) {
      for (const indicator of indicators) {
        if (normalizedText.includes(indicator)) {
          return level;
        }
      }
    }

    // Fall back to years of experience
    if (totalYears <= 2) return 'entry';
    if (totalYears <= 5) return 'mid';
    if (totalYears <= 10) return 'senior';
    return 'manager';
  }

  /**
   * Extract education information
   */
  extractEducation(normalizedText) {
    const degrees = [];
    const degreePatterns = [
      /\b(bachelor'?s?|b\.?s\.?|b\.?a\.?)\b.*?(computer science|engineering|business|design|mathematics|physics)/gi,
      /\b(master'?s?|m\.?s\.?|m\.?a\.?|mba)\b.*?(computer science|engineering|business|design|data science)/gi,
      /\b(ph\.?d\.?|doctorate)\b.*?(computer science|engineering)/gi
    ];

    for (const pattern of degreePatterns) {
      const matches = normalizedText.match(pattern);
      if (matches) {
        degrees.push(...matches.map(m => m.trim()));
      }
    }

    return [...new Set(degrees)];
  }

  /**
   * Determine the primary/target role
   */
  determinePrimaryRole(roles, experienceByRole) {
    if (roles.length === 0) {
      return { type: 'General', title: 'Professional' };
    }

    // Find the role type with most experience
    let maxYears = 0;
    let primaryType = 'General';

    for (const [type, data] of Object.entries(experienceByRole)) {
      if (data.years > maxYears) {
        maxYears = data.years;
        primaryType = type;
      }
    }

    // Get the most recent/senior role of that type
    const recentRole = roles[0]; // Assuming most recent is first

    return {
      type: primaryType,
      title: recentRole?.title || 'Professional',
      yearsInRole: maxYears
    };
  }

  /**
   * Extract important keywords for matching
   */
  extractKeywords(text) {
    const keywords = [];
    const normalizedText = text.toLowerCase();

    // Extract any capitalized words that might be important (company names, technologies)
    const capitalizedPattern = /\b[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*\b/g;
    const capitalizedWords = text.match(capitalizedPattern) || [];

    // Filter out common words
    const commonWords = ['the', 'and', 'for', 'with', 'from', 'this', 'that', 'have', 'been'];
    const filtered = capitalizedWords.filter(word =>
      !commonWords.includes(word.toLowerCase()) && word.length > 2
    );

    return [...new Set(filtered)].slice(0, 50); // Limit to 50 keywords
  }
}

module.exports = new ResumeParser();
