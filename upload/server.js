const fetch = require('node-fetch');
const express = require('express');
const cors = require('cors');
const path = require('path');
const { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL, Keypair } = require('@solana/web3.js');
const { getAssociatedTokenAddress, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, createTransferInstruction, Token, getAccount, createAssociatedTokenAccountInstruction } = require('@solana/spl-token');
const bs58 = require('bs58');
const { Buffer } = require('buffer');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
require('dotenv').config({ path: '/home/shipep/.config/shipep/.env' });

// Discord error notification
async function notifyDiscord(error, context = {}) {
    try {
        const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
        if (!webhookUrl) {
            console.error('DISCORD_WEBHOOK_URL not set in .env');
            return;
        }

        const message = {
            embeds: [{
                title: '🚨 Error Alert',
                color: 0xFF0000, // Red color
                fields: [
                    {
                        name: 'Error Message',
                        value: error.message || 'No error message'
                    },
                    {
                        name: 'Path',
                        value: context.path || 'N/A'
                    },
                    {
                        name: 'Method',
                        value: context.method || 'N/A'
                    },
                    {
                        name: 'IP',
                        value: context.ip || 'N/A'
                    },
                    {
                        name: 'User Agent',
                        value: context.userAgent || 'N/A'
                    }
                ],
                timestamp: new Date().toISOString()
            }]
        };

        await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(message)
        });
    } catch (notifyError) {
        console.error('Failed to send Discord notification:', notifyError);
    }
}

// Debug logging
console.log('Environment variables loaded:');
console.log('TREASURY_ACCOUNT:', process.env.TREASURY_ACCOUNT);
console.log('TOKEN_AUTHORITY_PRIVATE_KEY exists:', !!process.env.TOKEN_AUTHORITY_PRIVATE_KEY);

const app = express();
const port = 3000;

// Security headers
app.use(helmet({
    contentSecurityPolicy: {  // Change from false to configuration object
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "https://api.mainnet-beta.solana.com", "https://api.devnet.solana.com", "https://api.coingecko.com"],
            fontSrc: ["'self'", "https:", "data:"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"]
        }
    },
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: true,
    crossOriginResourcePolicy: { policy: "same-site" },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
	xContentTypeOptions: { nosniff: true },
    xFrameOptions: { action: 'deny' },
    hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true
    }
}));

// Basic CORS configuration
app.use(cors());
app.use(express.json());

// Add CSP headers
app.use((req, res, next) => {
    res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://solflare.com https://*.solflare.com; " +
        "style-src 'self' 'unsafe-inline' https: http:; " +
        "img-src 'self' data: https: http:; " +
        "font-src 'self' data: https: http:; " +
        "connect-src 'self' https://api.devnet.solana.com https://api.coingecko.com https://*.solflare.com; " +
        "frame-src 'self' https://*.solflare.com;"
    );
    
    // Add Cross-Origin headers with more permissive settings
    res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
    res.setHeader('Cross-Origin-Opener-Policy', 'unsafe-none');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    
    next();
});

// Test endpoint for Discord notifications
// app.get('/test-discord', (req, res, next) => {
    // console.log('Test endpoint hit!');
    // const testError = new Error('This is a test error notification');
    // console.log('Created test error:', testError);
    // next(testError);
// });

// Global error handler
app.use((err, req, res, next) => {
    // Log error to console
    console.error('Error caught by handler:', err);

    // Send to Discord
    notifyDiscord(err, {
        path: req.path,
        method: req.method,
        ip: req.ip,
        userAgent: req.headers['user-agent']
    }).then(() => {
        console.log('Discord notification sent');
    }).catch(error => {
        console.error('Failed to send Discord notification:', error);
    });

    // Send response to client
    res.status(500).json({ error: 'Internal server error' });
});

// Serve static files with proper content types
app.use(express.static(__dirname, {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.js')) {
            res.setHeader('Content-Type', 'text/javascript');
        } else if (filePath.endsWith('.ico')) {
            res.setHeader('Content-Type', 'image/x-icon');
        } else if (filePath.endsWith('.html')) {
            res.setHeader('Content-Type', 'text/html');
        } else if (filePath.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css');
        }
    }
}));

