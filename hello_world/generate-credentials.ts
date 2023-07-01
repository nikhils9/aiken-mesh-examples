import { AppWallet, resolvePrivateKey } from "npm:@meshsdk/core@1.5.4";

// Generate a menomic phrase to create new wallet subsequently
const mnemonic = AppWallet.brew();

const privateKey = resolvePrivateKey(mnemonic);
await Deno.writeTextFile("key.sk", privateKey);

// Create a wallet instance for testnet (networkId == 0)
// Fun fact: The testnet wallet created will work for both Preview & Preprod. You decide which network you want to use.
const wallet = new AppWallet({
    networkId: 0,
    key: {
      type: 'mnemonic',
      words: mnemonic,
    },
});

const address = wallet.getPaymentAddress();
await Deno.writeTextFile("key.addr", address);
