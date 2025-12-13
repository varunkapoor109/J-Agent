/**
 * Job Matching Service
 *
 * Matches jobs to candidates based on 3 criteria:
 * 1. Role alignment - Does the job title match the candidate's career path?
 * 2. Experience level - Is the required experience realistic for the candidate?
 * 3. Content match - How well do skills and keywords align?
 *
 * Categories:
 * - Recommended (90-95% confidence): Best matches, high success probability
 * - Worth Exploring (70-89% confidence): Good matches, worth applying
 */

class JobMatcher {
  constructor() {
    // Role synonyms for better matching
    this.roleSynonyms = {
      'software engineer': ['developer', 'programmer', 'swe', 'software developer', 'application developer'],
      'frontend engineer': ['frontend developer', 'front-end developer', 'ui developer', 'react developer', 'angular developer'],
      'backend engineer': ['backend developer', 'back-end developer', 'server developer', 'api developer'],
      'full stack engineer': ['fullstack developer', 'full-stack developer', 'full stack developer'],
      'data scientist': ['ml engineer', 'machine learning engineer', 'ai engineer', 'research scientist'],
      'data analyst': ['business analyst', 'analytics specialist', 'bi analyst'],
      'product manager': ['product owner', 'pm', 'program manager'],
      'ux designer': ['product designer', 'ui designer', 'interaction designer', 'user experience designer'],
      'devops engineer': ['sre', 'site reliability engineer', 'platform engineer', 'infrastructure engineer']
    };

    // Experience level requirements (in years)
    this.experienceLevels = {
      'intern': { min: 0, max: 0 },
      'entry': { min: 0, max: 2 },
      'junior': { min: 0, max: 2 },
      'mid': { min: 2, max: 5 },
      'senior': { min: 5, max: 10 },
      'staff': { min: 7, max: 15 },
      'principal': { min: 10, max: 20 },
      'lead': { min: 5, max: 15 },
      'manager': { min: 5, max: 15 },
      'director': { min: 8, max: 20 },
      'vp': { min: 10, max: 25 }
    };
  }

  /**
   * Match jobs to a candidate's resume
   * @param {Object} resumeData - Parsed resume data
   * @param {Array} jobs - Array of job listings
   * @returns {Object} Categorized job matches
   */
  matchJobs(resumeData, jobs) {
    const scoredJobs = jobs.map(job => {
      const scores = this.calculateMatchScore(resumeData, job);
      return {
        ...job,
        matchScore: scores.total,
        scores: scores,
        confidence: this.calculateConfidence(scores)
      };
    });

    // Sort by match score descending
    scoredJobs.sort((a, b) => b.matchScore - a.matchScore);

    // Categorize jobs
    const recommended = scoredJobs.filter(job => job.confidence >= 90 && job.confidence <= 95);
    const worthExploring = scoredJobs.filter(job => job.confidence >= 70 && job.confidence < 90);

    return {
      recommended,
      worthExploring,
      all: scoredJobs
    };
  }

  /**
   * Calculate match score based on 3 criteria
   */
  calculateMatchScore(resumeData, job) {
    // Criterion 1: Role Alignment (40% weight)
    const roleScore = this.calculateRoleScore(resumeData, job);

    // Criterion 2: Experience Level Match (35% weight)
    const experienceScore = this.calculateExperienceScore(resumeData, job);

    // Criterion 3: Content/Skills Match (25% weight)
    const contentScore = this.calculateContentScore(resumeData, job);

    // Weighted total
    const total = (roleScore * 0.40) + (experienceScore * 0.35) + (contentScore * 0.25);

    return {
      role: roleScore,
      experience: experienceScore,
      content: contentScore,
      total: Math.round(total * 100) / 100
    };
  }

  /**
   * Criterion 1: Role Alignment Score
   * Does the job title match the candidate's career path?
   */
  calculateRoleScore(resumeData, job) {
    const jobTitle = job.title.toLowerCase();
    const candidateRoles = resumeData.roles.map(r => r.title.toLowerCase());
    const primaryRole = resumeData.primaryRole?.title?.toLowerCase() || '';

    let score = 0;

    // Check for exact match with primary role
    if (this.titlesMatch(jobTitle, primaryRole)) {
      score = 100;
    }
    // Check for match with any previous role
    else if (candidateRoles.some(role => this.titlesMatch(jobTitle, role))) {
      score = 85;
    }
    // Check for same role family (e.g., frontend engineer -> software engineer)
    else if (this.sameRoleFamily(jobTitle, primaryRole)) {
      score = 70;
    }
    // Check for related role type
    else if (this.relatedRoleType(jobTitle, resumeData.primaryRole?.type)) {
      score = 50;
    }
    // Minimal match
    else {
      score = 20;
    }

    return score;
  }