// Serve index.html for the root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'), {
        headers: {
            'Content-Type': 'text/html'
        }
    });
});

// Serve favicon
app.get('/favicon.ico', (req, res) => {
    res.status(204).end(); // No content response
});

// Configuration
const TOKEN_MINT = new PublicKey(process.env.TOKEN_MINT);
const TOKEN_AUTHORITY_PRIVATE_KEY = process.env.TOKEN_AUTHORITY_PRIVATE_KEY;
const TREASURY_ACCOUNT = new PublicKey(process.env.TREASURY_ACCOUNT);
const PRICE_PER_TOKEN = parseFloat(process.env.PRICE_PER_TOKEN);

if (!TOKEN_MINT) {
    console.error('Error: TOKEN_MINT is not set in .env file');
    process.exit(1);
}

if (!TOKEN_AUTHORITY_PRIVATE_KEY) {
    console.error('Error: TOKEN_AUTHORITY_PRIVATE_KEY is not set in .env file');
    process.exit(1);
}

if (!TREASURY_ACCOUNT) {
    console.error('Error: TREASURY_ACCOUNT is not set in .env file');
    process.exit(1);
}

if (!PRICE_PER_TOKEN || isNaN(PRICE_PER_TOKEN)) {
    console.error('Error: PRICE_PER_TOKEN is not set or invalid in .env file');
    process.exit(1);
}

// Create keypair from private key
let tokenAuthorityKeypair;
try {
    console.log('Private key from .env:', TOKEN_AUTHORITY_PRIVATE_KEY);
    
    // Convert comma-separated string to Uint8Array
    const privateKeyArray = TOKEN_AUTHORITY_PRIVATE_KEY.split(',')
        .map(num => parseInt(num.trim(), 10))
        .filter(num => !isNaN(num) && num >= 0 && num <= 255);

    console.log('Parsed private key array:', privateKeyArray);
    console.log('Private key length:', privateKeyArray.length);

    if (privateKeyArray.length !== 32) {
        throw new Error(`Invalid private key length: ${privateKeyArray.length} bytes (expected 32)`);
    }

    // Create a new keypair from the private key
    const privateKeyBytes = new Uint8Array(privateKeyArray);
    tokenAuthorityKeypair = Keypair.fromSeed(privateKeyBytes);
    
    console.log('Token authority public key:', tokenAuthorityKeypair.publicKey.toString());
    console.log('Token authority secret key (first 4 bytes):', 
        Array.from(tokenAuthorityKeypair.secretKey.slice(0, 4)).join(','));
} catch (error) {
    console.error('Error creating keypair:', error);
    process.exit(1);
}

const MAX_TOKENS_PER_TRANSACTION = 1000000000;
const MIN_TOKENS_PER_TRANSACTION = 1;

// Initialize connection
const connection = new Connection('https://api.devnet.solana.com');

// Function to get current SOL price
async function getSolPrice() {
    try {
        const response = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd");
        if (!response.ok) {
            throw new Error('Failed to get SOL price');
        }
        const data = await response.json();
        return data.solana.usd;
    } catch (error) {
        console.error('Error getting SOL price:', error);
        throw error;
    }
}

// Purchase tracking
const dailyPurchases = new Map();
const DAILY_LIMIT = 1000000000; // 10,000 tokens per day
const PURCHASE_WINDOW = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// Cleanup function to remove old purchase records
setInterval(() => {
    const now = Date.now();
    for (const [wallet, data] of dailyPurchases.entries()) {
        if (now - data.timestamp > PURCHASE_WINDOW) {
            dailyPurchases.delete(wallet);
        }
    }
}, 60 * 60 * 1000); // Run cleanup every hour

