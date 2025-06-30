/**
 * API service module for testing async operations and network calls
 */

// Mock API base URL
const API_BASE_URL = 'https://jsonplaceholder.typicode.com';

/**
 * Fetch user data from API
 */
export async function fetchUserData(userId = 1) {
  try {
    const response = await fetch(`${API_BASE_URL}/users/${userId}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const userData = await response.json();
    
    // Validate user data structure
    if (!userData.id || !userData.name || !userData.email) {
      throw new Error('Invalid user data structure');
    }
    
    return {
      id: userData.id,
      name: userData.name,
      email: userData.email,
      username: userData.username,
      phone: userData.phone,
      website: userData.website,
      address: userData.address,
      company: userData.company
    };
  } catch (error) {
    console.error('Failed to fetch user data:', error);
    throw new Error(`Failed to fetch user data: ${error.message}`);
  }
}

/**
 * Fetch posts for a specific user
 */
export async function fetchUserPosts(userId) {
  if (!userId || typeof userId !== 'number') {
    throw new Error('Valid user ID is required');
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}/posts?userId=${userId}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const posts = await response.json();
    
    return posts.map(post => ({
      id: post.id,
      title: post.title,
      body: post.body,
      userId: post.userId
    }));
  } catch (error) {
    console.error('Failed to fetch user posts:', error);
    throw new Error(`Failed to fetch user posts: ${error.message}`);
  }
}

/**
 * Create a new post
 */
export async function createPost(postData) {
  validatePostData(postData);
  
  try {
    const response = await fetch(`${API_BASE_URL}/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(postData)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Failed to create post:', error);
    throw new Error(`Failed to create post: ${error.message}`);
  }
}

/**
 * Update an existing post
 */
export async function updatePost(postId, postData) {
  if (!postId || typeof postId !== 'number') {
    throw new Error('Valid post ID is required');
  }
  
  validatePostData(postData);
  
  try {
    const response = await fetch(`${API_BASE_URL}/posts/${postId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...postData, id: postId })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Failed to update post:', error);
    throw new Error(`Failed to update post: ${error.message}`);
  }
}

/**
 * Delete a post
 */
export async function deletePost(postId) {
  if (!postId || typeof postId !== 'number') {
    throw new Error('Valid post ID is required');
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}/posts/${postId}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return true;
  } catch (error) {
    console.error('Failed to delete post:', error);
    throw new Error(`Failed to delete post: ${error.message}`);
  }
}

/**
 * Validate post data structure
 */
function validatePostData(postData) {
  if (!postData || typeof postData !== 'object') {
    throw new Error('Post data must be an object');
  }
  
  if (!postData.title || typeof postData.title !== 'string') {
    throw new Error('Post title is required and must be a string');
  }
  
  if (postData.title.length < 3) {
    throw new Error('Post title must be at least 3 characters long');
  }
  
  if (!postData.body || typeof postData.body !== 'string') {
    throw new Error('Post body is required and must be a string');
  }
  
  if (postData.body.length < 10) {
    throw new Error('Post body must be at least 10 characters long');
  }
  
  if (!postData.userId || typeof postData.userId !== 'number') {
    throw new Error('User ID is required and must be a number');
  }
}

/**
 * Validate email address format
 */
export function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    return false;
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Validate phone number format
 */
export function validatePhoneNumber(phone) {
  if (!phone || typeof phone !== 'string') {
    return false;
  }
  
  // Simple phone validation (US format)
  const phoneRegex = /^\(?(\d{3})\)?[-.\s]?(\d{3})[-.\s]?(\d{4})$/;
  return phoneRegex.test(phone.trim());
}

/**
 * Format phone number to standard format
 */
export function formatPhoneNumber(phone) {
  if (!validatePhoneNumber(phone)) {
    throw new Error('Invalid phone number format');
  }
  
  const cleaned = phone.replace(/\D/g, '');
  const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
  
  if (match) {
    return `(${match[1]}) ${match[2]}-${match[3]}`;
  }
  
  throw new Error('Unable to format phone number');
}

/**
 * API client with retry logic
 */
export class ApiClient {
  constructor(baseUrl = API_BASE_URL, options = {}) {
    this.baseUrl = baseUrl;
    this.retryCount = options.retryCount || 3;
    this.retryDelay = options.retryDelay || 1000;
    this.timeout = options.timeout || 10000;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const config = {
      timeout: this.timeout,
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    };

    for (let attempt = 1; attempt <= this.retryCount; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
        
        const response = await fetch(url, {
          ...config,
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return await response.json();
      } catch (error) {
        if (attempt === this.retryCount) {
          throw error;
        }
        
        console.warn(`Request attempt ${attempt} failed, retrying...`, error.message);
        await this.delay(this.retryDelay * attempt);
      }
    }
  }

  async get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  }

  async post(endpoint, data) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async put(endpoint, data) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Default API client instance
export const apiClient = new ApiClient();

// API endpoints configuration
export const API_ENDPOINTS = {
  USERS: '/users',
  POSTS: '/posts',
  COMMENTS: '/comments',
  ALBUMS: '/albums',
  PHOTOS: '/photos',
  TODOS: '/todos'
};

// HTTP status codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503
};