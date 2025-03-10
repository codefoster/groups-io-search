const axios = require('axios');
const fs = require('fs');
const path = require('path');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
require('dotenv').config();

// Helper function to sanitize text for filenames
const sanitizeForFilename = (text) => {
  return text.replace(/[^a-z0-9]/gi, '_').toLowerCase();
};

// Parse command line arguments
const argv = yargs(hideBin(process.argv))
  .option('email', {
    alias: 'e',
    type: 'string',
    description: 'Your groups.io email',
    default: process.env.GROUPS_IO_EMAIL
  })
  .option('password', {
    alias: 'p',
    type: 'string',
    description: 'Your groups.io password',
    default: process.env.GROUPS_IO_PASSWORD
  })
  .option('query', {
    alias: 'q',
    type: 'string',
    description: 'Search query'
  })
  .option('id', {
    alias: 'i',
    type: 'number',
    description: 'Group ID to search',
    default: process.env.GROUPS_IO_GROUP_ID ? parseInt(process.env.GROUPS_IO_GROUP_ID) : undefined
  })
  .option('group-name', {
    alias: 'g',
    type: 'string',
    description: 'Group name to search',
    default: process.env.GROUPS_IO_GROUP_NAME
  })
  .option('output', {
    alias: 'o',
    type: 'string',
    description: 'Output file path (if not specified, results are shown on screen)',
    default: null 
  })
  .option('format', {
    alias: 'f',
    type: 'string',
    description: 'Output format: full, body-only, or summary',
    choices: ['full', 'body-only', 'summary'],
    default: 'body-only'
  })
  .demandOption(['query'], 'Please provide a search query')
  .check((argv) => {
    // Check if email and password are provided
    if (!argv.email || !argv.password) {
      throw new Error('Email and password are required. Provide them as arguments or in .env file');
    }
    
    // Check if either group ID or group name is provided
    if (!argv.id && !argv['group-name']) {
      throw new Error('Either group ID or group name must be provided as argument or in .env file');
    }
    
    return true;
  })
  .help()
  .argv;

// Configuration
const config = {
  email: argv.email,
  password: argv.password,
  groupId: argv.id,
  groupName: argv['group-name'],
  searchQuery: argv.query,
  outputFile: argv.output ? path.resolve(argv.output) : null,
  format: argv.format
};

// Create an axios instance
const api = axios.create({
  baseURL: 'https://groups.io/api/v1',
  withCredentials: true
});

async function login() {
  console.log('Logging in...');
  
  const formData = new URLSearchParams();
  formData.append('email', config.email);
  formData.append('password', config.password);
  
  try {
    const response = await api.post('/login', formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    if (response.status === 200 && response.data.user) {
      console.log('Login successful!');
      
      // Save cookies for subsequent requests
      const cookies = response.headers['set-cookie'];
      if (cookies) {
        api.defaults.headers.Cookie = cookies.join('; ');
      }
      
      return true;
    } else {
      console.error('Login failed:', response.data);
      return false;
    }
  } catch (error) {
    console.error('Login error:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    return false;
  }
}

async function searchArchives(page = 1, allResults = []) {
  console.log(`Fetching page ${page}...`);
  
  try {
    // Define search parameters based on whether group ID or group name was provided
    const searchParams = {
      q: config.searchQuery,
      page
    };
    
    // Use either group_id or group_name parameter
    if (config.groupId) {
      searchParams.group_id = config.groupId;
    } else {
      searchParams.group_name = config.groupName;
    }
    
    const response = await api.get('/searcharchives', {
      params: searchParams
    });
    
    if (response.status === 200) {
      const { data } = response;
      
      // The data itself is the array of messages
      if (Array.isArray(data.data) && data.data.length > 0) {
        allResults.push(...data.data);
        console.log(`Retrieved ${data.data.length} messages. Total so far: ${allResults.length}`);
        
        // Check if there are more pages by looking at the pagination headers
        const totalPages = Math.floor(data.total_count/10)+1 //parseInt(response.headers['x-total-pages'] || '0');
        if (page < totalPages) {
          // Wait a bit to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 10));
          return searchArchives(page + 1, allResults);
        }
      } else {
        console.log('No messages found on this page');
      }
      
      return allResults;
    } else {
      console.error('Search failed:', response.data);
      return allResults;
    }
  } catch (error) {
    console.error(`Error fetching page ${page}:`, error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    return allResults;
  }
}

function formatResults(results, format) {
  switch (format) {
    case 'full':
      return results;
    case 'body-only':
      return results.map(result => result.body);
    case 'summary':
      return results.map(result => ({
        subject: result.subject,
        from: result.from,
        date: result.date,
        snippet: result.body ? result.body.substring(0, 150) + '...' : ''
      }));
    default:
      return results.map(result => result.body);
  }
}

function displayResults(results, format) {
  const formattedResults = formatResults(results, format);
  
  if (format === 'summary') {
    console.log('\n===== SEARCH RESULTS =====\n');
    formattedResults.forEach((result, index) => {
      console.log(`Result #${index + 1}`);
      console.log(`Subject: ${result.subject}`);
      console.log(`From: ${result.from}`);
      console.log(`Date: ${result.date}`);
      console.log(`Snippet: ${result.snippet}`);
      console.log('-------------------');
    });
    console.log(`Total results: ${results.length}`);
  } else {
    console.log(JSON.stringify(formattedResults, null, 2));
  }
}

async function main() {
  try {
    const loggedIn = await login();
    
    if (!loggedIn) {
      console.error('Failed to login. Cannot continue.');
      process.exit(1);
    }
    
    const groupIdentifier = config.groupId ? `ID ${config.groupId}` : `name "${config.groupName}"`;
    console.log(`Searching for "${config.searchQuery}" in group ${groupIdentifier}...`);
    const allResults = await searchArchives();
    
    if (allResults.length === 0) {
      console.log('No results found for your search.');
      return;
    }
    
    // Format the results based on the specified format
    const formattedResults = formatResults(allResults, config.format);
    
    // If output file is specified, save results to file
    if (config.outputFile) {
      console.log(`Writing ${allResults.length} results to ${config.outputFile}...`);
      fs.writeFileSync(
        config.outputFile, 
        JSON.stringify(formattedResults, null, 2)
      );
      console.log(`Search complete! Results saved to ${config.outputFile}`);
    } else {
      // Display results to console
      console.log(`Found ${allResults.length} results:`);
      displayResults(allResults, config.format);
    }
  } catch (error) {
    console.error('An unexpected error occurred:', error);
  }
}

main();