// Rate limiting configuration
const limiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute (reduced from 15 minutes)
    max: 100, // limit each IP to 100 requests per windowMs (increased from 10)
    message: JSON.stringify({ error: 'Too many requests from this IP, please try again later' }),
    standardHeaders: true,
    legacyHeaders: false,
});

// Apply rate limiting to all routes
app.use(limiter);

// Input sanitization middleware
const sanitizeInput = (req, res, next) => {
    const sanitizeString = (str) => {
        if (typeof str !== 'string') return str;
        return str.replace(/[<>]/g, ''); // Remove < and > to prevent XSS
    };

    if (req.body) {
        Object.keys(req.body).forEach(key => {
            req.body[key] = sanitizeString(req.body[key]);
        });
    }

    if (req.query) {
        Object.keys(req.query).forEach(key => {
            req.query[key] = sanitizeString(req.query[key]);
        });
    }

    next();
};

app.use(sanitizeInput);

// Token supply check middleware
const checkTokenSupply = async (req, res, next) => {
    try {
        const authorityTokenAccount = await getAssociatedTokenAddress(TOKEN_MINT, tokenAuthorityKeypair.publicKey);
        const accountInfo = await getAccount(connection, authorityTokenAccount);
        
        if (!accountInfo) {
            return res.status(500).json({ error: 'Token authority account not found' });
        }

        const availableSupply = Number(accountInfo.amount) / Math.pow(10, 9); // Convert to token units
        if (availableSupply < req.validatedData.amount) {
            return res.status(400).json({ error: 'Insufficient token supply' });
        }

        next();
    } catch (error) {
        console.error('Error checking token supply:', error);
        res.status(500).json({ error: 'Failed to check token supply' });
    }
};

// Treasury balance check middleware
const checkTreasuryBalance = async (req, res, next) => {
    try {
        // Get treasury's token account
        const treasuryTokenAccount = await getAssociatedTokenAddress(TOKEN_MINT, tokenAuthorityKeypair.publicKey);
        console.log('\n=== Treasury Balance Check ===');
        console.log('Treasury token account:', treasuryTokenAccount.toString());
        
        // Get token balance
        const tokenAccountInfo = await connection.getTokenAccountBalance(treasuryTokenAccount);
        const treasuryTokenBalance = tokenAccountInfo.value.uiAmount;
        
        // Log detailed information
        console.log('Requested amount:', req.validatedData.amount);
        console.log('Treasury balance:', treasuryTokenBalance);
        console.log('Has enough tokens:', treasuryTokenBalance >= req.validatedData.amount);
        console.log('===========================\n');
        
        // Check if treasury has enough tokens
        if (treasuryTokenBalance < req.validatedData.amount) {
            console.log('Treasury balance too low!');
            return res.status(500).json({ error: 'Treasury balance too low' });
        }

        next();
    } catch (error) {
        console.error('Error checking treasury balance:', error);
        res.status(500).json({ error: 'Failed to check treasury balance' });
    }
};

// Token info endpoint
app.get('/token-info', (req, res) => {
    res.json({
        symbol: 'SHIPEP',
        price: PRICE_PER_TOKEN
    });
});

