/**
 * API service for communicating with the backend
 */

const API_BASE_URL = '/api';

/**
 * Generic fetch wrapper with error handling
 */
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;

  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `HTTP error! status: ${response.status}`);
    }

    return data;
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
}

/**
 * Get all todos or filter by date range/month
 * @param {Object} params - Query parameters
 * @param {string} params.start_date - Start date (YYYY-MM-DD)
 * @param {string} params.end_date - End date (YYYY-MM-DD)
 * @param {string} params.month - Month (YYYY-MM)
 * @returns {Promise<Array>} Array of todo objects
 */
export const getTodos = async (params = {}) => {
  const queryParams = new URLSearchParams();
  if (params.start_date) queryParams.append('start_date', params.start_date);
  if (params.end_date) queryParams.append('end_date', params.end_date);
  if (params.month) queryParams.append('month', params.month);

  const query = queryParams.toString();
  return apiRequest(`/todos${query ? `?${query}` : ''}`);
};

/**
 * Get todos for a specific date
 * @param {string} date - Date in YYYY-MM-DD format
 * @returns {Promise<Array>} Array of todo objects
 */
export const getTodosByDate = async (date) => {
  return apiRequest(`/todos/${date}`);
};

/**
 * Get a single todo by ID
 * @param {number} id - Todo ID
 * @returns {Promise<Object>} Todo object
 */
export const getTodoById = async (id) => {
  return apiRequest(`/todos/item/${id}`);
};

/**
 * Create a new todo
 * @param {Object} todo - Todo data
 * @param {string} todo.title - Title (required)
 * @param {string} todo.date - Date in YYYY-MM-DD format (required)
 * @param {string} todo.time - Time in HH:MM format (optional)
 * @param {string} todo.location - Location (optional)
 * @param {string} todo.person - Person (optional)
 * @param {string} todo.description - Description (optional)
 * @returns {Promise<Object>} Created todo object
 */
export const createTodo = async (todo) => {
  return apiRequest('/todos', {
    method: 'POST',
    body: JSON.stringify(todo),
  });
};

/**
 * Update an existing todo
 * @param {number} id - Todo ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated todo object
 */
export const updateTodo = async (id, updates) => {
  return apiRequest(`/todos/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
};

/**
 * Delete a todo
 * @param {number} id - Todo ID
 * @returns {Promise<Object>} Success message
 */
export const deleteTodo = async (id) => {
  return apiRequest(`/todos/${id}`, {
    method: 'DELETE',
  });
};

/**
 * Get todo count summary for a month
 * @param {string} month - Month in YYYY-MM format
 * @returns {Promise<Object>} Object with dates as keys and counts as values
 */
export const getMonthSummary = async (month) => {
  return apiRequest(`/summary/${month}`);
};
