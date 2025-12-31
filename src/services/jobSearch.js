const axios = require('axios');

/**
 * Job Search Service
 * Integrates with job board APIs to fetch real job listings
 * Falls back to mock data when APIs are not configured
 */

class JobSearchService {
  constructor() {
    this.adzunaAppId = process.env.ADZUNA_APP_ID;
    this.adzunaAppKey = process.env.ADZUNA_APP_KEY;
    this.jsearchApiKey = process.env.JSEARCH_API_KEY;
    this.linkedinScraperApiKey = process.env.LINKEDIN_SCRAPER_API_KEY;
  }

  /**
   * Search for jobs based on resume data
   */
  async searchJobs(resumeData) {
    const searchQueries = this.buildSearchQueries(resumeData);
    let allJobs = [];

    // Build array of API calls to run in parallel
    const apiCalls = [];

    if (this.linkedinScraperApiKey) {
      apiCalls.push({
        name: 'LinkedIn',
        promise: this.searchLinkedIn(searchQueries)
      });
    }

    if (this.jsearchApiKey) {
      apiCalls.push({
        name: 'JSearch',
        promise: this.searchJSearch(searchQueries)
      });
    }

    if (this.adzunaAppId && this.adzunaAppKey) {
      apiCalls.push({
        name: 'Adzuna',
        promise: this.searchAdzuna(searchQueries)
      });
    }

    // Run all API calls in parallel
    if (apiCalls.length > 0) {
      console.log(`Running ${apiCalls.length} API(s) in parallel: ${apiCalls.map(a => a.name).join(', ')}`);
      const startTime = Date.now();

      const results = await Promise.allSettled(apiCalls.map(api => api.promise));

      results.forEach((result, index) => {
        const apiName = apiCalls[index].name;
        if (result.status === 'fulfilled') {
          console.log(`${apiName}: ${result.value.length} jobs found`);
          allJobs = [...allJobs, ...result.value];
        } else {
          console.error(`${apiName} API error:`, result.reason?.message || result.reason);
        }
      });

      console.log(`Parallel API calls completed in ${Date.now() - startTime}ms`);
    }

    // Fall back to mock data if no API results
    if (allJobs.length === 0) {
      console.log('Using mock job data (no API keys configured)');
      allJobs = this.getMockJobs(resumeData);
    }

    // Remove duplicates based on title + company
    const uniqueJobs = this.deduplicateJobs(allJobs);

    return uniqueJobs;
  }

  /**
   * Build search queries based on resume analysis
   */
  buildSearchQueries(resumeData) {
    const queries = [];
    const seniorityPrefix = this.getSeniorityPrefix(resumeData.seniorityLevel);
    const primaryTitle = resumeData.primaryRole?.title || '';

    // Primary role search - always include the actual title
    if (primaryTitle) {
      queries.push(primaryTitle);
      queries.push(`${seniorityPrefix} ${primaryTitle}`.trim());
    }

    // Add role variations based on type
    if (resumeData.primaryRole?.type) {
      const roleKeywords = {
        'Engineering': ['Software Engineer', 'Developer', 'Full Stack Engineer'],
        'Product': ['Product Manager', 'Program Manager', 'Product Owner'],
        'Design': ['Product Designer', 'UX Designer', 'UI Designer'],
        'Data': ['Data Scientist', 'Data Analyst', 'Data Engineer', 'Business Analyst', 'Analyst'],
        'Management': ['Engineering Manager', 'Technical Lead', 'Team Lead']
      };

      const keywords = roleKeywords[resumeData.primaryRole.type] || [];
      keywords.forEach(keyword => {
        queries.push(`${seniorityPrefix} ${keyword}`.trim());
      });
    }

    // If primary title contains common role words, add variations
    const titleLower = primaryTitle.toLowerCase();
    if (titleLower.includes('analyst')) {
      queries.push('Analyst');
      queries.push('Business Analyst');
      queries.push('Data Analyst');
      queries.push(`${seniorityPrefix} Analyst`.trim());
    }

    // Add skill-based queries only if we have skills
    const topSkills = resumeData.skills.technical.slice(0, 2);
    if (topSkills.length > 0 && primaryTitle) {
      topSkills.forEach(skill => {
        queries.push(`${skill} ${primaryTitle}`);
      });
    }

    const finalQueries = [...new Set(queries)].slice(0, 5);
    console.log('Search queries:', finalQueries);
    return finalQueries;
  }