// Transaction verification middleware
const verifyTransaction = async (req, res, next) => {
    try {
        const { signedTransaction, originalAmount, recipient } = req.body;
        
        if (!signedTransaction || !originalAmount || !recipient) {
            console.error('Missing required fields:', { 
                signedTransaction: !!signedTransaction, 
                originalAmount,
                recipient: !!recipient
            });
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Deserialize the transaction
        const transaction = Transaction.from(Buffer.from(signedTransaction, 'base64'));
        console.log('Deserialized transaction:', {
            signatures: transaction.signatures.map(sig => ({
                publicKey: sig.publicKey.toString(),
                hasSignature: !!sig.signature
            })),
            instructions: transaction.instructions.map(ix => ({
                programId: ix.programId.toString(),
                keys: ix.keys.map(k => ({
                    pubkey: k.pubkey.toString(),
                    isSigner: k.isSigner,
                    isWritable: k.isWritable
                }))
            }))
        });
        
        // Verify the transaction has the correct number of instructions
        // It should have either 2 instructions (transfer only) or 3 instructions (create account + transfer)
        if (transaction.instructions.length !== 2 && transaction.instructions.length !== 3) {
            console.error('Invalid instruction count:', transaction.instructions.length);
            return res.status(400).json({ error: 'Invalid transaction format' });
        }

        // If we have 3 instructions, the first one should be the create account instruction
        if (transaction.instructions.length === 3) {
            const createAccountInstruction = transaction.instructions[0];
            if (createAccountInstruction.programId.toString() !== ASSOCIATED_TOKEN_PROGRAM_ID.toString()) {
                console.error('Invalid first instruction program ID:', createAccountInstruction.programId.toString());
                return res.status(400).json({ error: 'Invalid transaction format' });
            }
        }

        // Verify the amount matches the original request
        // The transfer instruction is the last instruction (index 1 if 2 instructions, index 2 if 3 instructions)
        const transferInstruction = transaction.instructions[transaction.instructions.length - 1];
        const transferAmount = Number(transferInstruction.data.readBigUInt64LE(1)) / Math.pow(10, 9);
        console.log('Transfer amount check:', { transferAmount, originalAmount });
        
        if (transferAmount !== originalAmount) {
            console.error('Amount mismatch:', { transferAmount, originalAmount });
            return res.status(400).json({ error: 'Transaction amount mismatch' });
        }

        // Verify the fee payer matches the recipient
        const feePayer = transaction.feePayer.toString();
        console.log('Fee payer check:', { 
            feePayer,
            expectedRecipient: recipient
        });
        
        if (feePayer !== recipient) {
            console.error('Fee payer mismatch');
            return res.status(400).json({ error: 'Fee payer mismatch' });
        }

        // Log all keys in the transfer instruction for debugging
        console.log('Transfer instruction keys:', transferInstruction.keys.map((k, i) => ({
            index: i,
            pubkey: k.pubkey.toString(),
            isSigner: k.isSigner,
            isWritable: k.isWritable
        })));

        // Verify the token mint matches by checking the source token account
        // The source token account is derived from the token mint and authority
        const sourceTokenAccount = transferInstruction.keys[0].pubkey.toString();
        const expectedSourceTokenAccount = await getAssociatedTokenAddress(
            TOKEN_MINT,
            tokenAuthorityKeypair.publicKey
        );
        console.log('Token account check:', { 
            transactionSourceAccount: sourceTokenAccount,
            expectedSourceAccount: expectedSourceTokenAccount.toString()
        });
        
        if (sourceTokenAccount !== expectedSourceTokenAccount.toString()) {
            console.error('Token account mismatch');
            return res.status(400).json({ error: 'Invalid token account' });
        }

        // Verify signatures
        const hasValidSignature = transaction.signatures.some(sig => sig.signature);
        console.log('Signature check:', { hasValidSignature });
        
        if (!hasValidSignature) {
            console.error('No valid signature found');
            return res.status(400).json({ error: 'Transaction not properly signed' });
        }

        req.verifiedTransaction = transaction;
        next();
    } catch (error) {
        console.error('Error verifying transaction:', error);
        res.status(400).json({ error: 'Invalid transaction: ' + error.message });
    }
};

// Input validation middleware
const validateBuyTokensInput = (req, res, next) => {
    const { recipient, amount } = req.body;
    
    // Check if fields are undefined or null
    if (recipient === undefined || recipient === null || amount === undefined || amount === null) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const pubKey = new PublicKey(recipient);
        if (pubKey.toBytes().length !== 32) {
            throw new Error('Invalid public key length');
        }
    } catch (error) {
        return res.status(400).json({ error: 'Invalid recipient address' });
    }

    // First check if it's a valid number
    const amountNum = Number(amount);
    if (isNaN(amountNum)) {
        return res.status(400).json({ error: 'Amount must be a positive integer' });
    }

    // Then check if it's an integer
    if (!Number.isInteger(amountNum)) {
        return res.status(400).json({ error: 'Amount must be a positive integer' });
    }

    // Then check if it's positive
    if (amountNum <= 0) {
        return res.status(400).json({ error: 'Amount must be a positive integer' });
    }

    const MAX_TOKENS = 1000000000;
    if (amountNum > MAX_TOKENS) {
        return res.status(400).json({ error: `Maximum purchase limit is ${MAX_TOKENS} tokens (${MAX_TOKENS * PRICE_PER_TOKEN} SOL)` });
    }

    const MIN_TOKENS = 1;
    if (amountNum < MIN_TOKENS) {
        return res.status(400).json({ error: `Minimum purchase limit is ${MIN_TOKENS} token` });
    }

    req.validatedData = {
        recipient: new PublicKey(recipient),
        amount: amountNum
    };

    next();
};

