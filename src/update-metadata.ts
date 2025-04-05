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
        const { nft } = await metaplex
            .nfts()
            .update({
                nftOrSft: {
                    address: mintAddress,
                    mint: mintAddress,
                    tokenStandard: 0, // Fungible
                },
                name: "ShibaPepe Coin",
                symbol: "SHIPEP",
                uri: "https://raw.githubusercontent.com/xofneb/shipep-token/main/metadata/metadata.json",
                sellerFeeBasisPoints: 0,
            });

        console.log('Metadata updated successfully!');
        console.log('Metadata address:', nft.address.toString());
        
    } catch (error) {
        console.error('Error updating metadata:', error);
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
}); 