  /**
   * Get seniority prefix for job search
   */
  getSeniorityPrefix(level) {
    const prefixes = {
      'entry': 'Junior',
      'mid': '',
      'senior': 'Senior',
      'manager': 'Lead'
    };
    return prefixes[level] || '';
  }

  /**
   * Search using LinkedIn Job Search API (RapidAPI)
   * https://rapidapi.com/fantastic-jobs-fantastic-jobs-default/api/linkedin-job-search-api
   */
  async searchLinkedIn(queries) {
    const jobs = [];

    for (const query of queries.slice(0, 3)) { // Limit API calls
      try {
        const response = await axios.get('https://linkedin-job-search-api.p.rapidapi.com/active-jb-7d', {
          params: {
            title_filter: `"${query}"`,
            location_filter: 'United States',
            limit: 20
          },
          headers: {
            'X-RapidAPI-Key': this.linkedinScraperApiKey,
            'X-RapidAPI-Host': 'linkedin-job-search-api.p.rapidapi.com'
          }
        });

        if (response.data && Array.isArray(response.data)) {
          const formattedJobs = response.data.map(job => ({
            id: job.id || job.job_id || `linkedin-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            title: job.title || job.job_title || 'Job Title',
            company: job.organization || job.company_name || job.company || 'Company',
            location: job.location || job.job_location || 'Remote',
            description: job.description || job.job_description || '',
            url: job.linkedin_url || job.url || job.apply_url || '#',
            salary: job.salary || job.compensation || null,
            posted: job.posted_time || job.date_posted || new Date().toISOString(),
            source: 'LinkedIn'
          }));
          jobs.push(...formattedJobs);
        }
      } catch (error) {
        console.error(`LinkedIn query "${query}" failed:`, error.message);
      }
    }

    return jobs;
  }

  /**
   * Search using JSearch API (RapidAPI)
   */
  async searchJSearch(queries) {
    const jobs = [];

    for (const query of queries.slice(0, 3)) { // Limit API calls
      try {
        const response = await axios.get('https://jsearch.p.rapidapi.com/search', {
          params: {
            query: query,
            page: '1',
            num_pages: '1'
          },
          headers: {
            'X-RapidAPI-Key': this.jsearchApiKey,
            'X-RapidAPI-Host': 'jsearch.p.rapidapi.com'
          }
        });

        if (response.data?.data) {
          const formattedJobs = response.data.data.map(job => ({
            id: job.job_id,
            title: job.job_title,
            company: job.employer_name,
            location: job.job_city ? `${job.job_city}, ${job.job_state}` : job.job_country,
            description: job.job_description,
            url: job.job_apply_link || job.job_google_link,
            salary: job.job_min_salary ? `$${job.job_min_salary.toLocaleString()} - $${job.job_max_salary?.toLocaleString() || 'N/A'}` : null,
            posted: job.job_posted_at_datetime_utc,
            source: 'JSearch'
          }));
          jobs.push(...formattedJobs);
        }
      } catch (error) {
        console.error(`JSearch query "${query}" failed:`, error.message);
      }
    }

    return jobs;
  }

  /**
   * Search using Adzuna API
   */
  async searchAdzuna(queries) {
    const jobs = [];

    for (const query of queries.slice(0, 3)) {
      try {
        const response = await axios.get(
          `https://api.adzuna.com/v1/api/jobs/us/search/1`,
          {
            params: {
              app_id: this.adzunaAppId,
              app_key: this.adzunaAppKey,
              what: query,
              results_per_page: 10
            }
          }
        );

        if (response.data?.results) {
          const formattedJobs = response.data.results.map(job => ({
            id: job.id,
            title: job.title,
            company: job.company?.display_name || 'Company',
            location: job.location?.display_name || 'Remote',
            description: job.description,
            url: job.redirect_url,
            salary: job.salary_min ? `$${job.salary_min.toLocaleString()} - $${job.salary_max?.toLocaleString() || 'N/A'}` : null,
            posted: job.created,
            source: 'Adzuna'
          }));
          jobs.push(...formattedJobs);
        }
      } catch (error) {
        console.error(`Adzuna query "${query}" failed:`, error.message);
      }
    }

    return jobs;
  }

  /**
   * Generate realistic mock job data based on resume
   */
  getMockJobs(resumeData) {
    const primaryType = resumeData.primaryRole?.type || 'Engineering';
    const seniorityLevel = resumeData.seniorityLevel || 'mid';

    // Job templates by role type
    const jobTemplates = {
      'Engineering': [
        { title: 'Software Engineer', companies: ['Google', 'Meta', 'Amazon', 'Microsoft', 'Apple', 'Netflix', 'Stripe', 'Airbnb'] },
        { title: 'Senior Software Engineer', companies: ['Uber', 'Lyft', 'DoorDash', 'Instacart', 'Coinbase', 'Robinhood'] },
        { title: 'Full Stack Engineer', companies: ['Shopify', 'Square', 'Twilio', 'Datadog', 'MongoDB', 'Elastic'] },
        { title: 'Frontend Engineer', companies: ['Figma', 'Notion', 'Canva', 'Webflow', 'Vercel', 'Linear'] },
        { title: 'Backend Engineer', companies: ['Plaid', 'Ramp', 'Brex', 'Scale AI', 'Anthropic', 'OpenAI'] },
        { title: 'Junior Software Engineer', companies: ['Atlassian', 'Asana', 'Monday.com', 'Airtable', 'Retool'] },
        { title: 'Staff Engineer', companies: ['Google', 'Meta', 'Amazon', 'Stripe', 'Databricks'] }
      ],
      'Product': [
        { title: 'Product Manager', companies: ['Google', 'Meta', 'Amazon', 'Microsoft', 'Salesforce', 'Adobe'] },
        { title: 'Senior Product Manager', companies: ['Uber', 'Airbnb', 'DoorDash', 'Instacart', 'Coinbase'] },
        { title: 'Associate Product Manager', companies: ['Google', 'Meta', 'Microsoft', 'LinkedIn', 'Twitter'] },
        { title: 'Technical Program Manager', companies: ['Amazon', 'Google', 'Apple', 'Meta', 'Netflix'] },
        { title: 'Product Owner', companies: ['Spotify', 'Slack', 'Zoom', 'DocuSign', 'ServiceNow'] },
        { title: 'Group Product Manager', companies: ['Stripe', 'Square', 'Plaid', 'Brex', 'Ramp'] }
      ],
      'Design': [
        { title: 'Product Designer', companies: ['Apple', 'Google', 'Airbnb', 'Figma', 'Notion', 'Linear'] },
        { title: 'Senior Product Designer', companies: ['Meta', 'Stripe', 'Square', 'Coinbase', 'Robinhood'] },
        { title: 'UX Designer', companies: ['Microsoft', 'Amazon', 'Salesforce', 'Adobe', 'Intuit'] },
        { title: 'UI Designer', companies: ['Canva', 'Webflow', 'Framer', 'InVision', 'Sketch'] },
        { title: 'Design Lead', companies: ['Uber', 'Lyft', 'DoorDash', 'Instacart', 'Pinterest'] },
        { title: 'Junior Product Designer', companies: ['Spotify', 'Slack', 'Dropbox', 'Asana', 'Notion'] }
      ],
      'Data': [
        { title: 'Data Scientist', companies: ['Google', 'Meta', 'Amazon', 'Netflix', 'Spotify', 'Uber'] },
        { title: 'Senior Data Scientist', companies: ['Airbnb', 'Lyft', 'DoorDash', 'Instacart', 'Coinbase'] },
        { title: 'Data Analyst', companies: ['Microsoft', 'Salesforce', 'Adobe', 'Intuit', 'ServiceNow'] },
        { title: 'Machine Learning Engineer', companies: ['OpenAI', 'Anthropic', 'DeepMind', 'Scale AI', 'Databricks'] },
        { title: 'Data Engineer', companies: ['Snowflake', 'Databricks', 'dbt Labs', 'Fivetran', 'Airbyte'] },
        { title: 'Analytics Engineer', companies: ['Stripe', 'Square', 'Plaid', 'Brex', 'Ramp'] }
      ],
      'Management': [
        { title: 'Engineering Manager', companies: ['Google', 'Meta', 'Amazon', 'Microsoft', 'Apple'] },
        { title: 'Senior Engineering Manager', companies: ['Uber', 'Airbnb', 'Stripe', 'Square', 'Coinbase'] },
        { title: 'Technical Lead', companies: ['Netflix', 'Spotify', 'Slack', 'Dropbox', 'Notion'] },
        { title: 'Director of Engineering', companies: ['DoorDash', 'Instacart', 'Lyft', 'Robinhood', 'Plaid'] },
        { title: 'VP of Engineering', companies: ['Stripe', 'Databricks', 'Figma', 'Notion', 'Linear'] }
      ]
    };

    const templates = jobTemplates[primaryType] || jobTemplates['Engineering'];
    const jobs = [];

    // Generate jobs based on templates
    templates.forEach(template => {
      template.companies.forEach(company => {
        // Add some variety with seniority levels
        const titles = this.getTitleVariations(template.title, seniorityLevel);
        const selectedTitle = titles[Math.floor(Math.random() * titles.length)];

        jobs.push({
          id: `mock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          title: selectedTitle,
          company: company,
          location: this.getRandomLocation(),
          description: this.generateJobDescription(selectedTitle, company, resumeData.skills.technical),
          url: `https://careers.${company.toLowerCase().replace(/\s+/g, '')}.com/jobs`,
          salary: this.getRandomSalary(selectedTitle),
          posted: this.getRandomDate(),
          source: 'JobAgent'
        });
      });
    });

    // Shuffle and limit
    return this.shuffleArray(jobs).slice(0, 30);
  }

  /**
   * Get title variations based on seniority
   */
  getTitleVariations(baseTitle, seniorityLevel) {
    const variations = [baseTitle];

    // Don't add variations if title already has seniority
    if (baseTitle.includes('Senior') || baseTitle.includes('Junior') ||
        baseTitle.includes('Lead') || baseTitle.includes('Staff')) {
      return variations;
    }

    switch (seniorityLevel) {
      case 'entry':
        variations.push(`Junior ${baseTitle}`);
        variations.push(`Associate ${baseTitle}`);
        break;
      case 'mid':
        variations.push(baseTitle);
        variations.push(`${baseTitle} II`);
        break;
      case 'senior':
        variations.push(`Senior ${baseTitle}`);
        variations.push(`Staff ${baseTitle}`);
        break;
      case 'manager':
        variations.push(`Lead ${baseTitle}`);
        variations.push(`Principal ${baseTitle}`);
        break;
    }

    return variations;
  }

  /**
   * Generate a realistic job description
   */
  generateJobDescription(title, company, skills) {
    const responsibilities = [
      'Design and implement scalable solutions',
      'Collaborate with cross-functional teams',
      'Write clean, maintainable code',
      'Participate in code reviews',
      'Mentor junior team members',
      'Drive technical decisions',
      'Optimize application performance',
      'Work with stakeholders to define requirements'
    ];

    const requirements = [
      `Experience with ${skills.slice(0, 3).join(', ') || 'modern technologies'}`,
      'Strong problem-solving skills',
      'Excellent communication abilities',
      'Bachelor\'s degree in Computer Science or related field',
      'Experience working in agile environments'
    ];

    return `Join ${company} as a ${title}!\n\nResponsibilities:\n- ${responsibilities.slice(0, 4).join('\n- ')}\n\nRequirements:\n- ${requirements.slice(0, 3).join('\n- ')}`;
  }

  /**
   * Get a random location
   */
  getRandomLocation() {
    const locations = [
      'San Francisco, CA',
      'New York, NY',
      'Seattle, WA',
      'Austin, TX',
      'Remote',
      'Los Angeles, CA',
      'Boston, MA',
      'Denver, CO',
      'Chicago, IL',
      'Remote (US)'
    ];
    return locations[Math.floor(Math.random() * locations.length)];
  }

  /**
   * Get random salary based on title
   */
  getRandomSalary(title) {
    const titleLower = title.toLowerCase();
    let min, max;

    if (titleLower.includes('junior') || titleLower.includes('associate')) {
      min = 80000; max = 120000;
    } else if (titleLower.includes('senior') || titleLower.includes('staff')) {
      min = 180000; max = 280000;
    } else if (titleLower.includes('lead') || titleLower.includes('principal')) {
      min = 220000; max = 350000;
    } else if (titleLower.includes('director') || titleLower.includes('vp')) {
      min = 280000; max = 450000;
    } else {
      min = 120000; max = 180000;
    }

    const salary = Math.floor(Math.random() * (max - min) + min);
    return `$${salary.toLocaleString()} - $${(salary + 30000).toLocaleString()}`;
  }

  /**
   * Get a random recent date
   */
  getRandomDate() {
    const daysAgo = Math.floor(Math.random() * 14);
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return date.toISOString();
  }

  /**
   * Shuffle array
   */
  shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Remove duplicate jobs
   */
  deduplicateJobs(jobs) {
    const seen = new Set();
    return jobs.filter(job => {
      const key = `${job.title.toLowerCase()}-${job.company.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}

module.exports = new JobSearchService();