  /**
   * Check if two job titles effectively match
   */
  titlesMatch(title1, title2) {
    if (!title1 || !title2) return false;

    // Direct match
    if (title1.includes(title2) || title2.includes(title1)) {
      return true;
    }

    // Check synonyms
    for (const [canonical, synonyms] of Object.entries(this.roleSynonyms)) {
      const allVariants = [canonical, ...synonyms];
      const title1Matches = allVariants.some(v => title1.includes(v));
      const title2Matches = allVariants.some(v => title2.includes(v));

      if (title1Matches && title2Matches) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if roles are in the same family
   */
  sameRoleFamily(jobTitle, candidateRole) {
    const families = {
      engineering: ['engineer', 'developer', 'programmer', 'architect'],
      product: ['product manager', 'product owner', 'program manager'],
      design: ['designer', 'ux', 'ui'],
      data: ['data scientist', 'data analyst', 'data engineer', 'ml engineer']
    };

    for (const [family, keywords] of Object.entries(families)) {
      const jobInFamily = keywords.some(kw => jobTitle.includes(kw));
      const candidateInFamily = keywords.some(kw => candidateRole?.includes(kw));

      if (jobInFamily && candidateInFamily) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if job is related to candidate's role type
   */
  relatedRoleType(jobTitle, roleType) {
    if (!roleType) return false;

    const typeKeywords = {
      'Engineering': ['engineer', 'developer', 'technical'],
      'Product': ['product', 'program', 'project'],
      'Design': ['design', 'ux', 'ui', 'creative'],
      'Data': ['data', 'analytics', 'ml', 'ai'],
      'Management': ['manager', 'lead', 'director', 'head']
    };

    const keywords = typeKeywords[roleType] || [];
    return keywords.some(kw => jobTitle.includes(kw));
  }

  /**
   * Criterion 2: Experience Level Score
   * Is the required experience realistic for the candidate?
   *
   * KEY LOGIC: If someone has 8 years total but only 2 in Product Management,
   * don't show them Senior PM roles - show them mid-level PM roles
   */
  calculateExperienceScore(resumeData, job) {
    const jobTitle = job.title.toLowerCase();
    const requiredYears = this.extractRequiredExperience(job);
    const jobLevel = this.extractJobLevel(jobTitle);

    // Get candidate's relevant experience (not total experience!)
    const relevantExperience = this.getRelevantExperience(resumeData, job);
    const candidateLevel = resumeData.seniorityLevel;

    let score = 0;

    // Check if candidate has enough relevant experience
    const levelRequirements = this.experienceLevels[jobLevel] || { min: 0, max: 100 };

    if (relevantExperience >= levelRequirements.min && relevantExperience <= levelRequirements.max + 2) {
      // Perfect fit
      score = 100;
    } else if (relevantExperience >= levelRequirements.min - 1 && relevantExperience <= levelRequirements.max + 3) {
      // Close fit (slight stretch)
      score = 80;
    } else if (relevantExperience < levelRequirements.min) {
      // Under-qualified - penalize based on gap
      const gap = levelRequirements.min - relevantExperience;
      score = Math.max(0, 70 - (gap * 15)); // Lose 15 points per year gap
    } else {
      // Over-qualified
      const gap = relevantExperience - levelRequirements.max;
      score = Math.max(40, 90 - (gap * 10)); // Slight penalty for overqualification
    }

    // Special case: Career pivoters
    // If total experience is high but relevant is low, this is likely a pivot
    if (resumeData.totalYearsExperience > 5 && relevantExperience < 3) {
      // Career pivoter - they should target entry/mid level roles in new field
      if (jobLevel === 'senior' || jobLevel === 'lead' || jobLevel === 'manager') {
        score = Math.min(score, 40); // Cap score for senior roles during pivot
      } else if (jobLevel === 'mid' || jobLevel === 'junior' || jobLevel === 'entry') {
        score = Math.max(score, 70); // Boost for appropriate level roles
      }
    }

    return score;
  }

  /**
   * Get relevant experience for the specific job type
   */
  getRelevantExperience(resumeData, job) {
    const jobTitle = job.title.toLowerCase();
    const experienceByRole = resumeData.experienceByRole;

    // Determine which experience category is relevant
    let relevantYears = 0;

    if (jobTitle.includes('engineer') || jobTitle.includes('developer')) {
      relevantYears = experienceByRole['Engineering']?.years || 0;
    } else if (jobTitle.includes('product manager') || jobTitle.includes('program manager')) {
      relevantYears = experienceByRole['Product']?.years || 0;
    } else if (jobTitle.includes('designer') || jobTitle.includes('ux') || jobTitle.includes('ui')) {
      relevantYears = experienceByRole['Design']?.years || 0;
    } else if (jobTitle.includes('data') || jobTitle.includes('analyst') || jobTitle.includes('ml')) {
      relevantYears = experienceByRole['Data']?.years || 0;
    } else if (jobTitle.includes('manager') || jobTitle.includes('director') || jobTitle.includes('lead')) {
      relevantYears = experienceByRole['Management']?.years || 0;
    } else {
      // Default to total experience
      relevantYears = resumeData.totalYearsExperience;
    }

    return relevantYears;
  }

  /**
   * Extract job level from title
   */
  extractJobLevel(jobTitle) {
    const title = jobTitle.toLowerCase();

    if (title.includes('intern')) return 'intern';
    if (title.includes('junior') || title.includes('jr.') || title.includes('entry')) return 'junior';
    if (title.includes('principal')) return 'principal';
    if (title.includes('staff')) return 'staff';
    if (title.includes('senior') || title.includes('sr.')) return 'senior';
    if (title.includes('lead') || title.includes('tech lead')) return 'lead';
    if (title.includes('manager') && !title.includes('product manager')) return 'manager';
    if (title.includes('director')) return 'director';
    if (title.includes('vp') || title.includes('vice president')) return 'vp';

    // Default to mid-level if no level specified
    return 'mid';
  }

  /**
   * Extract required years of experience from job posting
   */
  extractRequiredExperience(job) {
    const description = (job.description || '').toLowerCase();

    // Look for patterns like "5+ years", "3-5 years", "minimum 4 years"
    const patterns = [
      /(\d+)\+?\s*(?:years?|yrs?)\s*(?:of\s*)?experience/i,
      /(\d+)\s*-\s*(\d+)\s*years?/i,
      /minimum\s*(\d+)\s*years?/i,
      /at least\s*(\d+)\s*years?/i
    ];

    for (const pattern of patterns) {
      const match = description.match(pattern);
      if (match) {
        return parseInt(match[1]);
      }
    }

    // Default based on job level
    const level = this.extractJobLevel(job.title);
    return this.experienceLevels[level]?.min || 2;
  }

  /**
   * Criterion 3: Content/Skills Match Score
   * How well do skills and keywords align?
   */
  calculateContentScore(resumeData, job) {
    const candidateSkills = resumeData.skills.technical.map(s => s.toLowerCase());
    const candidateKeywords = resumeData.keywords.map(k => k.toLowerCase());
    const allCandidateTerms = [...candidateSkills, ...candidateKeywords];

    // Extract skills/requirements from job
    const jobDescription = (job.description || '').toLowerCase();
    const jobTitle = job.title.toLowerCase();
    const jobText = `${jobTitle} ${jobDescription}`;

    // Count matching skills
    let matchedSkills = 0;
    let totalJobSkills = 0;

    // Check each candidate skill against job description
    for (const skill of candidateSkills) {
      if (jobText.includes(skill)) {
        matchedSkills++;
      }
    }

    // Estimate job requirements (rough count of technical terms)
    const technicalTerms = [
      'javascript', 'python', 'java', 'react', 'node', 'aws', 'sql', 'docker',
      'kubernetes', 'agile', 'scrum', 'typescript', 'angular', 'vue', 'go',
      'postgresql', 'mongodb', 'redis', 'graphql', 'rest', 'api', 'ci/cd',
      'figma', 'sketch', 'adobe', 'analytics', 'tableau', 'spark'
    ];

    for (const term of technicalTerms) {
      if (jobText.includes(term)) {
        totalJobSkills++;
      }
    }

    // Calculate score
    if (totalJobSkills === 0) {
      // No specific skills mentioned - be generous
      return candidateSkills.length > 0 ? 75 : 50;
    }

    const matchRatio = matchedSkills / Math.max(totalJobSkills, 1);
    const score = Math.min(100, matchRatio * 120); // Slight boost for high matches

    return Math.round(score);
  }

  /**
   * Calculate confidence percentage for display
   */
  calculateConfidence(scores) {
    // Map the total score (0-100) to confidence ranges
    const total = scores.total;

    // Add some variance for natural distribution
    // Recommended: 90-95%, Worth Exploring: 70-89%
    if (total >= 85) {
      // High scores map to 90-95%
      return Math.min(95, Math.round(90 + (total - 85) * 0.33));
    } else if (total >= 60) {
      // Medium scores map to 70-89%
      return Math.round(70 + (total - 60) * 0.76);
    } else if (total >= 40) {
      // Lower scores map to 50-69%
      return Math.round(50 + (total - 40) * 0.95);
    } else {
      // Very low scores
      return Math.round(total * 1.25);
    }
  }

  /**
   * Generate match explanation for the user
   */
  generateMatchExplanation(scores, resumeData, job) {
    const explanations = [];

    // Role explanation
    if (scores.role >= 85) {
      explanations.push(`Strong role alignment with your ${resumeData.primaryRole?.title || 'background'}`);
    } else if (scores.role >= 60) {
      explanations.push('Related to your career experience');
    }

    // Experience explanation
    if (scores.experience >= 80) {
      explanations.push('Experience level matches well');
    } else if (scores.experience >= 60) {
      explanations.push('Slight stretch for experience level');
    } else if (scores.experience < 50) {
      explanations.push('May require more experience in this specific area');
    }

    // Skills explanation
    if (scores.content >= 70) {
      explanations.push('Many of your skills match the requirements');
    }

    return explanations;
  }
}

module.exports = new JobMatcher();
