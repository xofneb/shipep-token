const { Connection, PublicKey, LAMPORTS_PER_SOL } = require('@solana/web3.js');
require('dotenv').config();

async function checkTreasury() {
    try {
        // Connect to devnet
        const connection = new Connection('https://api.devnet.solana.com');

        // Get treasury account from .env
        const treasuryAccount = new PublicKey(process.env.TREASURY_ACCOUNT);
        console.log('Treasury Account:', treasuryAccount.toString());

        // Get balance
        const balance = await connection.getBalance(treasuryAccount);
        console.log('Balance:', balance / LAMPORTS_PER_SOL, 'SOL');

        // Get recent transactions
        console.log('\nRecent transactions:');
        const signatures = await connection.getSignaturesForAddress(treasuryAccount);
        for (const sig of signatures) {
            const tx = await connection.getTransaction(sig.signature);
            if (tx) {
                const preBalances = tx.meta.preBalances;
                const postBalances = tx.meta.postBalances;
                const change = (postBalances[0] - preBalances[0]) / LAMPORTS_PER_SOL;
                console.log(`\nTransaction: ${sig.signature}`);
                console.log(`Time: ${new Date(sig.blockTime * 1000).toLocaleString()}`);
                console.log(`Balance Change: ${change} SOL`);
            }
        }

    } catch (error) {
        console.error('Error checking treasury:', error);
    }
}

checkTreasury(); 