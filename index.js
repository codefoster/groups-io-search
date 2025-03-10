const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration
const config = {
  email: process.env.GROUPS_IO_EMAIL || 'jeremy.foster@live.com',
  password: process.env.GROUPS_IO_PASSWORD || 'N6z=v#m2XLy*fJMs',
  groupId: 36599,
  searchQuery: 'westerbeke',
  outputFile: path.join(__dirname, 'search-results.json')
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
    const response = await api.get('/searcharchives', {
      params: {
        group_id: config.groupId,
        q: config.searchQuery,
        page
      }
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

async function main() {
  try {
    const loggedIn = await login();
    
    if (!loggedIn) {
      console.error('Failed to login. Cannot continue.');
      process.exit(1);
    }
    
    console.log(`Searching for "${config.searchQuery}" in group ${config.groupId}...`);
    const allResults = await searchArchives();
    
    console.log(`Writing ${allResults.length} results to file...`);
    fs.writeFileSync(
      config.outputFile, 
      JSON.stringify(allResults.map(all => all.body), null, 2)
    );
    
    console.log(`Search complete! Results saved to ${config.outputFile}`);
  } catch (error) {
    console.error('An unexpected error occurred:', error);
  }
}

main();
