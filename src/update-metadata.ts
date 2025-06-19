import { 
    Connection, 
    Keypair, 
    PublicKey,
    clusterApiUrl,
    LAMPORTS_PER_SOL,
    Transaction,
    SystemProgram,
    sendAndConfirmTransaction
} from '@solana/web3.js';
import { 
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
    getAssociatedTokenAddress,
    createAssociatedTokenAccountInstruction,
    createMintToInstruction
} from '@solana/spl-token';

async function main() {
    // Connect to devnet
    const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');

    // Your token mint address
    const mintAddress = new PublicKey('2DiLCybqbkNzkPPL63WmMknVTCSXs8Pom5ZP1SCMYupG');
    
    // The wallet that paid for the token creation (same as before)
    const payer = Keypair.generate(); // You should use the same keypair as before
    
    // Request airdrop for metadata creation
    const airdropSignature = await connection.requestAirdrop(
        payer.publicKey,
        1 * LAMPORTS_PER_SOL
    );
    await connection.confirmTransaction(airdropSignature);

    try {
        // Get the associated token account address
        const associatedTokenAddress = await getAssociatedTokenAddress(
            mintAddress,
            payer.publicKey,
            false,
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
        );

        // Create a transaction to create the associated token account and mint tokens
        const transaction = new Transaction();

        // Add instruction to create the associated token account if it doesn't exist
        transaction.add(
            createAssociatedTokenAccountInstruction(
                payer.publicKey,
                associatedTokenAddress,
                payer.publicKey,
                mintAddress,
                TOKEN_PROGRAM_ID,
                ASSOCIATED_TOKEN_PROGRAM_ID
            )
        );

        // Add instruction to mint tokens to the associated token account
        transaction.add(
            createMintToInstruction(
                mintAddress,
                associatedTokenAddress,
                payer.publicKey,
                1000000000, // Amount to mint (1 token with 9 decimals)
                [],
                TOKEN_PROGRAM_ID
            )
        );

        // Send and confirm the transaction
        const signature = await sendAndConfirmTransaction(
            connection,
            transaction,
            [payer]
        );

        console.log('Token minted successfully!');
        console.log('Transaction signature:', signature);
        console.log('Associated token account:', associatedTokenAddress.toString());
        
    } catch (error) {
        console.error('Error minting token:', error);
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
}); 