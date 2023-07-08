import { EnvNames, NetworkNames, Sdk } from "etherspot";
import { assert } from "chai";
import axios from "axios";
import Helper from "../../../utils/Helper.js";

import * as dotenv from "dotenv";
dotenv.config(); // init dotenv

let mainNetSdk;
let wait_time = 1000;
let deviationPercentage;

let network_etherspot = [
  "arbitrum",
  "bsc",
  "xdai",
  "matic",
  "optimism",
  "mainnet",
  "fantom",
  "aurora",
  "avalanche",
  "arbitrumNova",
  "moonbeam",
  "celo",
  "fuse",
];

let network_coingecko = [
  "arbitrum-one",
  "binance-smart-chain",
  "xdai",
  "polygon-pos",
  "optimistic-ethereum",
  "ethereum",
  "fantom",
  "aurora",
  "avalanche",
  "arbitrum-nova",
  "moonbeam",
  "celo",
  "fuse",
];

describe("Compare the Token Rates of the Etherspot and Coingecko Services", () => {
  for (let n = 0; n < network_etherspot.length; n++) {
    it("Validate the Token Rates of the Etherspot and Coingecko Services", async () => {
      let tokenListAddress_etherspot = [];
      let tokenListChainId_etherspot;
      let tokenListAddress_coingecko = [];
      let tokenListId_coingecko = [];
      let responsesCoinList_coingecko;
      let requestPayload_etherspot;

      // initialize the sdk
      try {
        mainNetSdk = new Sdk(process.env.PRIVATE_KEY, {
          env: EnvNames.MainNets,
          networkName: network_etherspot[n],
        });

        assert.strictEqual(
          mainNetSdk.state.accountAddress,
          "0xa5494Ed2eB09F37b4b0526a8e4789565c226C84f",
          "The EOA Address is not calculated correctly."
        );
      } catch (e) {
        console.error(e);
        assert.fail("The SDK is not initialled successfully.");
      }

      // Compute the smart wallet address
      try {
        let smartWalletOutput = await mainNetSdk.computeContractAccount();
        let smartWalletAddress = smartWalletOutput.address;

        assert.strictEqual(
          smartWalletAddress,
          "0x666E17ad27fB620D7519477f3b33d809775d65Fe",
          "The smart wallet address is not calculated correctly."
        );
      } catch (e) {
        console.error(e);
        assert.fail("The smart wallet address is not calculated successfully.");
      }

      // Get the token addresses and it's rate from the Coingecko
      try {
        try {
          responsesCoinList_coingecko = await axios.get(
            "https://api.coingecko.com/api/v3/coins/list?include_platform=true"
          );
        } catch (e) {
          console.error(e);
          assert.fail(
            "An error is displayed while getting the token addresses from the Coingecko."
          );
        }

        for (let z = 0; z < responsesCoinList_coingecko.data.length; z++) {
          if (
            typeof responsesCoinList_coingecko.data[z].platforms[
              network_coingecko[n]
            ] === "string" &&
            responsesCoinList_coingecko.data[z].platforms[
              network_coingecko[n]
            ] !== ""
          ) {
            tokenListAddress_coingecko.push(
              responsesCoinList_coingecko.data[z].platforms[
                network_coingecko[n]
              ]
            );
            tokenListId_coingecko.push(responsesCoinList_coingecko.data[z].id);
          }
        }
      } catch (e) {
        console.error(e);
        assert.fail(
          "An error is displayed while getting the token addresses and it's rate from the Coingecko."
        );
      }

      try {
        // get the token list of the Etherspot
        let TokenDetails = await mainNetSdk.getTokenListTokens({
          name: "EtherspotPopularTokens",
        });

        // get the list of token address of the Etherspot
        for (let x = 0; x < TokenDetails.length; x++) {
          tokenListAddress_etherspot.push(TokenDetails[x].address);
        }

        // get the chain id of the Etherspot
        tokenListChainId_etherspot = TokenDetails[0].chainId;

        // Request payload for fetch the token rates informaiton of the Etherspot
        requestPayload_etherspot = {
          tokens: tokenListAddress_etherspot,
          chainId: tokenListChainId_etherspot,
        };
      } catch (e) {
        console.error(e);
        assert.fail(
          "An error is displayed while fetching the rate of the token from Etherspot."
        );
      }

      // Fetch the token rates of the Etherspot and compare with coingecko
      try {
        let rates = await mainNetSdk.fetchExchangeRates(
          requestPayload_etherspot
        );
        for (let y = 0; y < rates.items.length; y++) {
          for (let j = 0; j < tokenListAddress_coingecko.length; j++) {
            Helper.wait(wait_time);
            let etherspotAddress = rates.items[y].address;
            console.log("Etherspot Address:", etherspotAddress.toLowerCase());
            console.log("Coingecko Address:", tokenListAddress_coingecko[j]);
            if (
              etherspotAddress.toLowerCase() === tokenListAddress_coingecko[j]
            ) {
              Helper.wait(wait_time);

              let responsesCoidMarket = await axios.get(
                "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=" +
                  tokenListId_coingecko[j] +
                  "&per_page=100&page=1&sparkline=true&locale=en"
              );

              let num1 = responsesCoidMarket.data[0].current_price; // rates of the coingecko
              let num2 = rates.items[y].usd; // rates of the etherspot

              deviationPercentage =
                (Math.abs(num1 - num2) / ((num1 + num2) / 2)) * 100;
              if (deviationPercentage > 5) {
                assert.fail(
                  "The rate of the " +
                    tokenListId_coingecko[j] +
                    " token of the Etherspot is " +
                    rates.items[y].usd +
                    " and the Coingecko is " +
                    responsesCoidMarket.data[0].current_price +
                    ". So rate variation of both tokens is not displayed correctly for the " +
                    network_etherspot[n].toUpperCase() +
                    " Network."
                );
              } else {
                console.log(
                  "The rate of the " +
                    tokenListId_coingecko[j] +
                    " token of the Etherspot is " +
                    rates.items[y].usd +
                    " and the Coingecko is " +
                    responsesCoidMarket.data[0].current_price +
                    ". So rate variation of both tokens is displayed correctly for the " +
                    network_etherspot[n].toUpperCase() +
                    " Network."
                );
              }
              break;
            }
          }
        }
      } catch (e) {
        console.error(e);
        assert.fail(
          "An error is displayed while comparing the rates of the Etherspot and Coingecko."
        );
      }
    });
  }
});
