import axios from 'axios';

// Create an instance of axios for the Deel API.
// This centralizes the configuration for base URL and authentication.
const deelApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_DEEL_API_BASE_URL,
  headers: {
    'Authorization': `Bearer ${process.env.DEEL_API_TOKEN}`,
    'Content-Type': 'application/json',
  },
});

/**
 * Fetches a list of contracts from the Deel API.
 * This function handles the API call and maps the response data
 * to a simplified format suitable for the UI.
 * @returns {Promise<Array>} A promise that resolves to an array of contracts.
 */
export const getContracts = async () => {
  try {
    // Make the GET request to the '/contracts' endpoint.
    const response = await deelApi.get('/contracts');

    // The API returns a comprehensive object; we extract the 'data' array.
    const contracts = response.data;

    // Map the detailed API response to the simpler structure our table needs.
    // This acts as an anti-corruption layer, protecting our UI from API changes.
    const mappedContracts = contracts.map(contract => ({
      id: contract.id,
      name: contract.worker?.full_name |

| 'N/A', // Use optional chaining in case worker is null
      jobTitle: contract.job_title_name |

| 'Not Specified',
      status: contract.status,
      amount: contract.compensation_details?.amount |

| 0,
      currency: contract.compensation_details?.currency |

| 'USD',
    }));

    return mappedContracts;

  } catch (error) {
    // Log a more informative error message to the console for debugging.
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error('Deel API Error:', error.response.status, error.response.data);
    } else if (error.request) {
      // The request was made but no response was received
      console.error('Deel API Error: No response received', error.request);
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('Error', error.message);
    }
    // Re-throw the error so the calling component can handle it (e.g., show an error message).
    throw new Error('Failed to fetch data from Deel API.');
  }
};
