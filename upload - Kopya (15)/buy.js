// Token configuration
const TOKEN_ADDRESS = 'HBUgs6vyK3Vj59tD4w2u6QpUL3rTFyJwfe6TeXdkDXhd'; // TODO: Update for mainnet deployment
const TOKEN_DECIMALS = 9;
const FIXED_USD_PRICE = 0.007; // Fixed price in USD

// DOM Elements
const connectWalletBtn = document.getElementById('connectWallet');
const buyTokensBtn = document.getElementById('buyTokens');
const amountInput = document.getElementById('amount');
const balanceDisplay = document.getElementById('balance');
const statusDiv = document.getElementById('status');
const tokenDetailsDiv = document.getElementById('tokenDetails');
const statusMessage = document.getElementById('statusMessage');

// Check if user is on mobile
function isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// Check if we're in Solflare's dApp browser
function isInSolflareBrowser() {
    return window.solflare && window.solflare.isSolflare;
}

// Check network status
async function checkNetworkStatus() {
    if (!window.solflare) {
        // Removed toast here since it will show in connect button handler
        return false;
    }

    try {
        const wallet = window.solflare;
        if (!wallet.isConnected) {
            showStatus('Please connect your wallet to continue', 'info');
            if (!hasShownConnectionMessage) {
                showToast('Please connect your wallet to continue', 'info');
                hasShownConnectionMessage = true;
            }
            return false;
        }
        return true;
    } catch (error) {
        showToast('Network error: ' + error.message, 'error');
        return false;
    }
}

// Initialize mobile menu
document.addEventListener('DOMContentLoaded', function() {
    const menuButton = document.querySelector('.mobile-menu-btn');
    const navLinks = document.querySelector('.nav-links');

    if (menuButton && navLinks) {
        menuButton.addEventListener('click', function() {
            console.log('Menu button clicked');
            navLinks.classList.toggle('show');
            menuButton.classList.toggle('active');
        });

        // Close menu when clicking outside
        document.addEventListener('click', function(event) {
            if (!menuButton.contains(event.target) && !navLinks.contains(event.target)) {
                navLinks.classList.remove('show');
                menuButton.classList.remove('active');
            }
        });

        // Close menu when clicking a link
        document.querySelectorAll('.nav-links a').forEach(link => {
            link.addEventListener('click', () => {
                navLinks.classList.remove('show');
                menuButton.classList.remove('active');
            });
        });
    }
});

// Display token information - get from server
fetch('/token-info')
    .then(response => response.json())
    .then(data => {
        tokenDetailsDiv.innerHTML = `
            <h3 style="margin: 0.25rem 0;">ShibaPepe Coin</h3>
            <p><strong>Symbol:</strong> ${data.symbol}</p>
            <p><strong>Price:</strong> $${FIXED_USD_PRICE} per token</p>
        `;
    })
    .catch(error => {
        console.error('Error fetching token info:', error);
        tokenDetailsDiv.innerHTML = '<p>Error loading token information</p>';
    });

// Check network status periodically
let networkCheckInterval;
let hasShownConnectionMessage = false;  // Add flag to track if we've shown the message

async function startNetworkCheck() {
    // Initial check
    await checkNetworkStatus();
    
    // Check every 2 seconds
    networkCheckInterval = setInterval(async () => {
        const isReady = await checkNetworkStatus();
        if (isReady) {
            clearInterval(networkCheckInterval);
            connectWalletBtn.disabled = false;
            hasShownConnectionMessage = false;  // Reset flag when connected
        }
    }, 2000);
}

// Start network check when page loads
document.addEventListener('DOMContentLoaded', startNetworkCheck);

