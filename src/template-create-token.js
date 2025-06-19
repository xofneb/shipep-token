const { 
    Connection, 
    Keypair, 
    PublicKey,
    clusterApiUrl,
    LAMPORTS_PER_SOL,
    Transaction,
    SystemProgram,
    sendAndConfirmTransaction
} = require('@solana/web3.js');

const { 
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
    getAssociatedTokenAddress,
    createInitializeMintInstruction,
    createAssociatedTokenAccountInstruction,
    createMintToInstruction,
    getMint,
    createMint,
    getOrCreateAssociatedTokenAccount,
    mintTo
} = require('@solana/spl-token');

// Load environment variables
require('dotenv').config();

async function main() {
    try {
        // Connect to devnet
        const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');

        // SECURE: Load private key from environment variable
        const privateKeyString = process.env.PRIVATE_KEY;
        if (!privateKeyString) {
            throw new Error('PRIVATE_KEY not found in environment variables');
        }
        
        // Convert private key string to Uint8Array
        const privateKeyArray = privateKeyString.split(',').map(num => parseInt(num));
        const payer = Keypair.fromSecretKey(new Uint8Array(privateKeyArray));
        
        console.log('Using Token Authority:', payer.publicKey.toString());

        // Check balance
        const balance = await connection.getBalance(payer.publicKey);
        console.log('Current balance:', balance / LAMPORTS_PER_SOL, 'SOL');

        if (balance < 0.5 * LAMPORTS_PER_SOL) {
            console.error('Not enough SOL. Please get more SOL from https://faucet.solana.com');
            return;
        }

        // Create new token mint
        console.log('Creating token mint...');
        const mint = await createMint(
            connection,
            payer,           // Payer of the transaction and initialization fees
            payer.publicKey, // Account that will control minting
            payer.publicKey, // Account that will control freezing
            9               // Number of decimals in token accounts
        );
        console.log('Token mint created:', mint.toBase58());

        // Create associated token account
        console.log('Creating associated token account...');
        const tokenAccount = await getOrCreateAssociatedTokenAccount(
            connection,
            payer,
            mint,
            payer.publicKey
        );
        console.log('Token account:', tokenAccount.address.toString());

        console.log('Minting initial tokens...');
        // Mint some tokens to the token account
        const mintAmount = 1000000000000; // 1000 tokens (with 9 decimals)
        await mintTo(
            connection,
            payer,
            mint,
            tokenAccount.address,
            payer,
            mintAmount
        );

        console.log('Token created and minted successfully!');
        console.log('\nIMPORTANT: Save these values:');
        console.log('Token Mint Address:', mint.toBase58());
        console.log('Token Account:', tokenAccount.address.toString());
        console.log('Token Authority Public Key:', payer.publicKey.toString());
        
    } catch (error) {
        console.error('Error:', error);
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
}); 