// Buy tokens endpoint with all security checks
app.post('/buy-tokens', 
    validateBuyTokensInput,
    checkTokenSupply,
    checkTreasuryBalance,
    async (req, res) => {
        try {
            const { recipient, amount } = req.validatedData;
            
            // Get current SOL price and calculate payment amount
            const solPrice = await getSolPrice();
            const solPayment = (PRICE_PER_TOKEN * amount) / solPrice;
            const solPaymentLamports = Math.floor(solPayment * LAMPORTS_PER_SOL) + 1; // Add 1 lamport to prevent 69

            console.log('Creating transfer for:', {
                recipient: recipient.toString(),
                amount,
                tokenMint: TOKEN_MINT.toString(),
                solPayment: solPayment + ' SOL',
                usdPrice: PRICE_PER_TOKEN + ' USD'
            });

            // Get the recipient's token account
            const recipientTokenAccount = await getAssociatedTokenAddress(TOKEN_MINT, recipient);
            console.log('Recipient token account:', recipientTokenAccount.toString());

            // Get token authority's token account
            const authorityTokenAccount = await getAssociatedTokenAddress(TOKEN_MINT, tokenAuthorityKeypair.publicKey);
            console.log('Authority token account:', authorityTokenAccount.toString());

            // Check if authority token account exists
            const authorityAccountInfo = await connection.getAccountInfo(authorityTokenAccount);
            if (!authorityAccountInfo) {
                throw new Error('Authority token account does not exist');
            }

            // Create transaction
            const transaction = new Transaction();

            // Check if recipient's token account exists
            const recipientAccountInfo = await connection.getAccountInfo(recipientTokenAccount);
            if (!recipientAccountInfo) {
                console.log("Recipient's token account does not exist. Adding creation instruction.");
                // Add instruction to create recipient's token account
                const createAccountInstruction = createAssociatedTokenAccountInstruction(
                    tokenAuthorityKeypair.publicKey, // payer
                    recipientTokenAccount, // token account to create
                    recipient, // owner
                    TOKEN_MINT, // mint
                    TOKEN_PROGRAM_ID // token program id
                );
                transaction.add(createAccountInstruction);
            }

            // Add SOL transfer instruction (user to treasury)
            const solTransferInstruction = SystemProgram.transfer({
                fromPubkey: recipient,
                toPubkey: TREASURY_ACCOUNT,
                lamports: solPaymentLamports
            });
            transaction.add(solTransferInstruction);

            // Create transfer instruction using createTransferInstruction
            const transferInstruction = createTransferInstruction(
                authorityTokenAccount, // source
                recipientTokenAccount, // destination
                tokenAuthorityKeypair.publicKey, // owner
                amount * Math.pow(10, 9), // amount (with decimals)
                [], // multisigners
                TOKEN_PROGRAM_ID // programId
            );

            // Add the instruction to the transaction
            transaction.add(transferInstruction);

            // Get recent blockhash
            const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
            transaction.recentBlockhash = blockhash;
            transaction.lastValidBlockHeight = lastValidBlockHeight;
            transaction.feePayer = recipient; // Set the user as the fee payer

            // Log transaction details before signing
            console.log('Transaction details before signing:', {
                feePayer: transaction.feePayer.toString(),
                recentBlockhash: transaction.recentBlockhash,
                instructions: transaction.instructions.map(ix => ({
                    programId: ix.programId.toString(),
                    keys: ix.keys.map(k => ({
                        pubkey: k.pubkey.toString(),
                        isSigner: k.isSigner,
                        isWritable: k.isWritable
                    }))
                }))
            });

            // Sign the transaction with token authority before sending to frontend
            console.log('Signing with token authority...');
            transaction.partialSign(tokenAuthorityKeypair);

            // Log transaction details after signing
            console.log('Transaction details after signing:', {
                feePayer: transaction.feePayer.toString(),
                recentBlockhash: transaction.recentBlockhash,
                instructions: transaction.instructions.map(ix => ({
                    programId: ix.programId.toString(),
                    keys: ix.keys.map(k => ({
                        pubkey: k.pubkey.toString(),
                        isSigner: k.isSigner,
                        isWritable: k.isWritable
                    }))
                }))
            });

            // Serialize the partially signed transaction
            const serializedTransaction = transaction.serialize({ requireAllSignatures: false }).toString('base64');

            // Update daily purchase amount after successful transaction
            dailyPurchases.set(recipient.toString(), { amount: amount, timestamp: Date.now() });

            res.json({
                transaction: serializedTransaction,
                authorityPublicKey: tokenAuthorityKeypair.publicKey.toString(),
                authorityTokenAccount: authorityTokenAccount.toString(),
                recipientTokenAccount: recipientTokenAccount.toString(),
                solPayment: solPayment
            });
        } catch (error) {
            console.error('Error:', error);
            res.status(500).json({ error: error.message || 'Failed to process transaction' });
        }
    }
);

