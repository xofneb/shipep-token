// Token configuration - removed client-side constants
// DOM elements
const connectWalletBtn = document.getElementById('connectWallet');
const amountInput = document.getElementById('amount');
const buyTokensBtn = document.getElementById('buyTokens');
const tokenDetailsDiv = document.getElementById('tokenDetails');

// Display token information - get from server
fetch('/token-info')
    .then(response => response.json())
    .then(data => {
        tokenDetailsDiv.innerHTML = `
            <h3>ShibaPepe Coin</h3>
            <p><strong>Symbol:</strong> ${data.symbol}</p>
            <p><strong>Price:</strong> ${data.price} SOL per token</p>
            <p class="network-warning">⚠️ This is a test token on Solana Devnet</p>
        `;
    })
    .catch(error => {
        console.error('Error fetching token info:', error);
        tokenDetailsDiv.innerHTML = '<p>Error loading token information</p>';
    });

// Connect wallet button click handler
connectWalletBtn.addEventListener('click', async () => {
    try {
        // Verify Solflare wallet
        if (!window.solflare) {
            throw new Error('Please install Solflare wallet');
        }

        // Additional wallet verification
        if (!window.solflare.isSolflare) {
            throw new Error('Please use the official Solflare wallet');
        }

        const wallet = window.solflare;
        await wallet.connect();
        
        // Verify connection
        if (!wallet.isConnected) {
            throw new Error('Failed to connect wallet');
        }

        // Verify public key
        if (!wallet.publicKey) {
            throw new Error('Invalid wallet connection');
        }
        
        // Update UI
        connectWalletBtn.textContent = 'Connected';
        connectWalletBtn.disabled = true;
        buyTokensBtn.disabled = false;
        
        alert('Wallet connected successfully!');
    } catch (error) {
        console.error('Error connecting wallet:', error);
        alert('Failed to connect wallet: ' + error.message);
    }
});

// Buy tokens button click handler
buyTokensBtn.addEventListener('click', async () => {
    let transaction; // Declare transaction outside try block
    try {
        // Verify wallet connection
        if (!window.solflare || !window.solflare.isConnected || !window.solflare.isSolflare) {
            throw new Error('Please connect your wallet first');
        }

        // Input validation
        const amount = parseInt(amountInput.value);
        if (isNaN(amount) || amount <= 0) {
            alert('Please enter a valid amount');
            return;
        }

        // Get price from server
        const priceResponse = await fetch('/token-info');
        if (!priceResponse.ok) {
            throw new Error('Failed to get token price');
        }
        const { price } = await priceResponse.json();
        
        // Calculate SOL payment amount
        const solPayment = amount * price;
        
        // Show confirmation dialog with formatted numbers
        const confirmMessage = `You are about to purchase ${amount.toLocaleString()} SHIPEP tokens for ${solPayment.toFixed(3)} SOL.`;
        if (!confirm(confirmMessage)) {
            return;
        }

        // Show loading state
        buyTokensBtn.disabled = true;
        buyTokensBtn.textContent = 'Processing...';

        const wallet = window.solflare;
        const recipient = wallet.publicKey.toString();
        
        // Create transaction request
        const response = await fetch('/buy-tokens', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                recipient: recipient,
                amount: amount
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to create transaction');
        }

        const { transaction: serializedTransaction } = await response.json();

        // Safely deserialize the transaction
        try {
            const transactionBuffer = new Uint8Array(atob(serializedTransaction).split('').map(c => c.charCodeAt(0)));
            transaction = solanaWeb3.Transaction.from(transactionBuffer);
            
            // Verify transaction structure
            if (!transaction.signatures || !transaction.instructions) {
                throw new Error('Invalid transaction format');
            }
        } catch (error) {
            throw new Error('Failed to process transaction');
        }

        // Sign the transaction with the wallet
        const signedTransaction = await wallet.signTransaction(transaction);
        
        // Verify signatures
        if (!signedTransaction.signatures.some(sig => sig.signature)) {
            throw new Error('Transaction not properly signed');
        }

        // Send the signed transaction back to the server
        const finalizeResponse = await fetch('/finalize-transaction', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                signedTransaction: btoa(String.fromCharCode.apply(null, signedTransaction.serialize())),
                originalAmount: amount,
                recipient: recipient
            })
        });

        if (!finalizeResponse.ok) {
            const errorData = await finalizeResponse.json();
            throw new Error(errorData.error || 'Failed to finalize transaction');
        }

        const { signature } = await finalizeResponse.json();
        alert(`Success! Transaction signature: ${signature}\nYou paid ${solPayment.toFixed(3)} SOL for ${amount.toLocaleString()} SHIPEP tokens.`);

    } catch (error) {
        console.error('Error:', error);
        // Sanitize error message for user display
        const userErrorMessage = error.message.includes('Failed to') ? 
            'Transaction failed. Please try again.' : 
            error.message;
        alert(userErrorMessage);
    } finally {
        // Reset button state
        buyTokensBtn.disabled = false;
        buyTokensBtn.textContent = 'Buy Tokens';
    }
});

