import { AppWallet } from "npm:meshsdk/core";

const mnemonic = AppWallet.brew();

console.log(mnemonic);