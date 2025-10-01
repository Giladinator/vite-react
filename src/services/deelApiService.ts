import axios from 'axios';

// Create a configured instance of axios for the Deel API
const deelApi = axios.create({
  baseURL: 'https://api-sandbox.demo.deel.com/rest/v2', // Corrected to sandbox URL
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
        console.log(`Sending API Request to: ${endpoint}`);
        const response = await deelApi.get(endpoint, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
            }
        });
        // SIMPLIFIED: Always return the main data object.
        // The component will handle nested 'data' properties if they exist.
        return response.data as T;
    } catch (error: any) {
        if (error.response) {
            console.error('Deel API Error:', error.response.status, error.response.data);
            const errorMessage = error.response.data?.errors?.[0]?.message || `API error: ${error.response.status}`;
            throw new Error(errorMessage);
        } else if (error.request) {
            console.error('Deel API Error: No response received', error.request);
            throw new Error('Failed to fetch data from Deel API. No response received.');
        } else {
            console.error('Error', error.message);
            throw new Error('An unknown error occurred while setting up the API request.');
        }
    }
};