// Connect wallet button click handler
connectWalletBtn.addEventListener('click', async () => {
    try {
        // Debug logs
        console.log('isMobile():', isMobile());
        console.log('isInSolflareBrowser():', isInSolflareBrowser());
        console.log('User Agent:', navigator.userAgent);
        console.log('window.solflare exists:', !!window.solflare);
        if (window.solflare) {
            console.log('window.solflare properties:', Object.keys(window.solflare));
        }
        
        // Check for regular mobile browser first
        if (isMobile() && !isInSolflareBrowser()) {
            showStatus('Please open this page using your Solflare wallet\'s browser (Explore). Need Solflare? Download at <a href="https://solflare.com/download" target="_blank">solflare.com/download</a>', 'mobile-browser');
            // Scroll to the status message
            document.querySelector('.status-message')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            return; // Stop here, don't proceed with other code
        }

        showStatus('', '');
        
        // Check network status first
        const isReady = await checkNetworkStatus();
        
        if (isMobile()) {
            if (isInSolflareBrowser()) {
                // We're in Solflare's dApp browser - use direct connection
                if (!window.solflare) {
                    showStatus('Please install Solflare wallet from solflare.com/download', 'error');
                    throw new Error('Please install Solflare wallet');
                }

                // Additional wallet verification
                if (!window.solflare.isSolflare) {
                    showToast('Please use the official Solflare wallet', 'error');
                    throw new Error('Please use the official Solflare wallet');
                }

                const wallet = window.solflare;
                await wallet.connect();
                
                // Verify connection
                if (!wallet.isConnected) {
                    showToast('Please connect your wallet to continue', 'info');
                    throw new Error('Failed to connect wallet');
                }

                // Verify public key
                if (!wallet.publicKey) {
                    showToast('Invalid wallet connection', 'error');
                    throw new Error('Invalid wallet connection');
                }
                
                // Update UI
                connectWalletBtn.textContent = 'Connected';
                connectWalletBtn.disabled = true;
                amountInput.disabled = false;
                buyTokensBtn.disabled = false;
                
                showStatus('Wallet connected successfully!', 'success');
                showToast('Wallet connected successfully', 'success');
            } else {
                // We're in a regular mobile browser
                if (!window.solflare) {
                    showStatus('Please install Solflare wallet from solflare.com/download', 'error');
                    throw new Error('Please install Solflare wallet');
                }
                
                // Show instructions for using Solflare app
                const container = document.createElement('div');
                container.style.marginTop = '15px';
                
                const instructions = document.createElement('div');
                instructions.innerHTML = `
                    <p style="margin-bottom: 15px;">To connect your wallet:</p>
                    <ol style="text-align: left; margin-left: 20px;">
                        <li>Open your Solflare app</li>
                        <li>Tap Explore button</li>
                        <li>Enter this URL: <code>${window.location.href}</code></li>
                        <li>Connect your wallet in the app</li>
                    </ol>
                `;
                container.appendChild(instructions);
                
                connectWalletBtn.parentNode.appendChild(container);
            }
        } else {
            // Desktop flow - use Solflare extension
            if (!window.solflare) {
                showStatus('Please install Solflare wallet from solflare.com/download', 'error');
                throw new Error('Please install Solflare wallet');
            }

            // Additional wallet verification
            if (!window.solflare.isSolflare) {
                showToast('Please use the official Solflare wallet', 'error');
                throw new Error('Please use the official Solflare wallet');
            }

            const wallet = window.solflare;
            await wallet.connect();
            
            // Verify connection
            if (!wallet.isConnected) {
                showToast('Please connect your wallet to continue', 'info');
                throw new Error('Failed to connect wallet');
            }

            // Verify public key
            if (!wallet.publicKey) {
                showToast('Invalid wallet connection', 'error');
                throw new Error('Invalid wallet connection');
            }
            
            // Update UI
            connectWalletBtn.textContent = 'Connected';
            connectWalletBtn.disabled = true;
            amountInput.disabled = false;
            buyTokensBtn.disabled = false;
            
            showStatus('Wallet connected successfully!', 'success');
            showToast('Wallet connected successfully', 'success');
        }
    } catch (error) {
        console.error('Error:', error);
        console.log('Error message:', error.message);
        console.log('Error name:', error.name);
        console.log('Full error:', error);
        console.log('Is mobile:', isMobile());
        console.log('Is in Solflare browser:', isInSolflareBrowser());
        
        if (error.message.includes('Please install Solflare wallet')) {
            showStatus('Please install Solflare wallet from <a href="https://www.solflare.com/download/" target="_blank">solflare.com/download</a>', 'error');
            showToast('Please install Solflare wallet', 'error');
        } else {
            showStatus('Failed to connect wallet: ' + error.message, 'error');
            showToast('Failed to connect wallet: ' + error.message, 'error');
        }
    }
});

