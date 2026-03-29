// wpMediaApi.js - Secure WordPress Media API Client

class WPMediaApi {
    constructor(token) {
        this.token = token;
        this.apiUrl = 'https://example.com/wp-json/wp/v2/media'; // Change to your WordPress site URL
    }

    // Method to fetch media
    async fetchMedia() {
        const response = await fetch(this.apiUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Content-Type': 'application/json'
            }
        });
        if (!response.ok) {
            throw new Error('Failed to fetch media');
        }
        return await response.json();
    }

    // Method to revoke token
    revokeToken() {
        this.token = null;
        console.log('Token has been revoked.');
    }
}

export default WPMediaApi;