// Finalize transaction endpoint with verification
app.post('/finalize-transaction', verifyTransaction, async (req, res) => {
    try {
        const transaction = req.verifiedTransaction;
        
        // Send the transaction
        const signature = await connection.sendRawTransaction(transaction.serialize());
        
        // Wait for confirmation
        await connection.confirmTransaction(signature);
        
        res.json({ signature });
    } catch (error) {
        console.error('Error finalizing transaction:', error);
        res.status(500).json({ error: 'Failed to finalize transaction' });
    }
});

// Test endpoint to verify token authority
app.get('/test-token-authority', async (req, res) => {
    try {
        // Get token mint info
        const mintInfo = await connection.getAccountInfo(TOKEN_MINT);
        if (!mintInfo) {
            throw new Error('Token mint not found');
        }

        // Get token authority's token account
        const [authorityTokenAccount] = await PublicKey.findProgramAddress(
            [
                tokenAuthorityKeypair.publicKey.toBuffer(),
                TOKEN_PROGRAM_ID.toBuffer(),
                TOKEN_MINT.toBuffer(),
            ],
            ASSOCIATED_TOKEN_PROGRAM_ID
        );

        // Get token account info
        const tokenAccountInfo = await connection.getAccountInfo(authorityTokenAccount);
        
        res.json({
            success: true,
            mintInfo: {
                owner: mintInfo.owner.toString(),
                lamports: mintInfo.lamports,
                dataLength: mintInfo.data.length
            },
            authorityTokenAccount: {
                address: authorityTokenAccount.toString(),
                exists: !!tokenAccountInfo
            }
        });
    } catch (error) {
        console.error('Error testing token authority:', error);
        res.status(500).json({ error: error.message });
    }
});

// Global error handler
app.use((err, req, res, next) => {
    // Log error to console
    console.error('Error:', err);

    // Send to Discord
    notifyDiscord(err, {
        path: req.path,
        method: req.method,
        ip: req.ip,
        userAgent: req.headers['user-agent']
    });

    // Send response to client
    res.status(500).json({ error: 'Internal server error' });
});

// Simple app.listen
app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on port ${port}`);
}); 