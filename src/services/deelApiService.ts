import axios from 'axios';

// Create a configured instance of axios for the Deel API
const deelApi = axios.create({
  baseURL: 'https://api.letsdeel.com/rest/v2', // Production API URL
  headers: {
    'Content-Type': 'application/json',
  },
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
        const response = await deelApi.get(endpoint, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
            }
        });
        // The API response for a list is often nested in a 'data' property
        return response.data.data ? response.data.data as T : response.data as T;
    } catch (error: any) {
        if (error.response) {
            // The request was made and the server responded with a status code
            // that falls out of the range of 2xx
            console.error('Deel API Error:', error.response.status, error.response.data);
            // Attempt to extract the specific error message from the API response
            const errorMessage = error.response.data?.errors?.[0]?.message || `API error: ${error.response.status}`;
            throw new Error(errorMessage);
        } else if (error.request) {
            // The request was made but no response was received
            console.error('Deel API Error: No response received', error.request);
            throw new Error('Failed to fetch data from Deel API. No response received.');
        } else {
            // Something happened in setting up the request that triggered an Error
            console.error('Error', error.message);
            throw new Error('An unknown error occurred while setting up the API request.');
        }
    }
};
