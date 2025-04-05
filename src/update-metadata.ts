import { 
    Connection, 
    Keypair, 
    PublicKey,
    clusterApiUrl,
    LAMPORTS_PER_SOL
} from '@solana/web3.js';
import { Metaplex } from "@metaplex-foundation/js";

async function main() {
    // Connect to devnet
    const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');

    // Your token mint address
    const mintAddress = new PublicKey('HBUgs6vyK3Vj59tD4w2u6QpUL3rTFyJwfe6TeXdkDXhd');
    
    // Initialize Metaplex
    const metaplex = new Metaplex(connection);
    
    // The wallet that paid for the token creation (same as before)
    const payer = Keypair.generate(); // You should use the same keypair as before
    
    // Request airdrop for metadata creation
    const airdropSignature = await connection.requestAirdrop(
        payer.publicKey,
        1 * LAMPORTS_PER_SOL
    );
    await connection.confirmTransaction(airdropSignature);

    try {
        // Update metadata
        const result = await metaplex
            .nfts()
            .update({
                nftOrSft: {
                    address: mintAddress,
                    name: "ShibaPepe Coin",
                    symbol: "SHIPEP",
                    uri: "https://raw.githubusercontent.com/xofneb/shipep-token/main/metadata/metadata.json",
                    sellerFeeBasisPoints: 0,
                    tokenStandard: 0, // Fungible
                    creators: [],
                    collection: undefined,
                    uses: undefined,
                    programmableConfig: undefined
                }
            });

        console.log('Metadata updated successfully!');
        console.log('Update completed');
        
    } catch (error) {
        console.error('Error updating metadata:', error);
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
}); 