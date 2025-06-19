require('dotenv').config();

// Log environment variables (without exposing the actual token)
console.log('Checking environment...');
console.log('GITHUB_TOKEN exists:', !!process.env.GITHUB_TOKEN);
console.log('TOKEN_AUTHORITY_PRIVATE_KEY exists:', !!process.env.TOKEN_AUTHORITY_PRIVATE_KEY);

async function testGitHubToken() {
    try {
        console.log('Making request to GitHub API...');
        const response = await fetch('https://api.github.com/user', {
            headers: {
                'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        console.log('Response status:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Error response:', errorText);
            throw new Error(`GitHub API returned ${response.status}: ${errorText}`);
        }

        const userData = await response.json();
        console.log('\nGitHub token test successful!');
        console.log('Authenticated as:', userData.login);
        console.log('Name:', userData.name || 'Not set');
        console.log('Email:', userData.email || 'Not set');
    } catch (error) {
        console.error('\nGitHub token test failed:', error.message);
        if (error.stack) {
            console.error('Stack trace:', error.stack);
        }
    }
}

testGitHubToken(); 