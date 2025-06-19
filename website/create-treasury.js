const { Connection, Keypair, LAMPORTS_PER_SOL } = require('@solana/web3.js');
require('dotenv').config();

async function createTreasury() {
    try {
        // Connect to devnet
        const connection = new Connection('https://api.devnet.solana.com');

        // Generate new keypair for treasury
        const treasuryKeypair = Keypair.generate();
        console.log('Generated new treasury keypair');
        console.log('Public Key:', treasuryKeypair.publicKey.toString());
        
        // Convert private key to array for .env file
        const privateKeyArray = Array.from(treasuryKeypair.secretKey);
        console.log('\nPrivate Key (array):', privateKeyArray.join(','));

        // Request airdrop of 1 SOL
        console.log('\nRequesting airdrop of 1 SOL...');
        const signature = await connection.requestAirdrop(
            treasuryKeypair.publicKey,
            LAMPORTS_PER_SOL
        );
        
        // Wait for confirmation
        await connection.confirmTransaction(signature);
        console.log('Airdrop successful!');

        // Get balance
        const balance = await connection.getBalance(treasuryKeypair.publicKey);
        console.log('\nTreasury account balance:', balance / LAMPORTS_PER_SOL, 'SOL');

        console.log('\nAdd this to your .env file:');
        console.log('TREASURY_ACCOUNT=' + treasuryKeypair.publicKey.toString());
        console.log('TREASURY_PRIVATE_KEY=' + privateKeyArray.join(','));

    } catch (error) {
        console.error('Error creating treasury:', error);
    }
}

createTreasury(); 