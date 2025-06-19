# SHIPEP Token Website

## Deployment Instructions

1. Upload all files to your hosting account
2. Make sure your hosting supports Node.js
3. Set up environment variables on your hosting:
   - `SOLANA_NETWORK` (devnet/mainnet)
   - Any other required environment variables from server.js

4. Install dependencies:
```bash
npm install
```

5. Start the server:
```bash
npm start
```

## File Structure
- `index.html` - Main landing page
- `buy.html` - Token purchase page
- `styles.css` - Website styles
- `buy.js` - Purchase functionality
- `app.js` - Main application logic
- `server.js` - Backend server
- `package.json` - Node.js dependencies
- `shipep.png`, `shipep2.png` - Website images

## Important Notes
- Make sure to update the token address in `buy.js` when deploying to mainnet
- Update the network warning message in the token details section
- Ensure all API endpoints are properly configured for your hosting environment 