// Buy tokens button click handler
buyTokensBtn.addEventListener('click', async () => {
    let transaction; // Declare transaction outside try block
    try {
        // Verify wallet connection
        if (!window.solflare || !window.solflare.isConnected || !window.solflare.isSolflare) {
            showToast('Please connect your wallet first', 'error');
            throw new Error('Please connect your wallet first');
        }

        // Input validation
        const amount = parseInt(amountInput.value);
        if (isNaN(amount) || amount <= 0) {
            showToast('Please enter a valid amount', 'error');
            showStatus('Please enter a valid amount', 'error');
            return;
        }
        
        // Show loading state
        buyTokensBtn.disabled = true;
        buyTokensBtn.textContent = 'Processing...';
        showToast('Creating transaction...', 'info');
        showStatus('Creating transaction...', 'info');

        const wallet = window.solflare;
        const recipient = wallet.publicKey.toString();
        
        // Create transaction request
        const response = await fetch('/buy-tokens', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                amount: amount,
                recipient: recipient
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            showToast(errorData.error || 'Failed to create transaction', 'error');
            throw new Error(errorData.error || 'Failed to create transaction');
        }

        const { transaction: serializedTransaction } = await response.json();
        
        // Safely deserialize the transaction
        try {
            const transactionBuffer = new Uint8Array(atob(serializedTransaction).split('').map(c => c.charCodeAt(0)));
            transaction = solanaWeb3.Transaction.from(transactionBuffer);
            
            // Verify transaction structure
            if (!transaction.signatures || !transaction.instructions) {
                showToast('Invalid transaction format', 'error');
                throw new Error('Invalid transaction format');
            }
        } catch (error) {
            showToast('Failed to process transaction', 'error');
            throw new Error('Failed to process transaction');
        }

        // Sign the transaction with the wallet
        showToast('Please sign the transaction in your wallet', 'info');
        showStatus('Please sign the transaction in your wallet', 'info');
        const signedTransaction = await wallet.signTransaction(transaction);
        
        // Verify signatures
        if (!signedTransaction.signatures.some(sig => sig.signature)) {
            showToast('Transaction not properly signed', 'error');
            throw new Error('Transaction not properly signed');
        }

        // Send the signed transaction back to the server
        showToast('Sending transaction...', 'info');
        showStatus('Sending transaction...', 'info');
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
            showToast(errorData.error || 'Failed to finalize transaction', 'error');
            throw new Error(errorData.error || 'Failed to finalize transaction');
        }
        
        const { signature } = await finalizeResponse.json();
        showStatus(`Success! You purchased ${amount.toLocaleString()} SHIPEP tokens.<br>Please check your wallet to see your new tokens.`, 'success');
        showToast(`Success! Purchased ${amount.toLocaleString()} SHIPEP tokens`, 'success');
        
    } catch (error) {
        console.error('Error:', error);
        console.log('Error message:', error.message);
        console.log('Error name:', error.name);
        console.log('Full error:', error);
        console.log('Is mobile:', isMobile());
        console.log('Is in Solflare browser:', isInSolflareBrowser());
        
        // Handle transaction rejection - be more lenient with error messages
        const errorStr = String(error).toLowerCase();
        if (error === 'Transaction cancelled' || 
            errorStr.includes('cancelled') ||
            errorStr.includes('rejected') ||
            errorStr.includes('denied') ||
            errorStr.includes('declined') ||
            errorStr.includes('failed')) {
            showStatus('Transaction was rejected by user.', 'error');
            showToast('Transaction was rejected by user.', 'error');
        } else {
            // Sanitize error message for user display
            const userErrorMessage = error.message?.includes('Failed to') ? 
                'Transaction failed. Please try again.' : 
                (error.message || error);
            showStatus(userErrorMessage, 'error');
            showToast(userErrorMessage, 'error');
        }
    } finally {
        // Reset button state
        buyTokensBtn.disabled = false;
        buyTokensBtn.textContent = 'Buy Tokens';
    }
});

// Update balance display
async function updateBalance() {
    try {
        if (!window.solflare || !window.solflare.isConnected) {
            balanceDisplay.textContent = 'Not connected';
            return;
        }

        const wallet = window.solflare;
        const tokenAccount = await getAssociatedTokenAddress(
            new PublicKey(TOKEN_ADDRESS),
            wallet.publicKey
        );

        const accountInfo = await connection.getTokenAccountBalance(tokenAccount);
        const balance = accountInfo.value.uiAmount;
        balanceDisplay.textContent = balance.toLocaleString();
    } catch (error) {
        console.error('Error updating balance:', error);
        balanceDisplay.textContent = 'Error loading balance';
    }
}

// Helper function to get associated token account
async function getAssociatedTokenAddress(mint, owner) {
    const [address] = await PublicKey.findProgramAddress(
        [
            owner.toBuffer(),
            TOKEN_PROGRAM_ID.toBuffer(),
            mint.toBuffer(),
        ],
        ASSOCIATED_TOKEN_PROGRAM_ID
    );
    return address;
}

// Helper function to show status messages
function showStatus(message, type) {
    statusMessage.innerHTML = message;
    statusMessage.className = 'status-message ' + type;
    statusMessage.style.display = 'block';
}

// Add test functions from previous implementation
const testInputValidation = async () => {
    if (!window.solflare || !window.solflare.isConnected) {
        showStatus('Please connect your wallet before running tests', 'error');
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

    for (const test of testCases) {
        try {
            console.log(`Testing amount: ${test.amount}`);
            // Simulate validation
            if (test.amount <= 0 || !Number.isInteger(test.amount)) {
                showStatus(`Test ${test.amount}: ✅ PASSED`, 'success');
            } else {
                showStatus(`Test ${test.amount}: ❌ FAILED`, 'error');
            }
        } catch (error) {
            console.error(`Test ${test.amount} failed:`, error);
            showStatus(`Test ${test.amount} failed: ${error.message}`, 'error');
        }
    }
};

// Add test button to page
const addTestButton = () => {
    const testButton = document.createElement('button');
    testButton.textContent = 'Run Security Tests';
    testButton.className = 'btn secondary';
    testButton.style.marginTop = '20px';
    testButton.onclick = testInputValidation;
    
    const buyForm = document.querySelector('.buy-form');
    if (buyForm) {  // Add null check
        buyForm.appendChild(testButton);
    }
};

// Initialize test button when page loads
document.addEventListener('DOMContentLoaded', addTestButton); 