import { 
    AppWallet, 
    BlockfrostProvider, 
    PlutusScript, 
    resolvePlutusScriptAddress,
    resolvePaymentKeyHash,
    Data,
    Transaction  
} from "npm:@meshsdk/core@1.5.4";
import { fromHex, toHex } from "https://deno.land/x/lucid@0.8.3/mod.ts";
import * as cbor from "https://deno.land/x/cbor@v1.4.1/index.js";

const blockchainProvider = new BlockfrostProvider(Deno.env.get("BLOCKFROST_API_KEY"));

const wallet = new AppWallet({
    networkId: 0,
    fetcher: blockchainProvider,
    submitter: blockchainProvider,
    key: {
      type: 'root',
      bech32: await Deno.readTextFile("./key.sk")
    },
  });

const validator = await readValidator();

// --- Supporting functions

async function readValidator(): Promise<PlutusScript> {
    const validator = JSON
        .parse(await Deno.readTextFile("plutus.json"))
        .validators[0];

    return {
        version: "V2",
        code: toHex(cbor.encode(fromHex(validator.compiledCode)))
    };
}

const publicKeyHash = resolvePaymentKeyHash(await wallet.getPaymentAddress());

const datum: Data = {
    alternative: 0,
    fields: [publicKeyHash]
}
  
const txHash = await lock('1500000', { into: validator, owner: datum });

console.log(`1.5 tADA locked into the contract at:
    Tx ID: ${txHash}
    Datum: ${datum}
`);

// --- Supporting functions

async function lock(
  lovelace: string,
  { into, owner }: { into: PlutusScript; owner: Data },
): Promise<string> {

    const contractAddress = resolvePlutusScriptAddress(into, 0);

    const tx = new Transaction({ initiator: wallet })
        .sendLovelace({
            address: contractAddress,
            datum: {
                value: owner,
                inline: true
            }
        }, lovelace);

    const unsignedTx = await tx.build();
    const signedTx = await wallet.signTx(unsignedTx);
    const txHash = await wallet.submitTx(signedTx);

    return txHash;
}