// Test input validation
const testInputValidation = async () => {
    if (!window.solflare || !window.solflare.isConnected) {
        console.error('Please connect your wallet first');
        alert('Please connect your wallet before running tests');
        return;
    }

    console.log('Starting input validation tests...');
    const testCases = [
        { amount: -1, expected: 'Amount must be a positive integer' },
        { amount: 0, expected: 'Amount must be a positive integer' },
        { amount: 1.5, expected: 'Amount must be a positive integer' },
        { amount: 10001, expected: 'Maximum purchase limit is 10000 tokens (10 SOL)' },
        { amount: '<script>alert(1)</script>', expected: 'Amount must be a positive integer' }
    ];

    console.log('Testing input validation...');
    for (const test of testCases) {
        try {
            console.log(`Testing amount: ${test.amount}`);
            const response = await fetch('/buy-tokens', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    recipient: window.solflare.publicKey.toString(),
                    amount: test.amount
                })
            });
            const data = await response.json();
            console.log(`Test ${test.amount}:`, 
                data.error === test.expected ? '✅ PASSED' : '❌ FAILED',
                `Expected: ${test.expected}, Got: ${data.error}`
            );
        } catch (error) {
            console.error(`Test ${test.amount} failed:`, error);
        }
    }
};

// Test rate limiting
const testRateLimiting = async () => {
    if (!window.solflare || !window.solflare.isConnected) {
        console.error('Please connect your wallet first');
        return;
    }

    console.log('Starting rate limiting tests...');
    const requests = [];
    
    // Make 11 requests (1 more than the limit)
    for (let i = 0; i < 11; i++) {
        console.log(`Making request ${i + 1}/11`);
        requests.push(
            fetch('/buy-tokens', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    recipient: window.solflare.publicKey.toString(),
                    amount: 1
                })
            }).then(async response => {
                const data = await response.json();
                return { status: response.status, data };
            })
        );
    }

    const results = await Promise.all(requests);
    
    // Count how many were rate limited
    const rateLimited = results.filter(r => 
        r.status === 429 && 
        r.data.error === 'Too many requests from this IP, please try again later'
    ).length;
    
    console.log(`Rate limiting test: ${rateLimited > 0 ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Rate limited requests: ${rateLimited}`);
};

// Update test function to include rate limiting
const testSecurityFeatures = async () => {
    if (!window.solflare || !window.solflare.isConnected) {
        console.error('Please connect your wallet first');
        alert('Please connect your wallet before running tests');
        return;
    }

    console.log('Starting all security tests...');
    try {
        await testInputValidation();
        await testRateLimiting();
        console.log('All tests completed!');
    } catch (error) {
        console.error('Error running tests:', error);
    }
};

// Add test button to HTML
const addTestButton = () => {
    console.log('Adding test button...');
    const testButton = document.createElement('button');
    testButton.textContent = 'Run Security Tests';
    testButton.style.marginTop = '20px';
    testButton.style.padding = '10px 20px';
    testButton.style.backgroundColor = '#4CAF50';
    testButton.style.color = 'white';
    testButton.style.border = 'none';
    testButton.style.borderRadius = '5px';
    testButton.style.cursor = 'pointer';
    
    testButton.addEventListener('click', () => {
        console.log('Test button clicked!');
        testSecurityFeatures();
    });
    
    const container = document.querySelector('.container') || document.body;
    container.appendChild(testButton);
    console.log('Test button added successfully');
};

// Run when page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, adding test button...');
    addTestButton();
});

// Initial setup
buyTokensBtn.disabled = true; 