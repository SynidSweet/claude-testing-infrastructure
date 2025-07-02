// JavaScript API service
import axios from 'axios';

export async function fetchData(url) {
    const response = await axios.get(url);
    return response.data;
}

export async function postData(url, data) {
    const response = await axios.post(url, data);
    return response.data;
}

export function validateApiResponse(response) {
    return response && typeof response === 'object';
}