import axios from 'axios';

// Create a configured instance of axios for the Deel API
const deelApi = axios.create({
  baseURL: 'https://api-sandbox.demo.deel.com/rest/v2',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 second timeout
});

/**
 * A generic function to make authenticated GET requests to the Deel API.
 * @param endpoint The API endpoint to call (e.g., '/contracts').
 * @param apiKey The Deel API key for authentication.
 * @returns A promise that resolves with the data from the API.
 * @throws An error with a descriptive message if the API call fails.
 */
export const callDeelApi = async <T>(endpoint: string, apiKey: string): Promise<T> => {
    try {
        console.log(`[API] Sending request to: ${endpoint}`);
        console.log(`[API] Full URL: ${deelApi.defaults.baseURL}${endpoint}`);
        
        const response = await deelApi.get(endpoint, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
            }
        });
        
        console.log(`[API] Response status: ${response.status}`);
        console.log(`[API] Response data type:`, Array.isArray(response.data) ? 'Array' : typeof response.data);
        console.log(`[API] Response data:`, response.data);
        
        // Return the full response data - let the calling code handle the structure
        return response.data as T;
    } catch (error: any) {
        if (error.response) {
            // Server responded with error status
            console.error('[API] Error response:', {
                status: error.response.status,
                statusText: error.response.statusText,
                data: error.response.data,
                headers: error.response.headers
            });
            
            // Try to extract a meaningful error message
            let errorMessage = `API error: ${error.response.status}`;
            
            if (error.response.data) {
                if (typeof error.response.data === 'string') {
                    errorMessage = error.response.data;
                } else if (error.response.data.errors && Array.isArray(error.response.data.errors)) {
                    errorMessage = error.response.data.errors.map((e: any) => e.message || e).join(', ');
                } else if (error.response.data.message) {
                    errorMessage = error.response.data.message;
                } else if (error.response.data.error) {
                    errorMessage = error.response.data.error;
                }
            }
            
            throw new Error(errorMessage);
        } else if (error.request) {
            // Request made but no response received
            console.error('[API] No response received:', error.request);
            throw new Error('Failed to fetch data from Deel API. No response received. Check your internet connection.');
        } else {
            // Error in request setup
            console.error('[API] Request setup error:', error.message);
            throw new Error(`An error occurred: ${error.message}`);
        }
    }
};
