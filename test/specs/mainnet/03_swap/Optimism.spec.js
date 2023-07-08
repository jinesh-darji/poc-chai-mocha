import * as dotenv from "dotenv";
dotenv.config();

import {
  NETWORK_NAME_TO_CHAIN_ID,
  CrossChainServiceProvider,
  EnvNames,
  NetworkNames,
  Sdk,
} from "etherspot";
import { ethers, utils } from "ethers";
import { assert } from "chai";
import pkg from "@etherspot/contracts";

let optimismMainNetSdk;
let optimismSmartWalletAddress;
let optimismSmartWalletOutput;
let optimismNativeAddress = null;
let optimismUsdcAddress = "0x7F5c764cBc14f9669B88837ca1490cCa17c31607";
let optimismUsdtAddress = "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58";
let xdaiUsdcAddress = "0xDDAfbb505ad214D7b80b1f830fcCc89B60fb7A83";
let runTest;

describe("The SDK, when swap the token with different features with the optimism network on the MainNet", () => {
  beforeEach("Checking the sufficient wallet balance", async () => {
    // initialize the sdk
    try {
      optimismMainNetSdk = new Sdk(process.env.PRIVATE_KEY, {
        env: EnvNames.MainNets,
        networkName: NetworkNames.Optimism,
      });

      assert.strictEqual(
        optimismMainNetSdk.state.accountAddress,
        "0xa5494Ed2eB09F37b4b0526a8e4789565c226C84f",
        "The EOA Address is not calculated correctly."
      );
    } catch (e) {
      console.error(e);
      assert.fail("The SDK is not initialled successfully.");
    }

    // Compute the smart wallet address
    try {
      optimismSmartWalletOutput =
        await optimismMainNetSdk.computeContractAccount();
      optimismSmartWalletAddress = optimismSmartWalletOutput.address;

      assert.strictEqual(
        optimismSmartWalletAddress,
        "0x666E17ad27fB620D7519477f3b33d809775d65Fe",
        "The smart wallet address is not calculated correctly."
      );
    } catch (e) {
      console.error(e);
      assert.fail("The smart wallet address is not calculated successfully.");
    }

    let output = await optimismMainNetSdk.getAccountBalances();
    let native_balance;
    let usdc_balance;
    let usdt_balance;
    let native_final;
    let usdc_final;
    let usdt_final;
    let minimum_token_balance = 2;
    let minimum_native_balance = 0.01;

    for (let i = 0; i < output.items.length; i++) {
      let tokenAddress = output.items[i].token;
      if (tokenAddress === optimismNativeAddress) {
        native_balance = output.items[i].balance;
        native_final = utils.formatUnits(native_balance, 18);
      } else if (tokenAddress === optimismUsdcAddress) {
        usdc_balance = output.items[i].balance;
        usdc_final = utils.formatUnits(usdc_balance, 6);
      } else if (tokenAddress === optimismUsdtAddress) {
        usdt_balance = output.items[i].balance;
        usdt_final = utils.formatUnits(usdt_balance, 6);
      }
    }

    if (
      native_final > minimum_native_balance &&
      usdc_final > minimum_token_balance &&
      usdt_final > minimum_token_balance
    ) {
      runTest = true;
    } else {
      runTest = false;
    }
  });

  it("SMOKE: Perform the single chain swap action on the optimism network", async () => {
    if (runTest) {
      let transactionDetails;
      let TransactionData_count = 0;
      let offers;

      // Get exchange offers
      try {
        offers = await optimismMainNetSdk.getExchangeOffers({
          fromTokenAddress: optimismUsdcAddress, // USDC Token
          toTokenAddress: optimismUsdtAddress, // USDT Token
          fromAmount: ethers.utils.parseUnits("0.0001", 6),
        });

        if (offers.length > 0) {
          for (let j = 0; j < offers.length; j++) {
            transactionDetails = offers[j].transactions;

            try {
              assert.isNotEmpty(
                offers[j].provider,
                "The provider value is empty in the offer response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isNotEmpty(
                offers[j].receiveAmount,
                "The receiveAmount value is empty in the offer response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isNumber(
                offers[j].exchangeRate,
                "The exchangeRate value is not number in the offer response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isNotEmpty(
                offers[j].transactions,
                "The transactions value is empty in the offer response."
              );
            } catch (e) {
              console.error(e);
            }

            for (let x = 0; x < transactionDetails.length; x++) {
              // Batch execute account transaction
              let addTransactionToBatchOutput =
                await optimismMainNetSdk.batchExecuteAccountTransaction(
                  transactionDetails[x]
                );

              try {
                assert.isNotEmpty(
                  addTransactionToBatchOutput.requests[x].to,
                  "The To Address is empty in the batchExecuteAccountTransaction response."
                );
              } catch (e) {
                console.error(e);
              }

              try {
                assert.isNotEmpty(
                  addTransactionToBatchOutput.requests[x].data,
                  "The Data value is empty in the batchExecuteAccountTransaction response."
                );
                let TransactionData_record =
                  addTransactionToBatchOutput.requests;
                TransactionData_count = TransactionData_record.length;
              } catch (e) {
                console.error(e);
              }

              try {
                assert.isNull(
                  addTransactionToBatchOutput.estimation,
                  "It is not expected behaviour of the estimation in the batchExecuteAccountTransaction Response."
                );
              } catch (e) {
                console.error(e);
              }
            }
          }
        } else {
          assert.fail("The offers are not displayed in the offer list.");
        }
      } catch (e) {
        console.error(e);
        assert.fail("An error is displayed while fetching the offers list.");
      }

      // Estimating the batch
      let EstimationResponse;
      let FeeAmount_Estimate;
      let EstimatedGas_Estimate;
      let EstimatedGasPrice_Estimate;

      try {
        EstimationResponse = await optimismMainNetSdk.estimateGatewayBatch();

        for (let k = 0; k < EstimationResponse.requests.length; k++) {
          try {
            assert.isNotEmpty(
              EstimationResponse.requests[k].to,
              "The To Address is empty in the batchExecuteAccountTransaction batch."
            );
          } catch (e) {
            console.error(e);
          }

          try {
            assert.isNotEmpty(
              EstimationResponse.requests[k].data,
              "The Data value is empty in the Estimation Batch response."
            );
          } catch (e) {
            console.error(e);
          }
        }

        try {
          assert.strictEqual(
            TransactionData_count,
            EstimationResponse.requests.length,
            "The count of the request of the EstimationResponse is not displayed correctly."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNotEmpty(
            EstimationResponse.estimation.feeAmount,
            "The feeAmount value is empty in the Estimation Batch Response."
          );
          FeeAmount_Estimate = EstimationResponse.estimation.feeAmount._hex;
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNotEmpty(
            EstimationResponse.estimation.feeTokenReceiver,
            "The feeTokenReceiver Address is empty in the Estimation Batch Response."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNumber(
            EstimationResponse.estimation.estimatedGas,
            "The estimatedGas value is not number in the Estimation Batch Response."
          );
          EstimatedGas_Estimate = EstimationResponse.estimation.estimatedGas;
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNotEmpty(
            EstimationResponse.estimation.estimatedGasPrice,
            "The estimatedGasPrice value is empty in the Estimation Batch Response."
          );
          EstimatedGasPrice_Estimate =
            EstimationResponse.estimation.estimatedGasPrice._hex;
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNotEmpty(
            EstimationResponse.estimation.signature,
            "The signature value is empty in the Estimation Batch Response."
          );
        } catch (e) {
          console.error(e);
        }
      } catch (e) {
        console.error(e);
        assert.fail(
          "The estimation of the batch is not performed successfully."
        );
      }

      // Submitting the batch
      let SubmissionResponse;
      let FeeAmount_Submit;
      let EstimatedGas_Submit;
      let EstimatedGasPrice_Submit;

      try {
        SubmissionResponse = await optimismMainNetSdk.submitGatewayBatch({
          guarded: false,
        });

        try {
          assert.isNull(
            SubmissionResponse.transaction,
            "The transaction is not null in the Submit Batch Response."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNotEmpty(
            SubmissionResponse.hash,
            "The hash value is empty in the Submit Batch Response."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.strictEqual(
            SubmissionResponse.state,
            "Queued",
            "The status of the Submit Batch Response is not displayed correctly."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.strictEqual(
            SubmissionResponse.account,
            optimismSmartWalletAddress,
            "The account address of the Submit Batch Response is not displayed correctly."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNumber(
            SubmissionResponse.nonce,
            "The nonce value is not number in the Submit Batch Response."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNotEmpty(
            SubmissionResponse.to[0],
            "The To Address is empty in the Submit Batch Response."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNotEmpty(
            SubmissionResponse.data[0],
            "The data value is empty in the Submit Batch Response."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.strictEqual(
            TransactionData_count,
            SubmissionResponse.to.length,
            "The count of the To Addresses are not displayed correctly."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.strictEqual(
            TransactionData_count,
            SubmissionResponse.data.length,
            "The count of the data values are not displayed correctly."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNotEmpty(
            SubmissionResponse.senderSignature,
            "The senderSignature value is empty in the Submit Batch Response."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNumber(
            SubmissionResponse.estimatedGas,
            "The Estimated Gas value is not number in the Submit Batch Response."
          );
          EstimatedGas_Submit = SubmissionResponse.estimatedGas;
        } catch (e) {
          console.error(e);
        }

        try {
          assert.strictEqual(
            EstimatedGas_Estimate,
            EstimatedGas_Submit,
            "The Estimated Gas value is not displayed correctly."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNotEmpty(
            SubmissionResponse.estimatedGasPrice._hex,
            "The value of the estimatedGasPrice field of the Submit Batch Response is not displayed."
          );
          EstimatedGasPrice_Submit = SubmissionResponse.estimatedGasPrice._hex;
        } catch (e) {
          console.error(e);
        }

        try {
          assert.strictEqual(
            EstimatedGasPrice_Estimate,
            EstimatedGasPrice_Submit,
            "The Estimated Gas Price value is not displayed correctly."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNull(
            SubmissionResponse.feeToken,
            "The feeToken value is not null in the Submit Batch Response."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNotEmpty(
            SubmissionResponse.feeAmount._hex,
            "The feeAmount value is empty in the Submit Batch Response."
          );
          FeeAmount_Submit = SubmissionResponse.feeAmount._hex;
        } catch (e) {
          console.error(e);
        }

        try {
          assert.strictEqual(
            FeeAmount_Estimate,
            FeeAmount_Submit,
            "The Fee Amount value is not displayed correctly."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNotEmpty(
            SubmissionResponse.feeData,
            "The feeData value is empty in the Submit Batch Response."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNull(
            SubmissionResponse.delayedUntil,
            "The delayedUntil value is npot null in the Submit Batch Response."
          );
        } catch (e) {
          console.error(e);
        }
      } catch (e) {
        console.error(e);
        assert.fail(
          "The submittion of the batch is not performed successfully."
        );
      }
    } else {
      console.warn(
        "DUE TO INSUFFICIENT WALLET BALANCE, SKIPPING TEST CASE OF THE SINGLE CHAIN SWAP ACTION ON THE OPTIMISM NETWORK"
      );
    }
  });

  it("SMOKE: Perform the cross chain quote action on the optimism network", async () => {
    if (runTest) {
      // Prepare the quoteRequest Payload
      let quoteRequestPayload;
      try {
        let fromChainId = NETWORK_NAME_TO_CHAIN_ID[NetworkNames.Optimism];
        let toChainId = NETWORK_NAME_TO_CHAIN_ID[NetworkNames.Xdai];
        let fromTokenAddress = optimismUsdcAddress;
        let toTokenAddress = xdaiUsdcAddress;
        let fromAmount = ethers.utils.parseUnits("0.5", 6);

        quoteRequestPayload = {
          fromChainId: fromChainId,
          toChainId: toChainId,
          fromTokenAddress: fromTokenAddress,
          toTokenAddress: toTokenAddress,
          fromAmount: fromAmount,
          serviceProvider: CrossChainServiceProvider.LiFi, // Optional parameter
        };

        try {
          assert.isNumber(
            quoteRequestPayload.fromChainId,
            "The fromChainId value is not number in the quoteRequest Payload."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNumber(
            quoteRequestPayload.toChainId,
            "The toChainId value is not number in the quoteRequest Payload."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.strictEqual(
            quoteRequestPayload.fromTokenAddress,
            fromTokenAddress,
            "The fromTokenAddress value is not displayed correct in the quoteRequest Payload."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.strictEqual(
            quoteRequestPayload.toTokenAddress,
            toTokenAddress,
            "The toTokenAddress value is not displayed correct in the quoteRequest Payload."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNotEmpty(
            quoteRequestPayload.fromAmount,
            "The fromAmount value is empty in the quoteRequest Payload."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.strictEqual(
            quoteRequestPayload.serviceProvider,
            "SocketV2",
            "The serviceProvider value is not displayed correct in the quoteRequest Payload."
          );
        } catch (e) {
          console.error(e);
        }
      } catch (e) {
        console.error(e);
        assert.fail("An error is displayed in the quote Request Payload.");
      }

      // Get the cross chain quotes
      let batchCrossChainTransaction;
      let quotes;
      try {
        quotes = await xdaiMainNetSdk.getCrossChainQuotes(quoteRequestPayload);

        if (quotes.items.length > 0) {
          try {
            assert.isNotEmpty(
              quotes.items[0].provider,
              "The provider value is not displayed correct in the quotes response."
            );
          } catch (e) {
            console.error(e);
          }

          try {
            assert.isNotEmpty(
              quotes.items[0].approvalData,
              "The approvalData value is empty in the quotes response."
            );
          } catch (e) {
            console.error(e);
          }

          try {
            assert.isNotEmpty(
              quotes.items[0].transaction,
              "The transaction value is empty in the quotes response."
            );
          } catch (e) {
            console.error(e);
          }

          try {
            assert.isNotEmpty(
              quotes.items[0].estimate,
              "The estimate value is empty in the quotes response."
            );
          } catch (e) {
            console.error(e);
          }

          if (quotes.items.length > 0) {
            // Select the first quote
            let quote = quotes.items[0];

            try {
              assert.isNotEmpty(
                quote.provider,
                "The provider value is not displayed correct in the quotes response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isNotEmpty(
                quote.approvalData.approvalAddress,
                "The approvalAddress value of the approvalData is empty in the single quote response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isNotEmpty(
                quote.approvalData.amount,
                "The amount value of the approvalData is empty in the single quote response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isNotEmpty(
                quote.transaction.data,
                "The data value of the transaction is empty in the single quote response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isNotEmpty(
                quote.transaction.to,
                "The To Address value of the transaction is empty in the single quote response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isNotEmpty(
                quote.transaction.value,
                "The value's value of the transaction is empty in the single quote response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isNotEmpty(
                quote.transaction.from,
                "The From Address value of the transaction is empty in the single quote response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isNumber(
                quote.transaction.chainId,
                "The chainId value of the transaction is not number in the single quote response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isNotEmpty(
                quote.estimate.approvalAddress,
                "The approvalAddress value of the estimate is empty in the single quote response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isNotEmpty(
                quote.estimate.fromAmount,
                "The fromAmount value of the estimate is empty in the single quote response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isNotEmpty(
                quote.estimate.toAmount,
                "The toAmount value of the estimate is empty in the single quote response."
              );
            } catch (e) {
              console.error(e);
            }
            let toAmount_estimate_quote = quote.estimate.toAmount;

            try {
              assert.isNotEmpty(
                quote.estimate.gasCosts.limit,
                "The limit value of the gas cost of the estimate is empty in the single quote response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isNotEmpty(
                quote.estimate.gasCosts.amountUSD,
                "The amountUSD value of the gas cost of the estimate is empty in the single quote response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isNotEmpty(
                quote.estimate.gasCosts.token,
                "The token value of the gas cost of the estimate is empty in the single quote response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isNotEmpty(
                quote.estimate.data.fromToken,
                "The fromToken value of the data of the estimate is empty in the single quote response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isNotEmpty(
                quote.estimate.data.toToken,
                "The toToken value of the data of the estimate is empty in the single quote response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isNotEmpty(
                quote.estimate.data.toTokenAmount,
                "The toTokenAmount value of the data of the estimate is empty in the single quote response."
              );
            } catch (e) {
              console.error(e);
            }
            let toTokenAmount_data_estimate_quote =
              quote.estimate.data.toTokenAmount;

            try {
              assert.strictEqual(
                toAmount_estimate_quote,
                toTokenAmount_data_estimate_quote,
                "The To Amount Gas value is not displayed correctly."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isNotEmpty(
                quote.estimate.data.estimatedGas,
                "The estimatedGas value of the data of the estimate is empty in the single quote response."
              );
            } catch (e) {
              console.error(e);
            }

            let tokenAddres = quote.estimate.data.fromToken.address;
            let approvalAddress = quote.approvalData.approvalAddress;
            let amount = quote.approvalData.amount;

            // Build the approval transaction request
            let { ContractNames, getContractAbi } = pkg;
            let abi = getContractAbi(ContractNames.ERC20Token);
            let erc20Contract = xdaiMainNetSdk.registerContract(
              "erc20Contract",
              abi,
              tokenAddres
            );
            let approvalTransactionRequest = erc20Contract.encodeApprove(
              approvalAddress,
              amount
            );

            // Batch the approval transaction
            let batchexecacctrans =
              await xdaiMainNetSdk.batchExecuteAccountTransaction({
                to: approvalTransactionRequest.to,
                data: approvalTransactionRequest.data,
                value: approvalTransactionRequest.value,
              });

            for (let w = 0; w < batchexecacctrans.requests.length; w++) {
              try {
                assert.isNotEmpty(
                  batchexecacctrans.requests[w].to,
                  "The To Address value is empty in the Batch Execution Account Transaction response."
                );
              } catch (e) {
                console.error(e);
              }

              try {
                assert.isNotEmpty(
                  batchexecacctrans.requests[w].data,
                  "The Data value is empty in the Execution Batch Rccount Transaction response."
                );
              } catch (e) {
                console.error(e);
              }
            }

            try {
              assert.isNull(
                batchexecacctrans.estimation,
                "The estimatation value is empty in the Batch Execution Account Transaction response."
              );
            } catch (e) {
              console.error(e);
            }

            // Batch the cross chain transaction
            let { to, value, data } = quote.transaction;
            batchCrossChainTransaction =
              await xdaiMainNetSdk.batchExecuteAccountTransaction({
                to,
                data: data,
                value,
              });
          }

          for (let j = 0; j < batchCrossChainTransaction.requests.length; j++) {
            try {
              assert.isNotEmpty(
                batchCrossChainTransaction.requests[j].to,
                "The To Address value is empty in the Batch Cross Chain Transaction response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isNotEmpty(
                batchCrossChainTransaction.requests[j].data,
                "The Data value is empty in the Batch Cross Chain Transaction response."
              );
            } catch (e) {
              console.error(e);
            }
          }

          try {
            assert.isNull(
              batchCrossChainTransaction.estimation,
              "The estimation value is not null in the Batch Cross Chain Transaction response."
            );
          } catch (e) {
            console.error(e);
          }
        } else {
          assert.fail("The quotes are not displayed in the quote list.");
        }
      } catch (e) {
        console.error(e);
        assert.fail(
          "An error is displated while performing the action on the cross chain quotes."
        );
      }

      // Estimating the batch
      let EstimationResponse;
      let EstimatedGas_Estimate;
      let FeeAmount_Estimate;
      let EstimatedGasPrice_Estimate;

      try {
        EstimationResponse = await xdaiMainNetSdk.estimateGatewayBatch();

        for (let k = 0; k < EstimationResponse.requests.length; k++) {
          try {
            assert.isNotEmpty(
              EstimationResponse.requests[k].to,
              "The To Address value is empty in the Estimation Batch response."
            );
          } catch (e) {
            console.error(e);
          }

          try {
            assert.isNotEmpty(
              EstimationResponse.requests[k].data,
              "The Data value is empty in the Estimation Batch Response."
            );
          } catch (e) {
            console.error(e);
          }
        }

        try {
          assert.isNotEmpty(
            EstimationResponse.estimation.feeAmount,
            "The feeAmount value is empty in the Estimation Batch Response."
          );
          FeeAmount_Estimate = EstimationResponse.estimation.feeAmount._hex;
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNotEmpty(
            EstimationResponse.estimation.feeTokenReceiver,
            "The feeTokenReceiver Address is empty in the Estimate Batch Response."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNumber(
            EstimationResponse.estimation.estimatedGas,
            "The estimatedGas value is not number in the Estimate Batch Response."
          );
          EstimatedGas_Estimate = EstimationResponse.estimation.estimatedGas;
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNotEmpty(
            EstimationResponse.estimation.estimatedGasPrice,
            "The estimatedGasPrice value is empty in the Estimation Batch Response."
          );
          EstimatedGasPrice_Estimate =
            EstimationResponse.estimation.estimatedGasPrice._hex;
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNotEmpty(
            EstimationResponse.estimation.signature,
            "The signature value is empty in the Estimation Batch Response."
          );
        } catch (e) {
          console.error(e);
        }
      } catch (e) {
        console.error(e);
        assert.fail(
          "The estimation of the batch is not performed successfully."
        );
      }

      // Submitting the batch
      let SubmissionResponse;
      let EstimatedGas_Submit;
      let FeeAmount_Submit;
      let EstimatedGasPrice_Submit;

      try {
        SubmissionResponse = await xdaiMainNetSdk.submitGatewayBatch({
          guarded: false,
        });

        try {
          assert.isNull(
            SubmissionResponse.transaction,
            "The transaction is no null in the Submit Batch Response."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNotEmpty(
            SubmissionResponse.hash,
            "The hash value is empty in the Submit Batch Response."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.strictEqual(
            SubmissionResponse.state,
            "Queued",
            "The status of the Submit Batch Response is not displayed correctly."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.strictEqual(
            SubmissionResponse.account,
            xdaiSmartWalletAddress,
            "The account address of the Submit Batch Response is not displayed correctly."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNumber(
            SubmissionResponse.nonce,
            "The nonce value is not number in the Submit Batch Response."
          );
        } catch (e) {
          console.error(e);
        }

        for (let x = 0; x < SubmissionResponse.to.length; x++) {
          try {
            assert.isNotEmpty(
              SubmissionResponse.to[x],
              "The To Address is empty in the Submit Batch Response."
            );
          } catch (e) {
            console.error(e);
          }
        }

        for (let y = 0; y < SubmissionResponse.to.length; y++) {
          try {
            assert.isNotEmpty(
              SubmissionResponse.data[y],
              "The data value is empty in the Submit Batch Response."
            );
          } catch (e) {
            console.error(e);
          }
        }

        try {
          assert.isNotEmpty(
            SubmissionResponse.senderSignature,
            "The senderSignature value is empty in the Submit Batch Response."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNumber(
            SubmissionResponse.estimatedGas,
            "The Estimated Gas value is not number in the Submit Batch Response."
          );
          EstimatedGas_Submit = SubmissionResponse.estimatedGas;
        } catch (e) {
          console.error(e);
        }

        try {
          assert.strictEqual(
            EstimatedGas_Estimate,
            EstimatedGas_Submit,
            "The Estimated Gas value is not displayed correctly."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNotEmpty(
            SubmissionResponse.estimatedGasPrice._hex,
            "The estimatedGasPrice value is empty in the Submit Batch Response."
          );
          EstimatedGasPrice_Submit = SubmissionResponse.estimatedGasPrice._hex;
        } catch (e) {
          console.error(e);
        }

        try {
          assert.strictEqual(
            EstimatedGasPrice_Estimate,
            EstimatedGasPrice_Submit,
            "The Estimated Gas Price value is not displayed correctly."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNull(
            SubmissionResponse.feeToken,
            "The feeToken value is not null in the Submit Batch Response."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNotEmpty(
            SubmissionResponse.feeAmount._hex,
            "The feeAmount value is empty in the Submit Batch Response."
          );
          FeeAmount_Submit = SubmissionResponse.feeAmount._hex;
        } catch (e) {
          console.error(e);
        }

        try {
          assert.strictEqual(
            FeeAmount_Estimate,
            FeeAmount_Submit,
            "The Fee Amount value is not displayed correctly."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNotEmpty(
            SubmissionResponse.feeData,
            "The feeData value is empty in the Submit Batch Response."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNull(
            SubmissionResponse.delayedUntil,
            "The delayedUntil value is not null in the Submit Batch Response."
          );
        } catch (e) {
          console.error(e);
        }
      } catch (e) {
        console.error(e);
        assert.fail(
          "The submittion of the batch is not performed successfully."
        );
      }
    } else {
      console.warn(
        "DUE TO INSUFFICIENT WALLET BALANCE, SKIPPING TEST CASE OF THE CROSS CHAIN QUOTE ACTION ON THE OPTIMISM NETWORK"
      );
    }
  });

  it("SMOKE: Perform the advance routes lifi action on the optimism network", async () => {
    if (runTest) {
      // Prepare the quoteRequest Payload
      let quoteRequestPayload;
      try {
        let fromChainId = NETWORK_NAME_TO_CHAIN_ID[NetworkNames.Optimism];
        let toChainId = NETWORK_NAME_TO_CHAIN_ID[NetworkNames.Xdai];
        let fromTokenAddress = optimismUsdcAddress;
        let toTokenAddress = xdaiUsdcAddress;
        let fromAmount = ethers.utils.parseUnits("0.5", 6);

        quoteRequestPayload = {
          fromChainId: fromChainId,
          toChainId: toChainId,
          fromTokenAddress: fromTokenAddress,
          toTokenAddress: toTokenAddress,
          fromAmount: fromAmount,
          serviceProvider: CrossChainServiceProvider.LiFi, // Optional parameter
        };

        try {
          assert.isNumber(
            quoteRequestPayload.fromChainId,
            "The fromChainId value is not number in the quoteRequest Payload."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNumber(
            quoteRequestPayload.toChainId,
            "The toChainId value is not number in the quoteRequest Payload."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.strictEqual(
            quoteRequestPayload.fromTokenAddress,
            fromTokenAddress,
            "The fromTokenAddress value is not displayed correct in the quoteRequest Payload."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.strictEqual(
            quoteRequestPayload.toTokenAddress,
            toTokenAddress,
            "The toTokenAddress value is not displayed correct in the quoteRequest Payload."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNotEmpty(
            quoteRequestPayload.fromAmount._hex,
            "The fromAmount value is empty in the quoteRequest Payload."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.strictEqual(
            quoteRequestPayload.serviceProvider,
            "LiFi",
            "The serviceProvider value is not displayed correct in the quoteRequest Payload."
          );
        } catch (e) {
          console.error(e);
        }
      } catch (e) {
        console.error(e);
        assert.fail("An error is displayed in the quote Request Payload.");
      }

      // Get the advance routes lifi
      let advanceRoutesLiFi;
      try {
        advanceRoutesLiFi = await optimismMainNetSdk.getAdvanceRoutesLiFi(
          quoteRequestPayload
        );

        if (advanceRoutesLiFi.items.length > 0) {
          for (let i = 0; i < advanceRoutesLiFi.items.length; i++) {
            try {
              assert.isNotEmpty(
                advanceRoutesLiFi.items[i].id,
                "The id value is empty in the advance routes lifi response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isNumber(
                advanceRoutesLiFi.items[i].fromChainId,
                "The fromChainId value is not number in the advance routes lifi response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isNotEmpty(
                advanceRoutesLiFi.items[i].fromAmountUSD,
                "The fromAmountUSD value is empty in the advance routes lifi response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isNotEmpty(
                advanceRoutesLiFi.items[i].fromAmount,
                "The fromAmount value is empty in the advance routes lifi response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isNotEmpty(
                advanceRoutesLiFi.items[i].fromToken,
                "The fromToken value is empty in the advance routes lifi response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.strictEqual(
                advanceRoutesLiFi.items[i].fromAddress,
                optimismSmartWalletAddress,
                "The fromAmount value is not displayed correct in the advance routes lifi response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isNumber(
                advanceRoutesLiFi.items[i].toChainId,
                "The toChainId value is not number in the advance routes lifi response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isNotEmpty(
                advanceRoutesLiFi.items[i].toAmountUSD,
                "The toAmountUSD value is empty in the advance routes lifi response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isNotEmpty(
                advanceRoutesLiFi.items[i].toAmount,
                "The toAmount value is empty in the advance routes lifi response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isNotEmpty(
                advanceRoutesLiFi.items[i].toAmountMin,
                "The toAmountMin value is empty in the advance routes lifi response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isNotEmpty(
                advanceRoutesLiFi.items[i].toToken,
                "The toToken value is empty in the advance routes lifi response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.strictEqual(
                advanceRoutesLiFi.items[i].toAddress,
                optimismSmartWalletAddress,
                "The toAddress value is not displayed correct in the advance routes lifi response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isNotEmpty(
                advanceRoutesLiFi.items[i].gasCostUSD,
                "The gasCostUSD value is empty in the advance routes lifi response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isFalse(
                advanceRoutesLiFi.items[i].containsSwitchChain,
                "The containsSwitchChain value is not false in the advance routes lifi response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isNotEmpty(
                advanceRoutesLiFi.items[i].steps,
                "The steps value is empty in the advance routes lifi response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isNotEmpty(
                advanceRoutesLiFi.items[i].insurance,
                "The insurance value is empty in the advance routes lifi response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isNotEmpty(
                advanceRoutesLiFi.items[i].tags,
                "The tags value is enpty in the advance routes lifi response."
              );
            } catch (e) {
              console.error(e);
            }
          }

          if (advanceRoutesLiFi.items.length > 0) {
            // Select the first advance route lifi
            let advanceRouteLiFi = advanceRoutesLiFi.items[0];
            let transactions = await optimismMainNetSdk.getStepTransaction({
              route: advanceRouteLiFi,
            });

            for (let j = 0; j < transactions.items.length; j++) {
              try {
                assert.isNotEmpty(
                  transactions.items[j].to,
                  "The To Address value is empty in the transactions response."
                );
              } catch (e) {
                console.error(e);
              }

              try {
                assert.isNotEmpty(
                  transactions.items[j].gasLimit,
                  "The gasLimit value is empty in the transactions response."
                );
              } catch (e) {
                console.error(e);
              }

              try {
                assert.isNotEmpty(
                  transactions.items[j].gasPrice,
                  "The gasPrice value is empty in the transactions response."
                );
              } catch (e) {
                console.error(e);
              }

              try {
                assert.isNotEmpty(
                  transactions.items[j].data,
                  "The data value is empty in the transactions response."
                );
              } catch (e) {
                console.error(e);
              }

              try {
                assert.isNotEmpty(
                  transactions.items[j].value,
                  "The value's value is empty in the transactions response."
                );
              } catch (e) {
                console.error(e);
              }

              try {
                assert.isNumber(
                  transactions.items[j].chainId,
                  "The chainId value is not number in the transactions response."
                );
              } catch (e) {
                console.error(e);
              }

              try {
                assert.isNull(
                  transactions.items[j].type,
                  "The type value is not null in the transactions response."
                );
              } catch (e) {
                console.error(e);
              }
            }

            for (let transaction of transactions.items) {
              // Batch the approval transaction
              await optimismMainNetSdk.batchExecuteAccountTransaction({
                to: transaction.to,
                data: transaction.data,
                value: transaction.value,
              });
            }
          }
        } else {
          assert.fail(
            "Not getting the items in the advanceRoutesLiFi response."
          );
        }
      } catch (e) {
        console.error(e);
        assert.fail(
          "An error is displated while performing the action on the advance routes lifi."
        );
      }

      // Estimating the batch
      let EstimationResponse;
      let EstimatedGas_Estimate;
      let FeeAmount_Estimate;
      let EstimatedGasPrice_Estimate;

      try {
        EstimationResponse = await optimismMainNetSdk.estimateGatewayBatch();

        for (let k = 0; k < EstimationResponse.requests.length; k++) {
          try {
            assert.isNotEmpty(
              EstimationResponse.requests[k].to,
              "The To Address value is empty in the Batch Execution Account Transaction response."
            );
          } catch (e) {
            console.error(e);
          }

          try {
            assert.isNotEmpty(
              EstimationResponse.requests[k].data,
              "The data value is empty in the Batch Execution Account Transaction response."
            );
          } catch (e) {
            console.error(e);
          }
        }

        try {
          assert.isNotEmpty(
            EstimationResponse.estimation.feeAmount,
            "The feeAmount value is empty in the Estimation Response."
          );
          FeeAmount_Estimate = EstimationResponse.estimation.feeAmount._hex;
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNotEmpty(
            EstimationResponse.estimation.feeTokenReceiver,
            "The feeTokenReceiver Address of the Estimate Batch Response is empty in the Batch Estimation Response."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNumber(
            EstimationResponse.estimation.estimatedGas,
            "The estimatedGas value is not number in the Estimate Batch Response."
          );
          EstimatedGas_Estimate = EstimationResponse.estimation.estimatedGas;
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNotEmpty(
            EstimationResponse.estimation.estimatedGasPrice,
            "The estimatedGasPrice value is empty in the Estimation Response."
          );
          EstimatedGasPrice_Estimate =
            EstimationResponse.estimation.estimatedGasPrice._hex;
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNotEmpty(
            EstimationResponse.estimation.signature,
            "The signature value is empty in the Estimation Response."
          );
        } catch (e) {
          console.error(e);
        }
      } catch (e) {
        console.error(e);
        assert.fail(
          "The estimation of the batch is not performed successfully."
        );
      }

      // Submitting the batch
      let SubmissionResponse;
      let EstimatedGas_Submit;
      let FeeAmount_Submit;
      let EstimatedGasPrice_Submit;

      try {
        SubmissionResponse = await optimismMainNetSdk.submitGatewayBatch({
          guarded: false,
        });

        try {
          assert.isNull(
            SubmissionResponse.transaction,
            "The transaction value is not null in the Submit Batch Response."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNotEmpty(
            SubmissionResponse.hash,
            "The hash value is empty in the Submit Batch Response."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.strictEqual(
            SubmissionResponse.state,
            "Queued",
            "The status of the Submit Batch Response is not displayed correctly."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.strictEqual(
            SubmissionResponse.account,
            optimismSmartWalletAddress,
            "The account address of the Submit Batch Response is not displayed correctly."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNumber(
            SubmissionResponse.nonce,
            "The nonce value is not number in the Submit Batch Response."
          );
        } catch (e) {
          console.error(e);
        }

        for (let x = 0; x < SubmissionResponse.to.length; x++) {
          try {
            assert.isNotEmpty(
              SubmissionResponse.to[x],
              "The To Address is not empty in the Submit Batch Response."
            );
          } catch (e) {
            console.error(e);
          }

          try {
            assert.isNotEmpty(
              SubmissionResponse.data[x],
              "The data value is empty in the Submit Batch Response."
            );
          } catch (e) {
            console.error(e);
          }
        }

        try {
          assert.isNotEmpty(
            SubmissionResponse.senderSignature,
            "The senderSignature value is empty in the Submit Batch Response."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNumber(
            SubmissionResponse.estimatedGas,
            "The Estimated Gas value is not number in the Submit Batch Response."
          );
          EstimatedGas_Submit = SubmissionResponse.estimatedGas;
        } catch (e) {
          console.error(e);
        }

        try {
          assert.strictEqual(
            EstimatedGas_Estimate,
            EstimatedGas_Submit,
            "The Estimated Gas value is not displayed correctly."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNotEmpty(
            SubmissionResponse.estimatedGasPrice._hex,
            "The estimatedGasPrice value is empty in the Submit Batch Response."
          );
          EstimatedGasPrice_Submit = SubmissionResponse.estimatedGasPrice._hex;
        } catch (e) {
          console.error(e);
        }

        try {
          assert.strictEqual(
            EstimatedGasPrice_Estimate,
            EstimatedGasPrice_Submit,
            "The Estimated Gas Price value is not displayed correctly."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNull(
            SubmissionResponse.feeToken,
            "The feeToken value is not null in the Submit Batch Response."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNotEmpty(
            SubmissionResponse.feeAmount._hex,
            "The feeAmount value is empty in the Submit Batch Response."
          );
          FeeAmount_Submit = SubmissionResponse.feeAmount._hex;
        } catch (e) {
          console.error(e);
        }

        try {
          assert.strictEqual(
            FeeAmount_Estimate,
            FeeAmount_Submit,
            "The Fee Amount value is not displayed correctly."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNotEmpty(
            SubmissionResponse.feeData,
            "The feeData value is empty in the Submit Batch Response."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNull(
            SubmissionResponse.delayedUntil,
            "The delayedUntil value is not null in the Submit Batch Response."
          );
        } catch (e) {
          console.error(e);
        }
      } catch (e) {
        console.error(e);
        assert.fail(
          "The submittion of the batch is not performed successfully."
        );
      }
    } else {
      console.warn(
        "DUE TO INSUFFICIENT WALLET BALANCE, SKIPPING TEST CASE OF THE ADVANCE ROUTES LIFI ACTION ON THE OPTIMISM NETWORK"
      );
    }
  });

  it("REGRESSION: Perform the single chain swap action from ERC20 token to Native Token on the optimism network", async () => {
    if (runTest) {
      let offers;
      let transactionDetails;

      // Get exchange offers
      try {
        offers = await optimismMainNetSdk.getExchangeOffers({
          fromTokenAddress: optimismUsdcAddress, // USDC Token
          toTokenAddress: ethers.constants.AddressZero,
          fromAmount: ethers.utils.parseUnits("0.0001", 6),
        });

        for (let j = 0; j < offers.length; j++) {
          transactionDetails = offers[j].transactions;

          for (let i = 0; i < transactionDetails.length; i++) {
            // BATCH EXECUTE ACCOUNT TRANSACTION
            await optimismMainNetSdk.batchExecuteAccountTransaction(
              transactionDetails[i]
            );
          }
        }
      } catch (e) {
        console.error(e);
        assert.fail("An error is displayed while fetching the offer list.");
      }

      // Estimating the batch
      let EstimationResponse;
      let FeeAmount_Estimate;
      let EstimatedGas_Estimate;
      let EstimatedGasPrice_Estimate;

      try {
        EstimationResponse = await optimismMainNetSdk.estimateGatewayBatch();

        for (let k = 0; k < EstimationResponse.requests.length; k++) {
          try {
            assert.strictEqual(
              EstimationResponse.requests[k].to,
              "0x7EB3A038F25B9F32f8e19A7F0De83D4916030eFa",
              "The To Address of the batchExecuteAccountTransaction is not displayed correctly."
            );
          } catch (e) {
            console.error(e);
          }

          try {
            assert.isNotEmpty(
              EstimationResponse.requests[k].data,
              "The Data value is empty in the batchExecuteAccountTransaction response."
            );
          } catch (e) {
            console.error(e);
          }
        }

        try {
          assert.isNotEmpty(
            EstimationResponse.estimation.feeAmount,
            "The feeAmount value is empty in the Estimation Response."
          );
          FeeAmount_Estimate = EstimationResponse.estimation.feeAmount._hex;
        } catch (e) {
          console.error(e);
        }

        try {
          assert.strictEqual(
            EstimationResponse.estimation.feeTokenReceiver,
            "0xf593D35cA402c097e57813bCC6BCAb4b71A597cC",
            "The feeTokenReceiver Address of the Estimate Batch Response is not displayed correctly."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNumber(
            EstimationResponse.estimation.estimatedGas,
            "The estimatedGas value is not number in the Estimate Batch Response."
          );
          EstimatedGas_Estimate = EstimationResponse.estimation.estimatedGas;
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNotEmpty(
            EstimationResponse.estimation.estimatedGasPrice,
            "The estimatedGasPrice value is empty in the Estimation Response."
          );
          EstimatedGasPrice_Estimate =
            EstimationResponse.estimation.estimatedGasPrice._hex;
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNotEmpty(
            EstimationResponse.estimation.signature,
            "The signature value is empty in the Estimation Response."
          );
        } catch (e) {
          console.error(e);
        }
      } catch (e) {
        console.error(e);
        assert.fail(
          "The estimation of the batch is not performed successfully."
        );
      }

      // Submitting the batch
      let SubmissionResponse;
      let FeeAmount_Submit;
      let EstimatedGas_Submit;
      let EstimatedGasPrice_Submit;

      try {
        SubmissionResponse = await optimismMainNetSdk.submitGatewayBatch({
          guarded: false,
        });

        try {
          assert.isNull(
            SubmissionResponse.transaction,
            "The transaction value is not null in the Submit Batch Response."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNotEmpty(
            SubmissionResponse.hash,
            "The hash value is empty in the Submit Batch Response."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.strictEqual(
            SubmissionResponse.state,
            "Queued",
            "The status of the Submit Batch Response is not displayed correctly."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.strictEqual(
            SubmissionResponse.account,
            "0x666E17ad27fB620D7519477f3b33d809775d65Fe",
            "The account address of the Submit Batch Response is not displayed correctly."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNumber(
            SubmissionResponse.nonce,
            "The nonce value is not number in the Submit Batch Response."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.strictEqual(
            SubmissionResponse.to[0],
            "0x7EB3A038F25B9F32f8e19A7F0De83D4916030eFa",
            "The To Address in the Submit Batch Response is not displayed correctly."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNotEmpty(
            SubmissionResponse.data[0],
            "The data value of the Submit Batch Response is not displayed."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNotEmpty(
            SubmissionResponse.senderSignature,
            "The senderSignature value is empty in the Submit Batch Response."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNumber(
            SubmissionResponse.estimatedGas,
            "The Estimated Gas value is not number in the Submit Batch Response."
          );
          EstimatedGas_Submit = SubmissionResponse.estimatedGas;
        } catch (e) {
          console.error(e);
        }

        try {
          assert.strictEqual(
            EstimatedGas_Estimate,
            EstimatedGas_Submit,
            "The Estimated Gas value is not displayed correctly."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNotEmpty(
            SubmissionResponse.estimatedGasPrice._hex,
            "The estimatedGasPrice value is empty in the Submit Batch Response."
          );
          EstimatedGasPrice_Submit = SubmissionResponse.estimatedGasPrice._hex;
        } catch (e) {
          console.error(e);
        }

        try {
          assert.strictEqual(
            EstimatedGasPrice_Estimate,
            EstimatedGasPrice_Submit,
            "The Estimated Gas Price value is not displayed correctly."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNull(
            SubmissionResponse.feeToken,
            "The feeToken value is not null in the Submit Batch Response."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNotEmpty(
            SubmissionResponse.feeAmount._hex,
            "The feeAmount value is empty in the Submit Batch Response."
          );
          FeeAmount_Submit = SubmissionResponse.feeAmount._hex;
        } catch (e) {
          console.error(e);
        }

        try {
          assert.strictEqual(
            FeeAmount_Estimate,
            FeeAmount_Submit,
            "The Fee Amount value is not displayed correctly."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNotEmpty(
            SubmissionResponse.feeData,
            "The feeData value is empty in the Submit Batch Response."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNull(
            SubmissionResponse.delayedUntil,
            "The delayedUntil value is not null in the Submit Batch Response."
          );
        } catch (e) {
          console.error(e);
        }
      } catch (e) {
        console.error(e);
        assert.fail(
          "The submittion of the batch is not performed successfully."
        );
      }
    } else {
      console.warn(
        "DUE TO INSUFFICIENT WALLET BALANCE, SKIPPING TEST CASE OF THE SINGLE CHAIN SWAP ACTION FROM ERC20 TOKEN TO NATIVE TOKEN ON THE OPTIMISM NETWORK"
      );
    }
  });

  it("REGRESSION: Perform the single chain swap action from Native Token to ERC20 token on the optimism network", async () => {
    if (runTest) {
      let transactionDetails;
      let TransactionData_count = 0;
      let offers;

      // Get exchange offers
      try {
        offers = await optimismMainNetSdk.getExchangeOffers({
          fromTokenAddress: ethers.constants.AddressZero,
          toTokenAddress: optimismUsdtAddress, // USDT Token
          fromAmount: ethers.utils.parseUnits("0.0001", 18),
        });

        if (offers.length > 0) {
          for (let j = 0; j < offers.length; j++) {
            transactionDetails = offers[j].transactions;

            try {
              assert.isNotEmpty(
                offers[j].provider,
                "The provider value is empty in the offer response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isNotEmpty(
                offers[j].receiveAmount,
                "The receiveAmount value is empty in the offer response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isNumber(
                offers[j].exchangeRate,
                "The exchangeRate value is not number in the offer response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isNotEmpty(
                offers[j].transactions,
                "The transactions value is empty in the offer response."
              );
            } catch (e) {
              console.error(e);
            }

            for (let x = 0; x < transactionDetails.length; x++) {
              // Batch execute account transaction
              let addTransactionToBatchOutput =
                await optimismMainNetSdk.batchExecuteAccountTransaction(
                  transactionDetails[x]
                );

              try {
                assert.isNotEmpty(
                  addTransactionToBatchOutput.requests[x].to,
                  "The To Address is empty in the batchExecuteAccountTransaction response."
                );
              } catch (e) {
                console.error(e);
              }

              try {
                assert.isNotEmpty(
                  addTransactionToBatchOutput.requests[x].data,
                  "The Data value is empty in the batchExecuteAccountTransaction response."
                );
                let TransactionData_record =
                  addTransactionToBatchOutput.requests;
                TransactionData_count = TransactionData_record.length;
              } catch (e) {
                console.error(e);
              }

              try {
                assert.isNull(
                  addTransactionToBatchOutput.estimation,
                  "It is not expected behaviour of the estimation in the batchExecuteAccountTransaction Response."
                );
              } catch (e) {
                console.error(e);
              }
            }
          }
        } else {
          assert.fail("The offers are not displayed in the offer list.");
        }
      } catch (e) {
        console.error(e);
        assert.fail("An error is displayed while fetching the offers list.");
      }

      // Estimating the batch
      let EstimationResponse;
      let FeeAmount_Estimate;
      let EstimatedGas_Estimate;
      let EstimatedGasPrice_Estimate;

      try {
        EstimationResponse = await optimismMainNetSdk.estimateGatewayBatch();

        for (let k = 0; k < EstimationResponse.requests.length; k++) {
          try {
            assert.isNotEmpty(
              EstimationResponse.requests[k].to,
              "The To Address is empty in the batchExecuteAccountTransaction batch."
            );
          } catch (e) {
            console.error(e);
          }

          try {
            assert.isNotEmpty(
              EstimationResponse.requests[k].data,
              "The Data value is empty in the Estimation Batch response."
            );
          } catch (e) {
            console.error(e);
          }
        }

        try {
          assert.strictEqual(
            TransactionData_count,
            EstimationResponse.requests.length,
            "The count of the request of the EstimationResponse is not displayed correctly."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNotEmpty(
            EstimationResponse.estimation.feeAmount,
            "The feeAmount value is empty in the Estimation Batch Response."
          );
          FeeAmount_Estimate = EstimationResponse.estimation.feeAmount._hex;
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNotEmpty(
            EstimationResponse.estimation.feeTokenReceiver,
            "The feeTokenReceiver Address is empty in the Estimation Batch Response."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNumber(
            EstimationResponse.estimation.estimatedGas,
            "The estimatedGas value is not number in the Estimation Batch Response."
          );
          EstimatedGas_Estimate = EstimationResponse.estimation.estimatedGas;
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNotEmpty(
            EstimationResponse.estimation.estimatedGasPrice,
            "The estimatedGasPrice value is empty in the Estimation Batch Response."
          );
          EstimatedGasPrice_Estimate =
            EstimationResponse.estimation.estimatedGasPrice._hex;
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNotEmpty(
            EstimationResponse.estimation.signature,
            "The signature value is empty in the Estimation Batch Response."
          );
        } catch (e) {
          console.error(e);
        }
      } catch (e) {
        console.error(e);
        assert.fail(
          "The estimation of the batch is not performed successfully."
        );
      }

      // Submitting the batch
      let SubmissionResponse;
      let FeeAmount_Submit;
      let EstimatedGas_Submit;
      let EstimatedGasPrice_Submit;

      try {
        SubmissionResponse = await optimismMainNetSdk.submitGatewayBatch({
          guarded: false,
        });

        try {
          assert.isNull(
            SubmissionResponse.transaction,
            "The transaction is not null in the Submit Batch Response."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNotEmpty(
            SubmissionResponse.hash,
            "The hash value is empty in the Submit Batch Response."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.strictEqual(
            SubmissionResponse.state,
            "Queued",
            "The status of the Submit Batch Response is not displayed correctly."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.strictEqual(
            SubmissionResponse.account,
            optimismSmartWalletAddress,
            "The account address of the Submit Batch Response is not displayed correctly."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNumber(
            SubmissionResponse.nonce,
            "The nonce value is not number in the Submit Batch Response."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNotEmpty(
            SubmissionResponse.to[0],
            "The To Address is empty in the Submit Batch Response."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNotEmpty(
            SubmissionResponse.data[0],
            "The data value is empty in the Submit Batch Response."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.strictEqual(
            TransactionData_count,
            SubmissionResponse.to.length,
            "The count of the To Addresses are not displayed correctly."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.strictEqual(
            TransactionData_count,
            SubmissionResponse.data.length,
            "The count of the data values are not displayed correctly."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNotEmpty(
            SubmissionResponse.senderSignature,
            "The senderSignature value is empty in the Submit Batch Response."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNumber(
            SubmissionResponse.estimatedGas,
            "The Estimated Gas value is not number in the Submit Batch Response."
          );
          EstimatedGas_Submit = SubmissionResponse.estimatedGas;
        } catch (e) {
          console.error(e);
        }

        try {
          assert.strictEqual(
            EstimatedGas_Estimate,
            EstimatedGas_Submit,
            "The Estimated Gas value is not displayed correctly."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNotEmpty(
            SubmissionResponse.estimatedGasPrice._hex,
            "The value of the estimatedGasPrice field of the Submit Batch Response is not displayed."
          );
          EstimatedGasPrice_Submit = SubmissionResponse.estimatedGasPrice._hex;
        } catch (e) {
          console.error(e);
        }

        try {
          assert.strictEqual(
            EstimatedGasPrice_Estimate,
            EstimatedGasPrice_Submit,
            "The Estimated Gas Price value is not displayed correctly."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNull(
            SubmissionResponse.feeToken,
            "The feeToken value is not null in the Submit Batch Response."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNotEmpty(
            SubmissionResponse.feeAmount._hex,
            "The feeAmount value is empty in the Submit Batch Response."
          );
          FeeAmount_Submit = SubmissionResponse.feeAmount._hex;
        } catch (e) {
          console.error(e);
        }

        try {
          assert.strictEqual(
            FeeAmount_Estimate,
            FeeAmount_Submit,
            "The Fee Amount value is not displayed correctly."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNotEmpty(
            SubmissionResponse.feeData,
            "The feeData value is empty in the Submit Batch Response."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNull(
            SubmissionResponse.delayedUntil,
            "The delayedUntil value is npot null in the Submit Batch Response."
          );
        } catch (e) {
          console.error(e);
        }
      } catch (e) {
        console.error(e);
        assert.fail(
          "The submittion of the batch is not performed successfully."
        );
      }
    } else {
      console.warn(
        "DUE TO INSUFFICIENT WALLET BALANCE, SKIPPING TEST CASE OF THE SINGLE CHAIN SWAP ACTION FROM NATIVE TOKEN TO ERC20 TOKEN ON THE OPTIMISM NETWORK"
      );
    }
  });

  it("REGRESSION: Perform the single chain swap action without estimation of the batch on the optimism network", async () => {
    if (runTest) {
      let transactionDetails;

      // Get exchange offers
      let offers;
      try {
        offers = await optimismMainNetSdk.getExchangeOffers({
          fromTokenAddress: optimismUsdcAddress, // USDC Token
          toTokenAddress: optimismUsdtAddress, // USDT Token
          fromAmount: ethers.utils.parseUnits("0.0001", 6),
        });

        for (let j = 0; j < offers.length; j++) {
          transactionDetails = offers[j].transactions;

          for (let l = 0; l < transactionDetails.length; l++) {
            // Batch execute account transaction
            await optimismMainNetSdk.batchExecuteAccountTransaction(
              transactionDetails[l]
            );
          }
        }
      } catch (e) {
        console.error(e);
        assert.fail("An error is displayed while fetching the offers list.");
      }

      // Submitting the batch
      try {
        try {
          await optimismMainNetSdk.submitGatewayBatch({
            guarded: false,
          });
          assert.fail(
            "Status of the batch is submitted without Estimation of batch."
          );
        } catch (e) {
          if (e.message == "Can not submit not estimated batch") {
            console.log(
              "The validation is displayed when submiting the batch without estimation."
            );
          } else {
            console.error(e);
            assert.fail(
              "The submition of batch is completed without estimation."
            );
          }
        }
      } catch (e) {
        console.error(e);
        assert.fail("The submition of batch is completed without estimation.");
      }
    } else {
      console.warn(
        "DUE TO INSUFFICIENT WALLET BALANCE, SKIPPING TEST CASE OF THE SINGLE CHAIN SWAP ACTION WITHOUT ESTIMATION OF THE BATCH ON THE OPTIMISM NETWORK"
      );
    }
  });

  it("REGRESSION: Perform the single chain swap action from ERC20 token to ERC20 Token with exceed token balance on the optimism network", async () => {
    if (runTest) {
      // Get exchange offers
      try {
        await optimismMainNetSdk.getExchangeOffers({
          fromTokenAddress: optimismUsdcAddress, // USDC Token
          toTokenAddress: optimismUsdtAddress, // USDT Token
          fromAmount: ethers.utils.parseUnits("100000000", 6), // Exceeded Token Balance
        });
      } catch (e) {
        console.error(e);
        assert.fail("An error is displayed while fetching the offers list.");
      }

      // Estimating the batch
      try {
        try {
          await optimismMainNetSdk.estimateGatewayBatch();
        } catch (e) {
          if (e.message == "Can not estimate empty batch") {
            console.log(
              "The validation for exceeded Value is displayed as expected while the batch execution."
            );
          } else {
            console.error(e);
            assert.fail(
              "The expected validation is not displayed when entered the exceeded Value while performing batch execution."
            );
          }
        }
      } catch (e) {
        console.error(e);
        assert.fail(
          "The expected validation is not displayed when entered the exceeded Value while performing batch execution."
        );
      }
    } else {
      console.warn(
        "DUE TO INSUFFICIENT WALLET BALANCE, SKIPPING TEST CASE OF THE SINGLE CHAIN SWAP ACTION FROM ERC20 TOKEN TO ERC20 TOKEN WITH EXCEED TOKEN BALANCE ON THE OPTIMISM NETWORK"
      );
    }
  });

  it("REGRESSION: Perform the single chain swap action from ERC20 token to native token with exceed token balance on the optimism network", async () => {
    if (runTest) {
      // Get exchange offers
      try {
        await optimismMainNetSdk.getExchangeOffers({
          fromTokenAddress: optimismUsdcAddress, // USDC Token
          toTokenAddress: ethers.constants.AddressZero, // Native Token
          fromAmount: ethers.utils.parseUnits("100000000", 6), // Exceeded Token Balance
        });
      } catch (e) {
        console.error(e);
        assert.fail("An error is displayed while fetching the offers list.");
      }

      // Estimating the batch
      try {
        try {
          await optimismMainNetSdk.estimateGatewayBatch();
        } catch (e) {
          if (e.message == "Can not estimate empty batch") {
            console.log(
              "The validation for exceeded Value is displayed as expected while the batch execution."
            );
          } else {
            console.error(e);
            assert.fail(
              "The expected validation is not displayed when entered the exceeded Value while performing batch execution."
            );
          }
        }
      } catch (e) {
        console.error(e);
        assert.fail(
          "The expected validation is not displayed when entered the exceeded Value while performing batch execution."
        );
      }
    } else {
      console.warn(
        "DUE TO INSUFFICIENT WALLET BALANCE, SKIPPING TEST CASE OF THE SINGLE CHAIN SWAP ACTION FROM ERC20 TOKEN TO NATIVE TOKEN WITH EXCEED TOKEN BALANCE ON THE OPTIMISM NETWORK"
      );
    }
  });

  it("REGRESSION: Perform the single chain swap action from ERC20 token to the same ERC20 token on the optimism network", async () => {
    if (runTest) {
      // Get exchange offers
      try {
        try {
          await optimismMainNetSdk.getExchangeOffers({
            fromTokenAddress: optimismUsdcAddress, // USDC Token
            toTokenAddress: optimismUsdcAddress, // Both are Same USDC Tokens
            fromAmount: ethers.utils.parseUnits("0.0001", 6),
          });
          assert.fail(
            "The Swap is performed, Even if the ERC20 Token addresses are equal."
          );
        } catch (e) {
          if (
            e.errors[0].constraints.wrong ==
            "Token addresses should not be equal"
          ) {
            console.log(
              "The validation message is displayed when ERC20 Token addresses are not same."
            );
          } else {
            console.error(e);
            assert.fail(
              "The offers list is displayed even if the ERC20 Token addresses are same."
            );
          }
        }
      } catch (e) {
        console.error(e);
        assert.fail(
          "The offers list is displayed even if the ERC20 Token addresses are same."
        );
      }
    } else {
      console.warn(
        "DUE TO INSUFFICIENT WALLET BALANCE, SKIPPING TEST CASE OF THE SINGLE CHAIN SWAP ACTION FROM ERC20 TOKEN TO THE SAME ERC20 TOKEN ON THE OPTIMISM NETWORK"
      );
    }
  });

  it("REGRESSION: Perform the single chain swap action without toTokenAddress value while get the exchange offers on the optimism network", async () => {
    if (runTest) {
      // Get exchange offers
      try {
        try {
          await optimismMainNetSdk.getExchangeOffers({
            fromTokenAddress: optimismUsdcAddress, // USDC Token
            fromAmount: ethers.utils.parseUnits("0.0001", 6),
          });
          assert.fail(
            "The Swap is performed, Even if the To Token Address is not added in the Get exchange offers."
          );
        } catch (e) {
          if (
            e.errors[0].constraints.isAddress ==
            "toTokenAddress must be an address"
          ) {
            console.log(
              "The Get exchange offers is not performed due to The To Token Address is not added."
            );
          } else {
            console.error(e);
            assert.fail(
              "The offers list is performed without The To Token Address in Get exchange offers request."
            );
          }
        }
      } catch (e) {
        console.error(e);
        assert.fail(
          "The offers list is performed without The To Token Address in Get exchange offers request."
        );
      }
    } else {
      console.warn(
        "DUE TO INSUFFICIENT WALLET BALANCE, SKIPPING TEST CASE OF THE SINGLE CHAIN SWAP ACTION WITHOUT TOTOKENADDRESS VALUE WHILE GET THE EXCHANGE OFFERS ON THE OPTIMISM NETWORK"
      );
    }
  });

  it("REGRESSION: Perform the single chain swap action without fromTokenAddress value while get the exchange offers on the optimism network", async () => {
    if (runTest) {
      // Get exchange offers
      try {
        try {
          await optimismMainNetSdk.getExchangeOffers({
            toTokenAddress: optimismUsdtAddress, // USDT Token
            fromAmount: ethers.utils.parseUnits("0.0001", 6),
          });
          assert.fail(
            "The Swap is performed, Even if the From Token Address is not added in the Get exchange offers."
          );
        } catch (e) {
          if (
            e.errors[0].constraints.isAddress ==
            "fromTokenAddress must be an address"
          ) {
            console.log(
              "The Get exchange offers is not performed due to The From Token Address is not added."
            );
          } else {
            console.error(e);
            assert.fail(
              "The offers list is performed without The From Token Address in Get exchange offers request."
            );
          }
        }
      } catch (e) {
        console.error(e);
        assert.fail(
          "The offers list is performed without The From Token Address in Get exchange offers request."
        );
      }
    } else {
      console.warn(
        "DUE TO INSUFFICIENT WALLET BALANCE, SKIPPING TEST CASE OF THE SINGLE CHAIN SWAP ACTION WITHOUT FROMTOKENADDRESS VALUE WHILE GET THE EXCHANGE OFFERS ON THE OPTIMISM NETWORK"
      );
    }
  });

  it("REGRESSION: Perform the single chain swap action without fromAmount value while get the exchange offers on the optimism network", async () => {
    if (runTest) {
      // Get exchange offers
      try {
        try {
          await optimismMainNetSdk.getExchangeOffers({
            fromTokenAddress: optimismUsdcAddress, // USDC Token
            toTokenAddress: optimismUsdtAddress, // USDT Token
          });
          assert.fail(
            "The Swap is performed, Even if the amount is not added in the Get exchange offers."
          );
        } catch (e) {
          if (
            e.errors[0].constraints.IsBigNumberish ==
            "fromAmount must be positive big numberish"
          ) {
            console.log(
              "The Get exchange offers is not performed due to The amount is not added."
            );
          } else {
            console.error(e);
            assert.fail(
              "The offers list is performed without The amount in Get exchange offers request."
            );
          }
        }
      } catch (e) {
        console.error(e);
        assert.fail(
          "The offers list is performed without The amount in Get exchange offers request."
        );
      }
    } else {
      console.warn(
        "DUE TO INSUFFICIENT WALLET BALANCE, SKIPPING TEST CASE OF THE SINGLE CHAIN SWAP ACTION WITHOUT FROMAMOUNT VALUE WHILE GET THE EXCHANGE OFFERS ON THE OPTIMISM NETWORK"
      );
    }
  });

  it("REGRESSION: Perform the single chain swap action with invalid toTokenAddress value while get the exchange offers on the optimism network", async () => {
    if (runTest) {
      // Get exchange offers
      try {
        try {
          await optimismMainNetSdk.getExchangeOffers({
            fromTokenAddress: optimismUsdcAddress, // USDC Token
            toTokenAddress: "0x4ECaBa5870353805a9F068101A40E0f32ed605CC", // Invalid USDT Token
            fromAmount: ethers.utils.parseUnits("0.0001", 6),
          });
          assert.fail(
            "The Swap is performed, Even if the invalid To Token Address is added in the Get exchange offers."
          );
        } catch (e) {
          if (
            e.errors[0].constraints.isAddress ==
            "toTokenAddress must be an address"
          ) {
            console.log(
              "The Get exchange offers is not performed due to The To Token Address is invalid."
            );
          } else {
            console.error(e);
            assert.fail(
              "The offers list is performed with invalid To Token Address in Get exchange offers request."
            );
          }
        }
      } catch (e) {
        console.error(e);
        assert.fail(
          "The offers list is performed with invalid To Token Address in Get exchange offers request."
        );
      }
    } else {
      console.warn(
        "DUE TO INSUFFICIENT WALLET BALANCE, SKIPPING TEST CASE OF THE SINGLE CHAIN SWAP ACTION WITH INVALID TOTOKENADDRESS VALUE WHILE GET THE EXCHANGE OFFERS ON THE OPTIMISM NETWORK"
      );
    }
  });

  it("REGRESSION: Perform the single chain swap action with invalid fromTokenAddress value while get the exchange offers on the optimism network", async () => {
    if (runTest) {
      // Get exchange offers
      try {
        try {
          await optimismMainNetSdk.getExchangeOffers({
            fromTokenAddress: "0xDDAfbb505ad214D7b80b1f830fcCc89B60fb7A88", // Invalid USDC Token
            toTokenAddress: optimismUsdtAddress, // USDT Token
            fromAmount: ethers.utils.parseUnits("0.0001", 6),
          });
          assert.fail(
            "The Swap is performed, Even if the invalid From Token Address is added in the Get exchange offers."
          );
        } catch (e) {
          if (
            e.errors[0].constraints.isAddress ==
            "fromTokenAddress must be an address"
          ) {
            console.log(
              "The Get exchange offers is not performed due to The From Token Address is invalid."
            );
          } else {
            console.error(e);
            assert.fail(
              "The offers list is performed with invalid From Token Address in Get exchange offers request."
            );
          }
        }
      } catch (e) {
        console.error(e);
        assert.fail(
          "The offers list is performed with invalid From Token Address in Get exchange offers request."
        );
      }
    } else {
      console.warn(
        "DUE TO INSUFFICIENT WALLET BALANCE, SKIPPING TEST CASE OF THE SINGLE CHAIN SWAP ACTION WITH INVALID FROMTOKENADDRESS VALUE WHILE GET THE EXCHANGE OFFERS ON THE OPTIMISM NETWORK"
      );
    }
  });

  it("REGRESSION: Perform the cross chain quote action without fromChainId value in the quote request payload on the optimism network", async () => {
    if (runTest) {
      // Prepare the quoteRequest Payload
      let quoteRequestPayload;
      let toChainId = NETWORK_NAME_TO_CHAIN_ID[NetworkNames.Xdai];
      let fromTokenAddress = optimismUsdcAddress;
      let toTokenAddress = xdaiUsdcAddress;
      let fromAmount = ethers.utils.parseUnits("0.5", 6);

      quoteRequestPayload = {
        toChainId: toChainId,
        fromTokenAddress: fromTokenAddress,
        toTokenAddress: toTokenAddress,
        fromAmount: fromAmount,
        serviceProvider: CrossChainServiceProvider.LiFi, // Optional parameter
      };

      // Get the cross chain quotes without fromchainid value
      try {
        try {
          await optimismMainNetSdk.getCrossChainQuotes(quoteRequestPayload);
          assert.fail(
            "The cross chain quotes is completed without fromChainId of the Get cross chain quotes."
          );
        } catch (e) {
          if (
            e.errors[0].constraints.isPositive ==
            "fromChainId must be a positive number"
          ) {
            console.log(
              "The cross chain quotes is not completed without fromChainId of the Get cross chain quotes as expected."
            );
          } else {
            console.error(e);
            assert.fail(
              "The cross chain quotes is completed without fromChainId of the Get cross chain quotes."
            );
          }
        }
      } catch (e) {
        console.error(e);
        assert.fail(
          "The cross chain quotes is completed without fromChainId of the Get cross chain quotes."
        );
      }
    } else {
      console.warn(
        "DUE TO INSUFFICIENT WALLET BALANCE, SKIPPING TEST CASE OF THE CROSS CHAIN QUOTE ACTION WITHOUT FROMCHAINID VALUE IN THE QUOTE REQUEST PAYLOAD ON THE OPTIMISM NETWORK"
      );
    }
  });

  it("REGRESSION: Perform the cross chain quote action without toChainId value in the quote request payload on the optimism network", async () => {
    if (runTest) {
      // Prepare the quoteRequest Payload
      let quoteRequestPayload;
      let fromChainId = NETWORK_NAME_TO_CHAIN_ID[NetworkNames.Optimism];
      let fromTokenAddress = optimismUsdcAddress;
      let toTokenAddress = xdaiUsdcAddress;
      let fromAmount = ethers.utils.parseUnits("0.5", 6);

      quoteRequestPayload = {
        fromChainId: fromChainId,
        fromTokenAddress: fromTokenAddress,
        toTokenAddress: toTokenAddress,
        fromAmount: fromAmount,
        serviceProvider: CrossChainServiceProvider.LiFi, // Optional parameter
      };

      // Get the cross chain quotes without tochainid value
      try {
        try {
          await optimismMainNetSdk.getCrossChainQuotes(quoteRequestPayload);
          assert.fail(
            "The cross chain quotes is completed without tochainid of the Get cross chain quotes."
          );
        } catch (e) {
          if (
            e.errors[0].constraints.isPositive ==
            "toChainId must be a positive number"
          ) {
            console.log(
              "The cross chain quotes is not completed without tochainid of the Get cross chain quotes as expected."
            );
          } else {
            console.error(e);
            assert.fail(
              "The cross chain quotes is completed without tochainid of the Get cross chain quotes."
            );
          }
        }
      } catch (e) {
        console.error(e);
        assert.fail(
          "The cross chain quotes is completed without tochainid of the Get cross chain quotes."
        );
      }
    } else {
      console.warn(
        "DUE TO INSUFFICIENT WALLET BALANCE, SKIPPING TEST CASE OF THE CROSS CHAIN QUOTE ACTION WITHOUT TOCHAINID VALUE IN THE QUOTE REQUEST PAYLOAD ON THE OPTIMISM NETWORK"
      );
    }
  });

  it("REGRESSION: Perform the cross chain quote action without fromTokenAddress value in the quote request payload on the optimism network", async () => {
    if (runTest) {
      // Prepare the quoteRequest Payload
      let quoteRequestPayload;
      let fromChainId = NETWORK_NAME_TO_CHAIN_ID[NetworkNames.Optimism];
      let toChainId = NETWORK_NAME_TO_CHAIN_ID[NetworkNames.Xdai];
      let toTokenAddress = xdaiUsdcAddress;
      let fromAmount = ethers.utils.parseUnits("0.5", 6);

      quoteRequestPayload = {
        fromChainId: fromChainId,
        toChainId: toChainId,
        toTokenAddress: toTokenAddress,
        fromAmount: fromAmount,
        serviceProvider: CrossChainServiceProvider.LiFi, // Optional parameter
      };

      // Get the cross chain quotes without fromTokenAddress value
      try {
        try {
          await optimismMainNetSdk.getCrossChainQuotes(quoteRequestPayload);
          assert.fail(
            "The cross chain quotes is completed without fromTokenAddress of the Get cross chain quotes."
          );
        } catch (e) {
          if (
            e.errors[0].constraints.isAddress ==
            "fromTokenAddress must be an address"
          ) {
            console.log(
              "The cross chain quotes is not completed without fromTokenAddress of the Get cross chain quotes as expected."
            );
          } else {
            console.error(e);
            assert.fail(
              "The cross chain quotes is completed without fromTokenAddress of the Get cross chain quotes."
            );
          }
        }
      } catch (e) {
        console.error(e);
        assert.fail(
          "The cross chain quotes is completed without fromTokenAddress of the Get cross chain quotes."
        );
      }
    } else {
      console.warn(
        "DUE TO INSUFFICIENT WALLET BALANCE, SKIPPING TEST CASE OF THE CROSS CHAIN QUOTE ACTION WITHOUT FROMTOKENADDRESS VALUE IN THE QUOTE REQUEST PAYLOAD ON THE OPTIMISM NETWORK"
      );
    }
  });

  it("REGRESSION: Perform the cross chain quote action without toTokenAddress value in the quote request payload on the optimism network", async () => {
    if (runTest) {
      // Prepare the quoteRequest Payload
      let quoteRequestPayload;
      let fromChainId = NETWORK_NAME_TO_CHAIN_ID[NetworkNames.Optimism];
      let toChainId = NETWORK_NAME_TO_CHAIN_ID[NetworkNames.Xdai];
      let fromTokenAddress = optimismUsdcAddress;
      let fromAmount = ethers.utils.parseUnits("0.5", 6);

      quoteRequestPayload = {
        fromChainId: fromChainId,
        toChainId: toChainId,
        fromTokenAddress: fromTokenAddress,
        fromAmount: fromAmount,
        serviceProvider: CrossChainServiceProvider.LiFi, // Optional parameter
      };

      // Get the cross chain quotes without totokenaddress value
      try {
        try {
          await optimismMainNetSdk.getCrossChainQuotes(quoteRequestPayload);
          assert.fail(
            "The cross chain quotes is completed without totokenaddress of the Get cross chain quotes."
          );
        } catch (e) {
          if (
            e.errors[0].constraints.isAddress ==
            "toTokenAddress must be an address"
          ) {
            console.log(
              "The cross chain quotes is not completed without totokenaddress of the Get cross chain quotes as expected."
            );
          } else {
            console.error(e);
            assert.fail(
              "The cross chain quotes is completed without totokenaddress of the Get cross chain quotes."
            );
          }
        }
      } catch (e) {
        console.error(e);
        assert.fail(
          "The cross chain quotes is completed without totokenaddress of the Get cross chain quotes."
        );
      }
    } else {
      console.warn(
        "DUE TO INSUFFICIENT WALLET BALANCE, SKIPPING TEST CASE OF THE CROSS CHAIN QUOTE ACTION WITHOUT TOTOKENADDRESS VALUE IN THE QUOTE REQUEST PAYLOAD ON THE OPTIMISM NETWORK"
      );
    }
  });

  it("REGRESSION: Perform the cross chain quote action without fromAmount value in the quote request payload on the optimism network", async () => {
    if (runTest) {
      // Prepare the quoteRequest Payload
      let quoteRequestPayload;
      let fromChainId = NETWORK_NAME_TO_CHAIN_ID[NetworkNames.Optimism];
      let toChainId = NETWORK_NAME_TO_CHAIN_ID[NetworkNames.Xdai];
      let fromTokenAddress = optimismUsdcAddress;
      let toTokenAddress = xdaiUsdcAddress;

      quoteRequestPayload = {
        fromChainId: fromChainId,
        toChainId: toChainId,
        fromTokenAddress: fromTokenAddress,
        toTokenAddress: toTokenAddress,
        serviceProvider: CrossChainServiceProvider.LiFi, // Optional parameter
      };

      // Get the cross chain quotes without fromamount value
      try {
        try {
          await optimismMainNetSdk.getCrossChainQuotes(quoteRequestPayload);
          assert.fail(
            "The cross chain quotes is completed without fromAmount of the Get cross chain quotes."
          );
        } catch (e) {
          if (
            e.errors[0].constraints.IsBigNumberish ==
            "fromAmount must be big numberish"
          ) {
            console.log(
              "The cross chain quotes is not completed without fromAmount of the Get cross chain quotes as expected."
            );
          } else {
            console.error(e);
            assert.fail(
              "The cross chain quotes is completed without fromAmount of the Get cross chain quotes."
            );
          }
        }
      } catch (e) {
        console.error(e);
        assert.fail(
          "The cross chain quotes is completed without fromAmount of the Get cross chain quotes."
        );
      }
    } else {
      console.warn(
        "DUE TO INSUFFICIENT WALLET BALANCE, SKIPPING TEST CASE OF THE CROSS CHAIN QUOTE ACTION WITHOUT FROMAMOUNT VALUE IN THE QUOTE REQUEST PAYLOAD ON THE OPTIMISM NETWORK"
      );
    }
  });

  it("REGRESSION: Perform the cross chain quote action from native token to another chain's ERC20 token in the quote request payload on the optimism network", async () => {
    if (runTest) {
      // Prepare the quoteRequest Payload
      let quoteRequestPayload;
      let fromChainId = NETWORK_NAME_TO_CHAIN_ID[NetworkNames.Optimism];
      let toChainId = NETWORK_NAME_TO_CHAIN_ID[NetworkNames.Xdai];
      let fromTokenAddress = ethers.constants.AddressZero; // optimism - Native Token
      let toTokenAddress = xdaiUsdcAddress;
      let fromAmount = ethers.utils.parseUnits("0.5", 18);

      quoteRequestPayload = {
        fromChainId: fromChainId,
        toChainId: toChainId,
        fromTokenAddress: fromTokenAddress,
        toTokenAddress: toTokenAddress,
        fromAmount: fromAmount,
        serviceProvider: CrossChainServiceProvider.LiFi, // Optional parameter
      };

      // Get the cross chain quotes
      let batchCrossChainTransaction;
      let quotes;
      try {
        quotes = await xdaiMainNetSdk.getCrossChainQuotes(quoteRequestPayload);

        if (quotes.items.length > 0) {
          try {
            assert.isNotEmpty(
              quotes.items[0].provider,
              "The provider value is not displayed correct in the quotes response."
            );
          } catch (e) {
            console.error(e);
          }

          try {
            assert.isNotEmpty(
              quotes.items[0].approvalData,
              "The approvalData value is empty in the quotes response."
            );
          } catch (e) {
            console.error(e);
          }

          try {
            assert.isNotEmpty(
              quotes.items[0].transaction,
              "The transaction value is empty in the quotes response."
            );
          } catch (e) {
            console.error(e);
          }

          try {
            assert.isNotEmpty(
              quotes.items[0].estimate,
              "The estimate value is empty in the quotes response."
            );
          } catch (e) {
            console.error(e);
          }

          if (quotes.items.length > 0) {
            // Select the first quote
            let quote = quotes.items[0];

            try {
              assert.isNotEmpty(
                quote.provider,
                "The provider value is not displayed correct in the quotes response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isNotEmpty(
                quote.approvalData.approvalAddress,
                "The approvalAddress value of the approvalData is empty in the single quote response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isNotEmpty(
                quote.approvalData.amount,
                "The amount value of the approvalData is empty in the single quote response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isNotEmpty(
                quote.transaction.data,
                "The data value of the transaction is empty in the single quote response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isNotEmpty(
                quote.transaction.to,
                "The To Address value of the transaction is empty in the single quote response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isNotEmpty(
                quote.transaction.value,
                "The value's value of the transaction is empty in the single quote response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isNotEmpty(
                quote.transaction.from,
                "The From Address value of the transaction is empty in the single quote response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isNumber(
                quote.transaction.chainId,
                "The chainId value of the transaction is not number in the single quote response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isNotEmpty(
                quote.estimate.approvalAddress,
                "The approvalAddress value of the estimate is empty in the single quote response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isNotEmpty(
                quote.estimate.fromAmount,
                "The fromAmount value of the estimate is empty in the single quote response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isNotEmpty(
                quote.estimate.toAmount,
                "The toAmount value of the estimate is empty in the single quote response."
              );
            } catch (e) {
              console.error(e);
            }
            let toAmount_estimate_quote = quote.estimate.toAmount;

            try {
              assert.isNotEmpty(
                quote.estimate.gasCosts.limit,
                "The limit value of the gas cost of the estimate is empty in the single quote response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isNotEmpty(
                quote.estimate.gasCosts.amountUSD,
                "The amountUSD value of the gas cost of the estimate is empty in the single quote response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isNotEmpty(
                quote.estimate.gasCosts.token,
                "The token value of the gas cost of the estimate is empty in the single quote response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isNotEmpty(
                quote.estimate.data.fromToken,
                "The fromToken value of the data of the estimate is empty in the single quote response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isNotEmpty(
                quote.estimate.data.toToken,
                "The toToken value of the data of the estimate is empty in the single quote response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isNotEmpty(
                quote.estimate.data.toTokenAmount,
                "The toTokenAmount value of the data of the estimate is empty in the single quote response."
              );
            } catch (e) {
              console.error(e);
            }
            let toTokenAmount_data_estimate_quote =
              quote.estimate.data.toTokenAmount;

            try {
              assert.strictEqual(
                toAmount_estimate_quote,
                toTokenAmount_data_estimate_quote,
                "The To Amount Gas value is not displayed correctly."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isNotEmpty(
                quote.estimate.data.estimatedGas,
                "The estimatedGas value of the data of the estimate is empty in the single quote response."
              );
            } catch (e) {
              console.error(e);
            }

            let tokenAddres = quote.estimate.data.fromToken.address;
            let approvalAddress = quote.approvalData.approvalAddress;
            let amount = quote.approvalData.amount;

            // Build the approval transaction request
            let { ContractNames, getContractAbi } = pkg;
            let abi = getContractAbi(ContractNames.ERC20Token);
            let erc20Contract = xdaiMainNetSdk.registerContract(
              "erc20Contract",
              abi,
              tokenAddres
            );
            let approvalTransactionRequest = erc20Contract.encodeApprove(
              approvalAddress,
              amount
            );

            // Batch the approval transaction
            let batchexecacctrans =
              await xdaiMainNetSdk.batchExecuteAccountTransaction({
                to: approvalTransactionRequest.to,
                data: approvalTransactionRequest.data,
                value: approvalTransactionRequest.value,
              });

            for (let w = 0; w < batchexecacctrans.requests.length; w++) {
              try {
                assert.isNotEmpty(
                  batchexecacctrans.requests[w].to,
                  "The To Address value is empty in the Batch Execution Account Transaction response."
                );
              } catch (e) {
                console.error(e);
              }

              try {
                assert.isNotEmpty(
                  batchexecacctrans.requests[w].data,
                  "The Data value is empty in the Execution Batch Rccount Transaction response."
                );
              } catch (e) {
                console.error(e);
              }
            }

            try {
              assert.isNull(
                batchexecacctrans.estimation,
                "The estimatation value is empty in the Batch Execution Account Transaction response."
              );
            } catch (e) {
              console.error(e);
            }

            // Batch the cross chain transaction
            let { to, value, data } = quote.transaction;
            batchCrossChainTransaction =
              await xdaiMainNetSdk.batchExecuteAccountTransaction({
                to,
                data: data,
                value,
              });
          }

          for (let j = 0; j < batchCrossChainTransaction.requests.length; j++) {
            try {
              assert.isNotEmpty(
                batchCrossChainTransaction.requests[j].to,
                "The To Address value is empty in the Batch Cross Chain Transaction response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isNotEmpty(
                batchCrossChainTransaction.requests[j].data,
                "The Data value is empty in the Batch Cross Chain Transaction response."
              );
            } catch (e) {
              console.error(e);
            }
          }

          try {
            assert.isNull(
              batchCrossChainTransaction.estimation,
              "The estimation value is not null in the Batch Cross Chain Transaction response."
            );
          } catch (e) {
            console.error(e);
          }
        } else {
          assert.fail("The quotes are not displayed in the quote list.");
        }
      } catch (e) {
        console.error(e);
        assert.fail(
          "An error is displated while performing the action on the cross chain quotes."
        );
      }

      // Estimating the batch
      let EstimationResponse;
      let EstimatedGas_Estimate;
      let FeeAmount_Estimate;
      let EstimatedGasPrice_Estimate;

      try {
        EstimationResponse = await xdaiMainNetSdk.estimateGatewayBatch();

        for (let k = 0; k < EstimationResponse.requests.length; k++) {
          try {
            assert.isNotEmpty(
              EstimationResponse.requests[k].to,
              "The To Address value is empty in the Estimation Batch response."
            );
          } catch (e) {
            console.error(e);
          }

          try {
            assert.isNotEmpty(
              EstimationResponse.requests[k].data,
              "The Data value is empty in the Estimation Batch Response."
            );
          } catch (e) {
            console.error(e);
          }
        }

        try {
          assert.isNotEmpty(
            EstimationResponse.estimation.feeAmount,
            "The feeAmount value is empty in the Estimation Batch Response."
          );
          FeeAmount_Estimate = EstimationResponse.estimation.feeAmount._hex;
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNotEmpty(
            EstimationResponse.estimation.feeTokenReceiver,
            "The feeTokenReceiver Address is empty in the Estimate Batch Response."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNumber(
            EstimationResponse.estimation.estimatedGas,
            "The estimatedGas value is not number in the Estimate Batch Response."
          );
          EstimatedGas_Estimate = EstimationResponse.estimation.estimatedGas;
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNotEmpty(
            EstimationResponse.estimation.estimatedGasPrice,
            "The estimatedGasPrice value is empty in the Estimation Batch Response."
          );
          EstimatedGasPrice_Estimate =
            EstimationResponse.estimation.estimatedGasPrice._hex;
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNotEmpty(
            EstimationResponse.estimation.signature,
            "The signature value is empty in the Estimation Batch Response."
          );
        } catch (e) {
          console.error(e);
        }
      } catch (e) {
        console.error(e);
        assert.fail(
          "The estimation of the batch is not performed successfully."
        );
      }

      // Submitting the batch
      let SubmissionResponse;
      let EstimatedGas_Submit;
      let FeeAmount_Submit;
      let EstimatedGasPrice_Submit;

      try {
        SubmissionResponse = await xdaiMainNetSdk.submitGatewayBatch({
          guarded: false,
        });

        try {
          assert.isNull(
            SubmissionResponse.transaction,
            "The transaction is no null in the Submit Batch Response."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNotEmpty(
            SubmissionResponse.hash,
            "The hash value is empty in the Submit Batch Response."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.strictEqual(
            SubmissionResponse.state,
            "Queued",
            "The status of the Submit Batch Response is not displayed correctly."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.strictEqual(
            SubmissionResponse.account,
            xdaiSmartWalletAddress,
            "The account address of the Submit Batch Response is not displayed correctly."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNumber(
            SubmissionResponse.nonce,
            "The nonce value is not number in the Submit Batch Response."
          );
        } catch (e) {
          console.error(e);
        }

        for (let x = 0; x < SubmissionResponse.to.length; x++) {
          try {
            assert.isNotEmpty(
              SubmissionResponse.to[x],
              "The To Address is empty in the Submit Batch Response."
            );
          } catch (e) {
            console.error(e);
          }
        }

        for (let y = 0; y < SubmissionResponse.to.length; y++) {
          try {
            assert.isNotEmpty(
              SubmissionResponse.data[y],
              "The data value is empty in the Submit Batch Response."
            );
          } catch (e) {
            console.error(e);
          }
        }

        try {
          assert.isNotEmpty(
            SubmissionResponse.senderSignature,
            "The senderSignature value is empty in the Submit Batch Response."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNumber(
            SubmissionResponse.estimatedGas,
            "The Estimated Gas value is not number in the Submit Batch Response."
          );
          EstimatedGas_Submit = SubmissionResponse.estimatedGas;
        } catch (e) {
          console.error(e);
        }

        try {
          assert.strictEqual(
            EstimatedGas_Estimate,
            EstimatedGas_Submit,
            "The Estimated Gas value is not displayed correctly."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNotEmpty(
            SubmissionResponse.estimatedGasPrice._hex,
            "The estimatedGasPrice value is empty in the Submit Batch Response."
          );
          EstimatedGasPrice_Submit = SubmissionResponse.estimatedGasPrice._hex;
        } catch (e) {
          console.error(e);
        }

        try {
          assert.strictEqual(
            EstimatedGasPrice_Estimate,
            EstimatedGasPrice_Submit,
            "The Estimated Gas Price value is not displayed correctly."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNull(
            SubmissionResponse.feeToken,
            "The feeToken value is not null in the Submit Batch Response."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNotEmpty(
            SubmissionResponse.feeAmount._hex,
            "The feeAmount value is empty in the Submit Batch Response."
          );
          FeeAmount_Submit = SubmissionResponse.feeAmount._hex;
        } catch (e) {
          console.error(e);
        }

        try {
          assert.strictEqual(
            FeeAmount_Estimate,
            FeeAmount_Submit,
            "The Fee Amount value is not displayed correctly."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNotEmpty(
            SubmissionResponse.feeData,
            "The feeData value is empty in the Submit Batch Response."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNull(
            SubmissionResponse.delayedUntil,
            "The delayedUntil value is not null in the Submit Batch Response."
          );
        } catch (e) {
          console.error(e);
        }
      } catch (e) {
        console.error(e);
        assert.fail(
          "The submittion of the batch is not performed successfully."
        );
      }
    } else {
      console.warn(
        "DUE TO INSUFFICIENT WALLET BALANCE, SKIPPING TEST CASE OF THE CROSS CHAIN QUOTE ACTION FROM NATIVE TOKEN TO ANOTHER CHAIN'S ERC20 TOKEN IN THE QUOTE REQUEST PAYLOAD ON THE OPTIMISM NETWORK"
      );
    }
  });

  it("REGRESSION: Perform the cross chain quote action from ERC20 token to another chain's native token in the quote request payload on the optimism network", async () => {
    if (runTest) {
      // Prepare the quoteRequest Payload
      let quoteRequestPayload;
      let fromChainId = NETWORK_NAME_TO_CHAIN_ID[NetworkNames.Optimism];
      let toChainId = NETWORK_NAME_TO_CHAIN_ID[NetworkNames.Xdai];
      let fromTokenAddress = optimismUsdcAddress;
      let toTokenAddress = ethers.constants.AddressZero; // Xdai - Native Token
      let fromAmount = ethers.utils.parseUnits("0.5", 6);

      quoteRequestPayload = {
        fromChainId: fromChainId,
        toChainId: toChainId,
        fromTokenAddress: fromTokenAddress,
        toTokenAddress: toTokenAddress,
        fromAmount: fromAmount,
        serviceProvider: CrossChainServiceProvider.LiFi, // Optional parameter
      };

      // Get the cross chain quotes
      let batchCrossChainTransaction;
      let quotes;
      try {
        quotes = await xdaiMainNetSdk.getCrossChainQuotes(quoteRequestPayload);

        if (quotes.items.length > 0) {
          try {
            assert.isNotEmpty(
              quotes.items[0].provider,
              "The provider value is not displayed correct in the quotes response."
            );
          } catch (e) {
            console.error(e);
          }

          try {
            assert.isNotEmpty(
              quotes.items[0].approvalData,
              "The approvalData value is empty in the quotes response."
            );
          } catch (e) {
            console.error(e);
          }

          try {
            assert.isNotEmpty(
              quotes.items[0].transaction,
              "The transaction value is empty in the quotes response."
            );
          } catch (e) {
            console.error(e);
          }

          try {
            assert.isNotEmpty(
              quotes.items[0].estimate,
              "The estimate value is empty in the quotes response."
            );
          } catch (e) {
            console.error(e);
          }

          if (quotes.items.length > 0) {
            // Select the first quote
            let quote = quotes.items[0];

            try {
              assert.isNotEmpty(
                quote.provider,
                "The provider value is not displayed correct in the quotes response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isNotEmpty(
                quote.approvalData.approvalAddress,
                "The approvalAddress value of the approvalData is empty in the single quote response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isNotEmpty(
                quote.approvalData.amount,
                "The amount value of the approvalData is empty in the single quote response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isNotEmpty(
                quote.transaction.data,
                "The data value of the transaction is empty in the single quote response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isNotEmpty(
                quote.transaction.to,
                "The To Address value of the transaction is empty in the single quote response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isNotEmpty(
                quote.transaction.value,
                "The value's value of the transaction is empty in the single quote response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isNotEmpty(
                quote.transaction.from,
                "The From Address value of the transaction is empty in the single quote response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isNumber(
                quote.transaction.chainId,
                "The chainId value of the transaction is not number in the single quote response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isNotEmpty(
                quote.estimate.approvalAddress,
                "The approvalAddress value of the estimate is empty in the single quote response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isNotEmpty(
                quote.estimate.fromAmount,
                "The fromAmount value of the estimate is empty in the single quote response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isNotEmpty(
                quote.estimate.toAmount,
                "The toAmount value of the estimate is empty in the single quote response."
              );
            } catch (e) {
              console.error(e);
            }
            let toAmount_estimate_quote = quote.estimate.toAmount;

            try {
              assert.isNotEmpty(
                quote.estimate.gasCosts.limit,
                "The limit value of the gas cost of the estimate is empty in the single quote response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isNotEmpty(
                quote.estimate.gasCosts.amountUSD,
                "The amountUSD value of the gas cost of the estimate is empty in the single quote response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isNotEmpty(
                quote.estimate.gasCosts.token,
                "The token value of the gas cost of the estimate is empty in the single quote response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isNotEmpty(
                quote.estimate.data.fromToken,
                "The fromToken value of the data of the estimate is empty in the single quote response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isNotEmpty(
                quote.estimate.data.toToken,
                "The toToken value of the data of the estimate is empty in the single quote response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isNotEmpty(
                quote.estimate.data.toTokenAmount,
                "The toTokenAmount value of the data of the estimate is empty in the single quote response."
              );
            } catch (e) {
              console.error(e);
            }
            let toTokenAmount_data_estimate_quote =
              quote.estimate.data.toTokenAmount;

            try {
              assert.strictEqual(
                toAmount_estimate_quote,
                toTokenAmount_data_estimate_quote,
                "The To Amount Gas value is not displayed correctly."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isNotEmpty(
                quote.estimate.data.estimatedGas,
                "The estimatedGas value of the data of the estimate is empty in the single quote response."
              );
            } catch (e) {
              console.error(e);
            }

            let tokenAddres = quote.estimate.data.fromToken.address;
            let approvalAddress = quote.approvalData.approvalAddress;
            let amount = quote.approvalData.amount;

            // Build the approval transaction request
            let { ContractNames, getContractAbi } = pkg;
            let abi = getContractAbi(ContractNames.ERC20Token);
            let erc20Contract = xdaiMainNetSdk.registerContract(
              "erc20Contract",
              abi,
              tokenAddres
            );
            let approvalTransactionRequest = erc20Contract.encodeApprove(
              approvalAddress,
              amount
            );

            // Batch the approval transaction
            let batchexecacctrans =
              await xdaiMainNetSdk.batchExecuteAccountTransaction({
                to: approvalTransactionRequest.to,
                data: approvalTransactionRequest.data,
                value: approvalTransactionRequest.value,
              });

            for (let w = 0; w < batchexecacctrans.requests.length; w++) {
              try {
                assert.isNotEmpty(
                  batchexecacctrans.requests[w].to,
                  "The To Address value is empty in the Batch Execution Account Transaction response."
                );
              } catch (e) {
                console.error(e);
              }

              try {
                assert.isNotEmpty(
                  batchexecacctrans.requests[w].data,
                  "The Data value is empty in the Execution Batch Rccount Transaction response."
                );
              } catch (e) {
                console.error(e);
              }
            }

            try {
              assert.isNull(
                batchexecacctrans.estimation,
                "The estimatation value is empty in the Batch Execution Account Transaction response."
              );
            } catch (e) {
              console.error(e);
            }

            // Batch the cross chain transaction
            let { to, value, data } = quote.transaction;
            batchCrossChainTransaction =
              await xdaiMainNetSdk.batchExecuteAccountTransaction({
                to,
                data: data,
                value,
              });
          }

          for (let j = 0; j < batchCrossChainTransaction.requests.length; j++) {
            try {
              assert.isNotEmpty(
                batchCrossChainTransaction.requests[j].to,
                "The To Address value is empty in the Batch Cross Chain Transaction response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isNotEmpty(
                batchCrossChainTransaction.requests[j].data,
                "The Data value is empty in the Batch Cross Chain Transaction response."
              );
            } catch (e) {
              console.error(e);
            }
          }

          try {
            assert.isNull(
              batchCrossChainTransaction.estimation,
              "The estimation value is not null in the Batch Cross Chain Transaction response."
            );
          } catch (e) {
            console.error(e);
          }
        } else {
          assert.fail("The quotes are not displayed in the quote list.");
        }
      } catch (e) {
        console.error(e);
        assert.fail(
          "An error is displated while performing the action on the cross chain quotes."
        );
      }

      // Estimating the batch
      let EstimationResponse;
      let EstimatedGas_Estimate;
      let FeeAmount_Estimate;
      let EstimatedGasPrice_Estimate;

      try {
        EstimationResponse = await xdaiMainNetSdk.estimateGatewayBatch();

        for (let k = 0; k < EstimationResponse.requests.length; k++) {
          try {
            assert.isNotEmpty(
              EstimationResponse.requests[k].to,
              "The To Address value is empty in the Estimation Batch response."
            );
          } catch (e) {
            console.error(e);
          }

          try {
            assert.isNotEmpty(
              EstimationResponse.requests[k].data,
              "The Data value is empty in the Estimation Batch Response."
            );
          } catch (e) {
            console.error(e);
          }
        }

        try {
          assert.isNotEmpty(
            EstimationResponse.estimation.feeAmount,
            "The feeAmount value is empty in the Estimation Batch Response."
          );
          FeeAmount_Estimate = EstimationResponse.estimation.feeAmount._hex;
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNotEmpty(
            EstimationResponse.estimation.feeTokenReceiver,
            "The feeTokenReceiver Address is empty in the Estimate Batch Response."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNumber(
            EstimationResponse.estimation.estimatedGas,
            "The estimatedGas value is not number in the Estimate Batch Response."
          );
          EstimatedGas_Estimate = EstimationResponse.estimation.estimatedGas;
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNotEmpty(
            EstimationResponse.estimation.estimatedGasPrice,
            "The estimatedGasPrice value is empty in the Estimation Batch Response."
          );
          EstimatedGasPrice_Estimate =
            EstimationResponse.estimation.estimatedGasPrice._hex;
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNotEmpty(
            EstimationResponse.estimation.signature,
            "The signature value is empty in the Estimation Batch Response."
          );
        } catch (e) {
          console.error(e);
        }
      } catch (e) {
        console.error(e);
        assert.fail(
          "The estimation of the batch is not performed successfully."
        );
      }

      // Submitting the batch
      let SubmissionResponse;
      let EstimatedGas_Submit;
      let FeeAmount_Submit;
      let EstimatedGasPrice_Submit;

      try {
        SubmissionResponse = await xdaiMainNetSdk.submitGatewayBatch({
          guarded: false,
        });

        try {
          assert.isNull(
            SubmissionResponse.transaction,
            "The transaction is no null in the Submit Batch Response."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNotEmpty(
            SubmissionResponse.hash,
            "The hash value is empty in the Submit Batch Response."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.strictEqual(
            SubmissionResponse.state,
            "Queued",
            "The status of the Submit Batch Response is not displayed correctly."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.strictEqual(
            SubmissionResponse.account,
            xdaiSmartWalletAddress,
            "The account address of the Submit Batch Response is not displayed correctly."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNumber(
            SubmissionResponse.nonce,
            "The nonce value is not number in the Submit Batch Response."
          );
        } catch (e) {
          console.error(e);
        }

        for (let x = 0; x < SubmissionResponse.to.length; x++) {
          try {
            assert.isNotEmpty(
              SubmissionResponse.to[x],
              "The To Address is empty in the Submit Batch Response."
            );
          } catch (e) {
            console.error(e);
          }
        }

        for (let y = 0; y < SubmissionResponse.to.length; y++) {
          try {
            assert.isNotEmpty(
              SubmissionResponse.data[y],
              "The data value is empty in the Submit Batch Response."
            );
          } catch (e) {
            console.error(e);
          }
        }

        try {
          assert.isNotEmpty(
            SubmissionResponse.senderSignature,
            "The senderSignature value is empty in the Submit Batch Response."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNumber(
            SubmissionResponse.estimatedGas,
            "The Estimated Gas value is not number in the Submit Batch Response."
          );
          EstimatedGas_Submit = SubmissionResponse.estimatedGas;
        } catch (e) {
          console.error(e);
        }

        try {
          assert.strictEqual(
            EstimatedGas_Estimate,
            EstimatedGas_Submit,
            "The Estimated Gas value is not displayed correctly."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNotEmpty(
            SubmissionResponse.estimatedGasPrice._hex,
            "The estimatedGasPrice value is empty in the Submit Batch Response."
          );
          EstimatedGasPrice_Submit = SubmissionResponse.estimatedGasPrice._hex;
        } catch (e) {
          console.error(e);
        }

        try {
          assert.strictEqual(
            EstimatedGasPrice_Estimate,
            EstimatedGasPrice_Submit,
            "The Estimated Gas Price value is not displayed correctly."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNull(
            SubmissionResponse.feeToken,
            "The feeToken value is not null in the Submit Batch Response."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNotEmpty(
            SubmissionResponse.feeAmount._hex,
            "The feeAmount value is empty in the Submit Batch Response."
          );
          FeeAmount_Submit = SubmissionResponse.feeAmount._hex;
        } catch (e) {
          console.error(e);
        }

        try {
          assert.strictEqual(
            FeeAmount_Estimate,
            FeeAmount_Submit,
            "The Fee Amount value is not displayed correctly."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNotEmpty(
            SubmissionResponse.feeData,
            "The feeData value is empty in the Submit Batch Response."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNull(
            SubmissionResponse.delayedUntil,
            "The delayedUntil value is not null in the Submit Batch Response."
          );
        } catch (e) {
          console.error(e);
        }
      } catch (e) {
        console.error(e);
        assert.fail(
          "The submittion of the batch is not performed successfully."
        );
      }
    } else {
      console.warn(
        "DUE TO INSUFFICIENT WALLET BALANCE, SKIPPING TEST CASE OF THE CROSS CHAIN QUOTE ACTION FROM ERC20 TOKEN TO ANOTHER CHAIN'S NATIVE TOKEN IN THE QUOTE REQUEST PAYLOAD ON THE OPTIMISM NETWORK"
      );
    }
  });

  it("REGRESSION: Perform the cross chain quote action with the same ERC20 tokens in the quote request payload on the optimism network", async () => {
    if (runTest) {
      // Prepare the quoteRequest Payload
      let quoteRequestPayload;
      let fromChainId = NETWORK_NAME_TO_CHAIN_ID[NetworkNames.Optimism];
      let toChainId = NETWORK_NAME_TO_CHAIN_ID[NetworkNames.Xdai];
      let fromTokenAddress = optimismUsdcAddress; // optimism - USDC
      let toTokenAddress = optimismUsdcAddress; // optimism - USDC
      let fromAmount = ethers.utils.parseUnits("0.5", 6);

      quoteRequestPayload = {
        fromChainId: fromChainId,
        toChainId: toChainId,
        fromTokenAddress: fromTokenAddress,
        toTokenAddress: toTokenAddress,
        fromAmount: fromAmount,
        serviceProvider: CrossChainServiceProvider.LiFi, // Optional parameter
      };

      // Get the cross chain quotes
      try {
        let quotes = await optimismMainNetSdk.getCrossChainQuotes(
          quoteRequestPayload
        );

        if (quotes.items.length == 0) {
          console.log(
            "The items are not displayed in the quotes response when perform the cross chain quote action with the same ERC20 tokens as expected."
          );
        } else {
          assert.fail(
            "The items are displayed in the quotes response when perform the cross chain quote action with the same ERC20 tokens."
          );
        }
      } catch (e) {
        console.error(e);
      }
    } else {
      console.warn(
        "DUE TO INSUFFICIENT WALLET BALANCE, SKIPPING TEST CASE OF THE CROSS CHAIN QUOTE ACTION WITH THE SAME ERC20 TOKENS IN THE QUOTE REQUEST PAYLOAD ON THE OPTIMISM NETWORK"
      );
    }
  });

  it("REGRESSION: Perform the cross chain quote action with exceeded token balance in the quote request payload on the optimism network", async () => {
    if (runTest) {
      // Prepare the quoteRequest Payload
      let quoteRequestPayload;
      let fromChainId = NETWORK_NAME_TO_CHAIN_ID[NetworkNames.Optimism];
      let toChainId = NETWORK_NAME_TO_CHAIN_ID[NetworkNames.Xdai];
      let fromTokenAddress = optimismUsdcAddress;
      let toTokenAddress = xdaiUsdcAddress;
      let fromAmount = ethers.utils.parseUnits("1000", 6); // Exceeded Token Balance

      quoteRequestPayload = {
        fromChainId: fromChainId,
        toChainId: toChainId,
        fromTokenAddress: fromTokenAddress,
        toTokenAddress: toTokenAddress,
        fromAmount: fromAmount,
        serviceProvider: CrossChainServiceProvider.LiFi, // Optional parameter
      };

      // Get the cross chain quotes
      let quotes;
      try {
        quotes = await optimismMainNetSdk.getCrossChainQuotes(
          quoteRequestPayload
        );

        if (quotes.items.length > 0) {
          // Select the first quote
          let quote = quotes.items[0];

          let tokenAddres = quote.estimate.data.fromToken.address;
          let approvalAddress = quote.approvalData.approvalAddress;
          let amount = quote.approvalData.amount;

          // Build the approval transaction request
          let { ContractNames, getContractAbi } = pkg;
          let abi = getContractAbi(ContractNames.ERC20Token);
          let erc20Contract = optimismMainNetSdk.registerContract(
            "erc20Contract",
            abi,
            tokenAddres
          );
          let approvalTransactionRequest = erc20Contract.encodeApprove(
            approvalAddress,
            amount
          );

          // Batch the approval transaction
          await optimismMainNetSdk.batchExecuteAccountTransaction({
            to: approvalTransactionRequest.to,
            data: approvalTransactionRequest.data,
            value: approvalTransactionRequest.value,
          });

          // Batch the cross chain transaction
          let { to, value, data } = quote.transaction;
          await optimismMainNetSdk.batchExecuteAccountTransaction({
            to,
            data: data,
            value,
          });
        } else {
          assert.fail("The quotes are not displayed in the quote list.");
        }
      } catch (e) {
        console.error(e);
        assert.fail(
          "An error is dipslayed in the getCrossChainQuotes response."
        );
      }

      // Estimating the batch
      try {
        try {
          await optimismMainNetSdk.estimateGatewayBatch();
        } catch (e) {
          if (e.errors[0].constraints.reverted == "Transaction reverted") {
            console.log(
              "The validation for exceeded Value is displayed as expected while the batch execution."
            );
          } else {
            console.error(e);
            assert.fail(
              "The expected validation is not displayed when entered the exceeded Value while performing batch execution."
            );
          }
        }
      } catch (e) {
        console.error(e);
        assert.fail(
          "The expected validation is not displayed when entered the exceeded Value while performing batch execution."
        );
      }
    } else {
      console.warn(
        "DUE TO INSUFFICIENT WALLET BALANCE, SKIPPING TEST CASE OF THE CROSS CHAIN QUOTE ACTION WITH EXCEEDED TOKEN BALANCE IN THE QUOTE REQUEST PAYLOAD ON THE OPTIMISM NETWORK"
      );
    }
  });

  it("REGRESSION: Perform the cross chain quote action with low token balance in the quote request payload on the optimism network", async () => {
    if (runTest) {
      // Prepare the quoteRequest Payload
      let quoteRequestPayload;
      let fromChainId = NETWORK_NAME_TO_CHAIN_ID[NetworkNames.Optimism];
      let toChainId = NETWORK_NAME_TO_CHAIN_ID[NetworkNames.Xdai];
      let fromTokenAddress = optimismUsdcAddress;
      let toTokenAddress = xdaiUsdcAddress;
      let fromAmount = ethers.utils.parseUnits("0.00001", 6); // Low Token Balance

      quoteRequestPayload = {
        fromChainId: fromChainId,
        toChainId: toChainId,
        fromTokenAddress: fromTokenAddress,
        toTokenAddress: toTokenAddress,
        fromAmount: fromAmount,
        serviceProvider: CrossChainServiceProvider.LiFi, // Optional parameter
      };

      // Get the cross chain quotes
      let quotes;
      try {
        quotes = await optimismMainNetSdk.getCrossChainQuotes(
          quoteRequestPayload
        );

        if (quotes.items.length > 0) {
          // Select the first quote
          let quote = quotes.items[0];

          let tokenAddres = quote.estimate.data.fromToken.address;
          let approvalAddress = quote.approvalData.approvalAddress;
          let amount = quote.approvalData.amount;

          // Build the approval transaction request
          let { ContractNames, getContractAbi } = pkg;
          let abi = getContractAbi(ContractNames.ERC20Token);
          let erc20Contract = optimismMainNetSdk.registerContract(
            "erc20Contract",
            abi,
            tokenAddres
          );
          let approvalTransactionRequest = erc20Contract.encodeApprove(
            approvalAddress,
            amount
          );

          // Batch the approval transaction
          await optimismMainNetSdk.batchExecuteAccountTransaction({
            to: approvalTransactionRequest.to,
            data: approvalTransactionRequest.data,
            value: approvalTransactionRequest.value,
          });

          // Batch the cross chain transaction
          let { to, value, data } = quote.transaction;
          await optimismMainNetSdk.batchExecuteAccountTransaction({
            to,
            data: data,
            value,
          });
        } else {
          assert.fail("The quotes are not displayed in the quote list.");
        }
      } catch (e) {
        console.error(e);
        assert.fail(
          "An error is dipslayed in the getCrossChainQuotes response."
        );
      }

      // Estimating the batch
      try {
        try {
          await optimismMainNetSdk.estimateGatewayBatch();
          assert.fail(
            "The estimation is performed even if the token balance is low."
          );
        } catch (e) {
          if (e.message == "Can not estimate empty batch") {
            console.log(
              "The estimation is not performed with low token balance as expected."
            );
          } else {
            console.error(e);
            assert.fail("The estimation is performed with low token balance.");
          }
        }
      } catch (e) {
        console.error(e);
        assert.fail("The estimation is performed with low token balance.");
      }
    } else {
      console.warn(
        "DUE TO INSUFFICIENT WALLET BALANCE, SKIPPING TEST CASE OF THE CROSS CHAIN QUOTE ACTION WITH LOW TOKEN BALANCE IN THE QUOTE REQUEST PAYLOAD ON THE OPTIMISM NETWORK"
      );
    }
  });

  it("REGRESSION: Perform the cross chain quote action without estimation of the batch on the optimism network", async () => {
    if (runTest) {
      // Prepare the quoteRequest Payload
      let quoteRequestPayload;
      let fromChainId = NETWORK_NAME_TO_CHAIN_ID[NetworkNames.Optimism];
      let toChainId = NETWORK_NAME_TO_CHAIN_ID[NetworkNames.Xdai];
      let fromTokenAddress = optimismUsdcAddress;
      let toTokenAddress = xdaiUsdcAddress;
      let fromAmount = ethers.utils.parseUnits("1", 6);

      quoteRequestPayload = {
        fromChainId: fromChainId,
        toChainId: toChainId,
        fromTokenAddress: fromTokenAddress,
        toTokenAddress: toTokenAddress,
        fromAmount: fromAmount,
        serviceProvider: CrossChainServiceProvider.LiFi, // Optional parameter
      };

      // Get the cross chain quotes
      let quotes;
      try {
        quotes = await optimismMainNetSdk.getCrossChainQuotes(
          quoteRequestPayload
        );

        if (quotes.items.length > 0) {
          // Select the first quote
          let quote = quotes.items[0];

          let tokenAddres = quote.estimate.data.fromToken.address;
          let approvalAddress = quote.approvalData.approvalAddress;
          let amount = quote.approvalData.amount;

          // Build the approval transaction request
          let { ContractNames, getContractAbi } = pkg;
          let abi = getContractAbi(ContractNames.ERC20Token);
          let erc20Contract = optimismMainNetSdk.registerContract(
            "erc20Contract",
            abi,
            tokenAddres
          );
          let approvalTransactionRequest = erc20Contract.encodeApprove(
            approvalAddress,
            amount
          );

          // Batch the approval transaction
          await optimismMainNetSdk.batchExecuteAccountTransaction({
            to: approvalTransactionRequest.to,
            data: approvalTransactionRequest.data,
            value: approvalTransactionRequest.value,
          });

          // Batch the cross chain transaction
          let { to, value, data } = quote.transaction;
          await optimismMainNetSdk.batchExecuteAccountTransaction({
            to,
            data: data,
            value,
          });
        } else {
          assert.fail("The quotes are not displayed in the quote list.");
        }
      } catch (e) {
        console.error(e);
        assert.fail(
          "An error is dipslayed in the getCrossChainQuotes response."
        );
      }

      // Submitting the batch
      try {
        try {
          await optimismMainNetSdk.submitGatewayBatch({
            guarded: false,
          });
          assert.fail(
            "Status of the batch is submitted without Estimation of batch."
          );
        } catch (e) {
          if (e.message == "Can not submit not estimated batch") {
            console.log(
              "The validation is displayed when submiting the batch without estimation."
            );
          } else {
            console.error(e);
            assert.fail(
              "The submition of batch is completed without estimation."
            );
          }
        }
      } catch (e) {
        console.error(e);
        assert.fail("The submition of batch is completed without estimation.");
      }
    } else {
      console.warn(
        "DUE TO INSUFFICIENT WALLET BALANCE, SKIPPING TEST CASE OF THE CROSS CHAIN QUOTE ACTION WITHOUT ESTIMATION OF THE BATCH ON THE OPTIMISM NETWORK"
      );
    }
  });

  it("REGRESSION: Perform the cross chain quote action with invalid tokenAddress of the approval transaction request on the optimism network", async () => {
    if (runTest) {
      // Prepare the quoteRequest Payload
      let quoteRequestPayload;
      let fromChainId = NETWORK_NAME_TO_CHAIN_ID[NetworkNames.Optimism];
      let toChainId = NETWORK_NAME_TO_CHAIN_ID[NetworkNames.Xdai];
      let fromTokenAddress = optimismUsdcAddress;
      let toTokenAddress = xdaiUsdcAddress;
      let fromAmount = ethers.utils.parseUnits("0.5", 6);

      quoteRequestPayload = {
        fromChainId: fromChainId,
        toChainId: toChainId,
        fromTokenAddress: fromTokenAddress,
        toTokenAddress: toTokenAddress,
        fromAmount: fromAmount,
        serviceProvider: CrossChainServiceProvider.LiFi, // Optional parameter
      };

      // Get the cross chain quotes
      let quotes;
      try {
        quotes = await optimismMainNetSdk.getCrossChainQuotes(
          quoteRequestPayload
        );

        if (quotes.items.length > 0) {
          // Select the first quote
          let quote = quotes.items[0];

          let tokenAddres = "0xAC313d7491910516E06FBfC2A0b5BB49bb072D92"; // Invalid token address
          let approvalAddress = quote.approvalData.approvalAddress;
          let amount = quote.approvalData.amount;

          // Build the approval transaction request
          let { ContractNames, getContractAbi } = pkg;
          let abi = getContractAbi(ContractNames.ERC20Token);
          let erc20Contract = optimismMainNetSdk.registerContract(
            "erc20Contract",
            abi,
            tokenAddres
          );
          let approvalTransactionRequest = erc20Contract.encodeApprove(
            approvalAddress,
            amount
          );

          // Batch the approval transaction with invalid tokenAddress in the selected quote request
          try {
            try {
              await optimismMainNetSdk.batchExecuteAccountTransaction({
                to: approvalTransactionRequest.to,
                data: approvalTransactionRequest.data,
                value: approvalTransactionRequest.value,
              });

              assert.fail(
                "The batch executed the account transaction with invalid tokenAddress of the approval transaction request."
              );
            } catch (e) {
              if (
                e.errors[0].constraints.isAddress == "to must be an address"
              ) {
                console.log(
                  "The batch is not executed the account transaction with invalid tokenAddress of the approval transaction request."
                );
              } else {
                console.error(e);
                assert.fail(
                  "The batch is executed the account transaction with invalid tokenAddress of the approval transaction request."
                );
              }
            }
          } catch (e) {
            console.error(e);
            assert.fail(
              "The batch is executed the account transaction with invalid tokenAddress of the approval transaction request."
            );
          }
        } else {
          assert.fail("The quotes are not displayed in the quote list.");
        }
      } catch (e) {
        console.error(e);
        assert.fail(
          "An error is displayed while performing the approval transaction."
        );
      }
    } else {
      console.warn(
        "DUE TO INSUFFICIENT WALLET BALANCE, SKIPPING TEST CASE OF THE CROSS CHAIN QUOTE ACTION WITH INVALID TOKENADDRESS OF THE APPROVAL TRANSACTION REQUEST ON THE OPTIMISM NETWORK"
      );
    }
  });

  it("REGRESSION: Perform the cross chain quote action with invalid approvalAddress of the approval transaction request on the optimism network", async () => {
    if (runTest) {
      // Prepare the quoteRequest Payload
      let quoteRequestPayload;
      let fromChainId = NETWORK_NAME_TO_CHAIN_ID[NetworkNames.Optimism];
      let toChainId = NETWORK_NAME_TO_CHAIN_ID[NetworkNames.Xdai];
      let fromTokenAddress = optimismUsdcAddress;
      let toTokenAddress = xdaiUsdcAddress;
      let fromAmount = ethers.utils.parseUnits("0.5", 6);

      quoteRequestPayload = {
        fromChainId: fromChainId,
        toChainId: toChainId,
        fromTokenAddress: fromTokenAddress,
        toTokenAddress: toTokenAddress,
        fromAmount: fromAmount,
        serviceProvider: CrossChainServiceProvider.LiFi, // Optional parameter
      };

      // Get the cross chain quotes
      let quotes;
      try {
        quotes = await optimismMainNetSdk.getCrossChainQuotes(
          quoteRequestPayload
        );

        if (quotes.items.length > 0) {
          // Select the first quote
          let quote = quotes.items[0];

          let tokenAddres = quote.estimate.data.fromToken.address;
          let approvalAddress = "0xAC313d7491910516E06FBfC2A0b5BB49bb072D9z"; // Invalid Approval Address
          let amount = quote.approvalData.amount;

          // Build the approval transaction request
          let { ContractNames, getContractAbi } = pkg;
          let abi = getContractAbi(ContractNames.ERC20Token);
          let erc20Contract = optimismMainNetSdk.registerContract(
            "erc20Contract",
            abi,
            tokenAddres
          );
          let approvalTransactionRequest = erc20Contract.encodeApprove(
            approvalAddress,
            amount
          );

          // Batch the approval transaction
          await optimismMainNetSdk.batchExecuteAccountTransaction({
            to: approvalTransactionRequest.to,
            data: approvalTransactionRequest.data,
            value: approvalTransactionRequest.value,
          });

          // Batch the cross chain transaction
          let { to, value, data } = quote.transaction;
          await optimismMainNetSdk.batchExecuteAccountTransaction({
            to,
            data: data,
            value,
          });
        } else {
          assert.fail("The quotes are not displayed in the quote list.");
        }
      } catch (e) {
        console.error(e);
        assert.fail("An error is displayed while Get the cross chain quotes.");
      }

      // Estimating the batch
      try {
        try {
          await optimismMainNetSdk.estimateGatewayBatch();
          assert.fail(
            "The batch executed the account transaction with invalid approvalAddress of the approval transaction request."
          );
        } catch (e) {
          if (e.errors[0].constraints.reverted == "Transaction reverted") {
            console.log(
              "The batch is not executed the account transaction with invalid approvalAddress of the approval transaction request."
            );
          } else {
            console.error(e);
            assert.fail(
              "The batch is executed the account transaction with invalid approvalAddress of the approval transaction request."
            );
          }
        }
      } catch (e) {
        console.error(e);
        assert.fail(
          "The batch is executed the account transaction with invalid approvalAddress of the approval transaction request."
        );
      }
    } else {
      console.warn(
        "DUE TO INSUFFICIENT WALLET BALANCE, SKIPPING TEST CASE OF THE CROSS CHAIN QUOTE ACTION WITH INVALID APPROVALADDRESS OF THE APPROVAL TRANSACTION REQUEST ON THE OPTIMISM NETWORK"
      );
    }
  });

  it("REGRESSION: Perform the cross chain quote action with invalid amount of the approval transaction request on the optimism network", async () => {
    if (runTest) {
      // Prepare the quoteRequest Payload
      let quoteRequestPayload;
      let fromChainId = NETWORK_NAME_TO_CHAIN_ID[NetworkNames.Optimism];
      let toChainId = NETWORK_NAME_TO_CHAIN_ID[NetworkNames.Xdai];
      let fromTokenAddress = optimismUsdcAddress;
      let toTokenAddress = xdaiUsdcAddress;
      let fromAmount = ethers.utils.parseUnits("0.5", 6);

      quoteRequestPayload = {
        fromChainId: fromChainId,
        toChainId: toChainId,
        fromTokenAddress: fromTokenAddress,
        toTokenAddress: toTokenAddress,
        fromAmount: fromAmount,
        serviceProvider: CrossChainServiceProvider.LiFi, // Optional parameter
      };

      // Get the cross chain quotes
      let quotes;
      try {
        quotes = await optimismMainNetSdk.getCrossChainQuotes(
          quoteRequestPayload
        );

        if (quotes.items.length > 0) {
          // Select the first quote
          let quote = quotes.items[0];

          let tokenAddres = quote.estimate.data.fromToken.address;
          let approvalAddress = quote.approvalData.approvalAddress;
          let amount_num = Math.floor(Math.random() * 5000);
          let amount = amount_num.toString(); // Invalid Amount

          // Build the approval transaction request
          let { ContractNames, getContractAbi } = pkg;
          let abi = getContractAbi(ContractNames.ERC20Token);
          let erc20Contract = optimismMainNetSdk.registerContract(
            "erc20Contract",
            abi,
            tokenAddres
          );
          let approvalTransactionRequest = erc20Contract.encodeApprove(
            approvalAddress,
            amount
          );

          // Batch the approval transaction
          await optimismMainNetSdk.batchExecuteAccountTransaction({
            to: approvalTransactionRequest.to,
            data: approvalTransactionRequest.data,
            value: approvalTransactionRequest.value,
          });

          // Batch the cross chain transaction
          let { to, value, data } = quote.transaction;
          await optimismMainNetSdk.batchExecuteAccountTransaction({
            to,
            data: data,
            value,
          });
        } else {
          assert.fail("The quotes are not displayed in the quote list.");
        }
      } catch (e) {
        console.error(e);
        assert.fail("An error is displayed while Get the cross chain quotes.");
      }

      // Estimating the batch
      try {
        try {
          await optimismMainNetSdk.estimateGatewayBatch();
          assert.fail(
            "The batch executed the account transaction with invalid amount of the approval transaction request."
          );
        } catch (e) {
          if (e.errors[0].constraints.reverted == "Transaction reverted") {
            console.log(
              "The batch is not executed the account transaction with invalid amount of the approval transaction request."
            );
          } else {
            console.error(e);
            assert.fail(
              "The batch is executed the account transaction with invalid amount of the approval transaction request."
            );
          }
        }
      } catch (e) {
        console.error(e);
        assert.fail(
          "The batch is executed the account transaction with invalid amount of the approval transaction request."
        );
      }
    } else {
      console.warn(
        "DUE TO INSUFFICIENT WALLET BALANCE, SKIPPING TEST CASE OF THE CROSS CHAIN QUOTE ACTION WITH INVALID AMOUNT OF THE APPROVAL TRANSACTION REQUEST ON THE OPTIMISM NETWORK"
      );
    }
  });

  it("REGRESSION: Perform the cross chain quote action with invalid To Address of the approval transaction payload on the optimism network", async () => {
    if (runTest) {
      // Prepare the quoteRequest Payload
      let quoteRequestPayload;
      let fromChainId = NETWORK_NAME_TO_CHAIN_ID[NetworkNames.Optimism];
      let toChainId = NETWORK_NAME_TO_CHAIN_ID[NetworkNames.Xdai];
      let fromTokenAddress = optimismUsdcAddress;
      let toTokenAddress = xdaiUsdcAddress;
      let fromAmount = ethers.utils.parseUnits("0.5", 6);

      quoteRequestPayload = {
        fromChainId: fromChainId,
        toChainId: toChainId,
        fromTokenAddress: fromTokenAddress,
        toTokenAddress: toTokenAddress,
        fromAmount: fromAmount,
        serviceProvider: CrossChainServiceProvider.LiFi, // Optional parameter
      };

      // Get the cross chain quotes
      let quotes;
      try {
        quotes = await optimismMainNetSdk.getCrossChainQuotes(
          quoteRequestPayload
        );

        if (quotes.items.length > 0) {
          // Select the first quote
          let quote = quotes.items[0];

          let tokenAddres = quote.estimate.data.fromToken.address;
          let approvalAddress = quote.approvalData.approvalAddress;
          let amount = quote.approvalData.amount;

          // Build the approval transaction request
          let { ContractNames, getContractAbi } = pkg;
          let abi = getContractAbi(ContractNames.ERC20Token);
          let erc20Contract = optimismMainNetSdk.registerContract(
            "erc20Contract",
            abi,
            tokenAddres
          );
          let approvalTransactionRequest = erc20Contract.encodeApprove(
            approvalAddress,
            amount
          );

          // Batch the approval transaction
          try {
            try {
              await optimismMainNetSdk.batchExecuteAccountTransaction({
                to: "0x4ECaBa5870353805a9F068101A40E0f32ed605Cz", // Invalid To Address
                data: approvalTransactionRequest.data,
                value: approvalTransactionRequest.value,
              });

              console.error(e);
              assert.fail(
                "The batch approval transaction is performed with invalid To Address of the approval transaction payload."
              );
            } catch (e) {
              if (
                e.errors[0].constraints.isAddress == "to must be an address"
              ) {
                console.log(
                  "The batch approval transaction is not performed with invalid To Address of the approval transaction payload."
                );
              } else {
                console.error(e);
                assert.fail(
                  "The batch approval transaction is performed with invalid To Address of the approval transaction payload."
                );
              }
            }
          } catch (e) {
            console.error(e);
            assert.fail(
              "The batch approval transaction is performed with invalid To Address of the approval transaction payload."
            );
          }
        } else {
          assert.fail("The quotes are not displayed in the quote list.");
        }
      } catch (e) {
        console.error(e);
        assert.fail(
          "An error is displayed while performing the approval transaction."
        );
      }
    } else {
      console.warn(
        "DUE TO INSUFFICIENT WALLET BALANCE, SKIPPING TEST CASE OF THE CROSS CHAIN QUOTE ACTION WITH INVALID TO ADDRESS OF THE APPROVAL TRANSACTION PAYLOAD ON THE OPTIMISM NETWORK"
      );
    }
  });

  it("REGRESSION: Perform the advance route lifi action without fromChainId value in the quote request payload on the optimism network", async () => {
    if (runTest) {
      // Prepare the quoteRequest Payload
      let quoteRequestPayload;
      let toChainId = NETWORK_NAME_TO_CHAIN_ID[NetworkNames.Xdai];
      let fromTokenAddress = optimismUsdcAddress;
      let toTokenAddress = xdaiUsdcAddress;
      let fromAmount = ethers.utils.parseUnits("0.5", 6);

      quoteRequestPayload = {
        toChainId: toChainId,
        fromTokenAddress: fromTokenAddress,
        toTokenAddress: toTokenAddress,
        fromAmount: fromAmount,
        serviceProvider: CrossChainServiceProvider.LiFi, // Optional parameter
      };

      // Get the advance routes lifi without fromchainid value
      try {
        try {
          await optimismMainNetSdk.getAdvanceRoutesLiFi(quoteRequestPayload);
          assert.fail(
            "The advance routes lifi is completed without fromChainId of the Get advance routes lifi."
          );
        } catch (e) {
          if (
            e.errors[0].constraints.isPositive ==
            "fromChainId must be a positive number"
          ) {
            console.log(
              "The advance routes lifi is not completed without fromChainId of the Get advance routes lifi as expected."
            );
          } else {
            console.error(e);
            assert.fail(
              "The advance routes lifi is completed without fromChainId of the Get advance routes lifi."
            );
          }
        }
      } catch (e) {
        console.error(e);
        assert.fail(
          "The advance routes lifi is completed without fromChainId of the Get advance routes lifi."
        );
      }
    } else {
      console.warn(
        "DUE TO INSUFFICIENT WALLET BALANCE, SKIPPING TEST CASE OF THE ADVANCE ROUTE LIFI ACTION WITHOUT FROMCHAINID VALUE IN THE QUOTE REQUEST PAYLOAD ON THE OPTIMISM NETWORK"
      );
    }
  });

  it("REGRESSION: Perform the advance route lifi action without toChainId value in the quote request payload on the optimism network", async () => {
    if (runTest) {
      // Prepare the quoteRequest Payload
      let quoteRequestPayload;
      let fromChainId = NETWORK_NAME_TO_CHAIN_ID[NetworkNames.Optimism];
      let fromTokenAddress = optimismUsdcAddress;
      let toTokenAddress = xdaiUsdcAddress;
      let fromAmount = ethers.utils.parseUnits("0.5", 6);

      quoteRequestPayload = {
        fromChainId: fromChainId,
        fromTokenAddress: fromTokenAddress,
        toTokenAddress: toTokenAddress,
        fromAmount: fromAmount,
        serviceProvider: CrossChainServiceProvider.LiFi, // Optional parameter
      };

      // Get the advance routes lifi without tochainid value
      try {
        try {
          await optimismMainNetSdk.getAdvanceRoutesLiFi(quoteRequestPayload);
          assert.fail(
            "The advance routes lifi is completed without toChainId of the Get advance routes lifi."
          );
        } catch (e) {
          if (
            e.errors[0].constraints.isPositive ==
            "toChainId must be a positive number"
          ) {
            console.log(
              "The advance routes lifi is not completed without toChainId of the Get advance routes lifi as expected."
            );
          } else {
            console.error(e);
            assert.fail(
              "The advance routes lifi is completed without toChainId of the Get advance routes lifi."
            );
          }
        }
      } catch (e) {
        console.error(e);
        assert.fail(
          "The advance routes lifi is completed without toChainId of the Get advance routes lifi."
        );
      }
    } else {
      console.warn(
        "DUE TO INSUFFICIENT WALLET BALANCE, SKIPPING TEST CASE OF THE ADVANCE ROUTE LIFI ACTION WITHOUT TOCHAINID VALUE IN THE QUOTE REQUEST PAYLOAD ON THE OPTIMISM NETWORK"
      );
    }
  });

  it("REGRESSION: Perform the advance route lifi action without fromTokenAddress value in the quote request payload on the optimism network", async () => {
    if (runTest) {
      // Prepare the quoteRequest Payload
      let quoteRequestPayload;
      let fromChainId = NETWORK_NAME_TO_CHAIN_ID[NetworkNames.Optimism];
      let toChainId = NETWORK_NAME_TO_CHAIN_ID[NetworkNames.Xdai];
      let toTokenAddress = xdaiUsdcAddress;
      let fromAmount = ethers.utils.parseUnits("0.5", 6);

      quoteRequestPayload = {
        fromChainId: fromChainId,
        toChainId: toChainId,
        toTokenAddress: toTokenAddress,
        fromAmount: fromAmount,
        serviceProvider: CrossChainServiceProvider.LiFi, // Optional parameter
      };

      // Get the advance routes lifi without fromtokenaddress value
      try {
        try {
          await optimismMainNetSdk.getAdvanceRoutesLiFi(quoteRequestPayload);
          assert.fail(
            "The advance routes lifi is completed without fromTokenAddress of the Get advance routes lifi."
          );
        } catch (e) {
          if (
            e.errors[0].constraints.isAddress ==
            "fromTokenAddress must be an address"
          ) {
            console.log(
              "The advance routes lifi is not completed without fromTokenAddress of the Get advance routes lifi as expected."
            );
          } else {
            console.error(e);
            assert.fail(
              "The advance routes lifi is completed without fromTokenAddress of the Get advance routes lifi."
            );
          }
        }
      } catch (e) {
        console.error(e);
        assert.fail(
          "The advance routes lifi is completed without fromTokenAddress of the Get advance routes lifi."
        );
      }
    } else {
      console.warn(
        "DUE TO INSUFFICIENT WALLET BALANCE, SKIPPING TEST CASE OF THE ADVANCE ROUTE LIFI ACTION WITHOUT FROMTOKENADDRESS VALUE IN THE QUOTE REQUEST PAYLOAD ON THE OPTIMISM NETWORK"
      );
    }
  });

  it("REGRESSION: Perform the advance route lifi action without toTokenAddress value in the quote request payload on the optimism network", async () => {
    if (runTest) {
      // Prepare the quoteRequest Payload
      let quoteRequestPayload;
      let fromChainId = NETWORK_NAME_TO_CHAIN_ID[NetworkNames.Optimism];
      let toChainId = NETWORK_NAME_TO_CHAIN_ID[NetworkNames.Xdai];
      let fromTokenAddress = optimismUsdcAddress;
      let fromAmount = ethers.utils.parseUnits("0.5", 6);

      quoteRequestPayload = {
        fromChainId: fromChainId,
        toChainId: toChainId,
        fromTokenAddress: fromTokenAddress,
        fromAmount: fromAmount,
        serviceProvider: CrossChainServiceProvider.LiFi, // Optional parameter
      };

      // Get the advance routes lifi without totokenaddress value
      try {
        try {
          await optimismMainNetSdk.getAdvanceRoutesLiFi(quoteRequestPayload);
          assert.fail(
            "The advance routes lifi is completed without totokenaddress of the Get advance routes lifi."
          );
        } catch (e) {
          if (
            e.errors[0].constraints.isAddress ==
            "toTokenAddress must be an address"
          ) {
            console.log(
              "The advance routes lifi is not completed without totokenaddress of the Get advance routes lifi as expected."
            );
          } else {
            console.error(e);
            assert.fail(
              "The advance routes lifi is completed without totokenaddress of the Get advance routes lifi."
            );
          }
        }
      } catch (e) {
        console.error(e);
        assert.fail(
          "The advance routes lifi is completed without totokenaddress of the Get advance routes lifi."
        );
      }
    } else {
      console.warn(
        "DUE TO INSUFFICIENT WALLET BALANCE, SKIPPING TEST CASE OF THE ADVANCE ROUTE LIFI ACTION WITHOUT TOTOKENADDRESS VALUE IN THE QUOTE REQUEST PAYLOAD ON THE OPTIMISM NETWORK"
      );
    }
  });

  it("REGRESSION: Perform the advance route lifi action without fromAmount value in the quote request payload on the optimism network", async () => {
    if (runTest) {
      // Prepare the quoteRequest Payload
      let quoteRequestPayload;
      let fromChainId = NETWORK_NAME_TO_CHAIN_ID[NetworkNames.Optimism];
      let toChainId = NETWORK_NAME_TO_CHAIN_ID[NetworkNames.Xdai];
      let fromTokenAddress = optimismUsdcAddress;
      let toTokenAddress = xdaiUsdcAddress;

      quoteRequestPayload = {
        fromChainId: fromChainId,
        toChainId: toChainId,
        fromTokenAddress: fromTokenAddress,
        toTokenAddress: toTokenAddress,
        serviceProvider: CrossChainServiceProvider.LiFi, // Optional parameter
      };

      // Get the advance routes lifi without fromamount value
      try {
        try {
          await optimismMainNetSdk.getAdvanceRoutesLiFi(quoteRequestPayload);
          assert.fail(
            "The advance routes lifi is completed without fromamount of the Get advance routes lifi."
          );
        } catch (e) {
          if (
            e.errors[0].constraints.IsBigNumberish ==
            "fromAmount must be big numberish"
          ) {
            console.log(
              "The advance routes lifi is not completed without fromamount of the Get advance routes lifi as expected."
            );
          } else {
            console.error(e);
            assert.fail(
              "The advance routes lifi is completed without fromamount of the Get advance routes lifi."
            );
          }
        }
      } catch (e) {
        console.error(e);
        assert.fail(
          "The advance routes lifi is completed without fromamount of the Get advance routes lifi."
        );
      }
    } else {
      console.warn(
        "DUE TO INSUFFICIENT WALLET BALANCE, SKIPPING TEST CASE OF THE ADVANCE ROUTE LIFI ACTION WITHOUT FROMAMOUNT VALUE IN THE QUOTE REQUEST PAYLOAD ON THE OPTIMISM NETWORK"
      );
    }
  });

  it("REGRESSION: Perform the advance route lifi action from native token to another chain's ERC20 token in the quote request payload on the optimism network", async () => {
    if (runTest) {
      // Prepare the quoteRequest Payload
      let quoteRequestPayload;
      let fromChainId = NETWORK_NAME_TO_CHAIN_ID[NetworkNames.Optimism];
      let toChainId = NETWORK_NAME_TO_CHAIN_ID[NetworkNames.Xdai];
      let fromTokenAddress = ethers.constants.AddressZero; // optimism - Native Token
      let toTokenAddress = xdaiUsdcAddress;
      let fromAmount = ethers.utils.parseUnits("0.5", 18);

      quoteRequestPayload = {
        fromChainId: fromChainId,
        toChainId: toChainId,
        fromTokenAddress: fromTokenAddress,
        toTokenAddress: toTokenAddress,
        fromAmount: fromAmount,
        serviceProvider: CrossChainServiceProvider.LiFi, // Optional parameter
      };

      // Get the advance routes lifi
      let advanceRoutesLiFi;
      try {
        advanceRoutesLiFi = await optimismMainNetSdk.getAdvanceRoutesLiFi(
          quoteRequestPayload
        );

        if (advanceRoutesLiFi.items.length > 0) {
          for (let i = 0; i < advanceRoutesLiFi.items.length; i++) {
            try {
              assert.isNotEmpty(
                advanceRoutesLiFi.items[i].id,
                "The id value is empty in the advance routes lifi response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isNumber(
                advanceRoutesLiFi.items[i].fromChainId,
                "The fromChainId value is not number in the advance routes lifi response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isNotEmpty(
                advanceRoutesLiFi.items[i].fromAmountUSD,
                "The fromAmountUSD value is empty in the advance routes lifi response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isNotEmpty(
                advanceRoutesLiFi.items[i].fromAmount,
                "The fromAmount value is empty in the advance routes lifi response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isNotEmpty(
                advanceRoutesLiFi.items[i].fromToken,
                "The fromToken value is empty in the advance routes lifi response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.strictEqual(
                advanceRoutesLiFi.items[i].fromAddress,
                optimismSmartWalletAddress,
                "The fromAmount value is not displayed correct in the advance routes lifi response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isNumber(
                advanceRoutesLiFi.items[i].toChainId,
                "The toChainId value is not number in the advance routes lifi response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isNotEmpty(
                advanceRoutesLiFi.items[i].toAmountUSD,
                "The toAmountUSD value is empty in the advance routes lifi response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isNotEmpty(
                advanceRoutesLiFi.items[i].toAmount,
                "The toAmount value is empty in the advance routes lifi response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isNotEmpty(
                advanceRoutesLiFi.items[i].toAmountMin,
                "The toAmountMin value is empty in the advance routes lifi response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isNotEmpty(
                advanceRoutesLiFi.items[i].toToken,
                "The toToken value is empty in the advance routes lifi response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.strictEqual(
                advanceRoutesLiFi.items[i].toAddress,
                optimismSmartWalletAddress,
                "The toAddress value is not displayed correct in the advance routes lifi response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isNotEmpty(
                advanceRoutesLiFi.items[i].gasCostUSD,
                "The gasCostUSD value is empty in the advance routes lifi response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isFalse(
                advanceRoutesLiFi.items[i].containsSwitchChain,
                "The containsSwitchChain value is not false in the advance routes lifi response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isNotEmpty(
                advanceRoutesLiFi.items[i].steps,
                "The steps value is empty in the advance routes lifi response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isNotEmpty(
                advanceRoutesLiFi.items[i].insurance,
                "The insurance value is empty in the advance routes lifi response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isNotEmpty(
                advanceRoutesLiFi.items[i].tags,
                "The tags value is enpty in the advance routes lifi response."
              );
            } catch (e) {
              console.error(e);
            }
          }

          if (advanceRoutesLiFi.items.length > 0) {
            // Select the first advance route lifi
            let advanceRouteLiFi = advanceRoutesLiFi.items[0];
            let transactions = await optimismMainNetSdk.getStepTransaction({
              route: advanceRouteLiFi,
            });

            for (let j = 0; j < transactions.items.length; j++) {
              try {
                assert.isNotEmpty(
                  transactions.items[j].to,
                  "The To Address value is empty in the transactions response."
                );
              } catch (e) {
                console.error(e);
              }

              try {
                assert.isNotEmpty(
                  transactions.items[j].gasLimit,
                  "The gasLimit value is empty in the transactions response."
                );
              } catch (e) {
                console.error(e);
              }

              try {
                assert.isNotEmpty(
                  transactions.items[j].gasPrice,
                  "The gasPrice value is empty in the transactions response."
                );
              } catch (e) {
                console.error(e);
              }

              try {
                assert.isNotEmpty(
                  transactions.items[j].data,
                  "The data value is empty in the transactions response."
                );
              } catch (e) {
                console.error(e);
              }

              try {
                assert.isNotEmpty(
                  transactions.items[j].value,
                  "The value's value is empty in the transactions response."
                );
              } catch (e) {
                console.error(e);
              }

              try {
                assert.isNumber(
                  transactions.items[j].chainId,
                  "The chainId value is not number in the transactions response."
                );
              } catch (e) {
                console.error(e);
              }

              try {
                assert.isNull(
                  transactions.items[j].type,
                  "The type value is not null in the transactions response."
                );
              } catch (e) {
                console.error(e);
              }
            }

            for (let transaction of transactions.items) {
              // Batch the approval transaction
              await optimismMainNetSdk.batchExecuteAccountTransaction({
                to: transaction.to,
                data: transaction.data,
                value: transaction.value,
              });
            }
          }
        } else {
          assert.fail(
            "Not getting the items in the advanceRoutesLiFi response."
          );
        }
      } catch (e) {
        console.error(e);
        assert.fail(
          "An error is displated while performing the action on the advance routes lifi."
        );
      }

      // Estimating the batch
      let EstimationResponse;
      let EstimatedGas_Estimate;
      let FeeAmount_Estimate;
      let EstimatedGasPrice_Estimate;

      try {
        EstimationResponse = await optimismMainNetSdk.estimateGatewayBatch();

        for (let k = 0; k < EstimationResponse.requests.length; k++) {
          try {
            assert.isNotEmpty(
              EstimationResponse.requests[k].to,
              "The To Address value is empty in the Batch Execution Account Transaction response."
            );
          } catch (e) {
            console.error(e);
          }

          try {
            assert.isNotEmpty(
              EstimationResponse.requests[k].data,
              "The data value is empty in the Batch Execution Account Transaction response."
            );
          } catch (e) {
            console.error(e);
          }
        }

        try {
          assert.isNotEmpty(
            EstimationResponse.estimation.feeAmount,
            "The feeAmount value is empty in the Estimation Response."
          );
          FeeAmount_Estimate = EstimationResponse.estimation.feeAmount._hex;
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNotEmpty(
            EstimationResponse.estimation.feeTokenReceiver,
            "The feeTokenReceiver Address of the Estimate Batch Response is empty in the Batch Estimation Response."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNumber(
            EstimationResponse.estimation.estimatedGas,
            "The estimatedGas value is not number in the Estimate Batch Response."
          );
          EstimatedGas_Estimate = EstimationResponse.estimation.estimatedGas;
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNotEmpty(
            EstimationResponse.estimation.estimatedGasPrice,
            "The estimatedGasPrice value is empty in the Estimation Response."
          );
          EstimatedGasPrice_Estimate =
            EstimationResponse.estimation.estimatedGasPrice._hex;
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNotEmpty(
            EstimationResponse.estimation.signature,
            "The signature value is empty in the Estimation Response."
          );
        } catch (e) {
          console.error(e);
        }
      } catch (e) {
        console.error(e);
        assert.fail(
          "The estimation of the batch is not performed successfully."
        );
      }

      // Submitting the batch
      let SubmissionResponse;
      let EstimatedGas_Submit;
      let FeeAmount_Submit;
      let EstimatedGasPrice_Submit;

      try {
        SubmissionResponse = await optimismMainNetSdk.submitGatewayBatch({
          guarded: false,
        });

        try {
          assert.isNull(
            SubmissionResponse.transaction,
            "The transaction value is not null in the Submit Batch Response."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNotEmpty(
            SubmissionResponse.hash,
            "The hash value is empty in the Submit Batch Response."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.strictEqual(
            SubmissionResponse.state,
            "Queued",
            "The status of the Submit Batch Response is not displayed correctly."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.strictEqual(
            SubmissionResponse.account,
            optimismSmartWalletAddress,
            "The account address of the Submit Batch Response is not displayed correctly."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNumber(
            SubmissionResponse.nonce,
            "The nonce value is not number in the Submit Batch Response."
          );
        } catch (e) {
          console.error(e);
        }

        for (let x = 0; x < SubmissionResponse.to.length; x++) {
          try {
            assert.isNotEmpty(
              SubmissionResponse.to[x],
              "The To Address is not empty in the Submit Batch Response."
            );
          } catch (e) {
            console.error(e);
          }

          try {
            assert.isNotEmpty(
              SubmissionResponse.data[x],
              "The data value is empty in the Submit Batch Response."
            );
          } catch (e) {
            console.error(e);
          }
        }

        try {
          assert.isNotEmpty(
            SubmissionResponse.senderSignature,
            "The senderSignature value is empty in the Submit Batch Response."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNumber(
            SubmissionResponse.estimatedGas,
            "The Estimated Gas value is not number in the Submit Batch Response."
          );
          EstimatedGas_Submit = SubmissionResponse.estimatedGas;
        } catch (e) {
          console.error(e);
        }

        try {
          assert.strictEqual(
            EstimatedGas_Estimate,
            EstimatedGas_Submit,
            "The Estimated Gas value is not displayed correctly."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNotEmpty(
            SubmissionResponse.estimatedGasPrice._hex,
            "The estimatedGasPrice value is empty in the Submit Batch Response."
          );
          EstimatedGasPrice_Submit = SubmissionResponse.estimatedGasPrice._hex;
        } catch (e) {
          console.error(e);
        }

        try {
          assert.strictEqual(
            EstimatedGasPrice_Estimate,
            EstimatedGasPrice_Submit,
            "The Estimated Gas Price value is not displayed correctly."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNull(
            SubmissionResponse.feeToken,
            "The feeToken value is not null in the Submit Batch Response."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNotEmpty(
            SubmissionResponse.feeAmount._hex,
            "The feeAmount value is empty in the Submit Batch Response."
          );
          FeeAmount_Submit = SubmissionResponse.feeAmount._hex;
        } catch (e) {
          console.error(e);
        }

        try {
          assert.strictEqual(
            FeeAmount_Estimate,
            FeeAmount_Submit,
            "The Fee Amount value is not displayed correctly."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNotEmpty(
            SubmissionResponse.feeData,
            "The feeData value is empty in the Submit Batch Response."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNull(
            SubmissionResponse.delayedUntil,
            "The delayedUntil value is not null in the Submit Batch Response."
          );
        } catch (e) {
          console.error(e);
        }
      } catch (e) {
        console.error(e);
        assert.fail(
          "The submittion of the batch is not performed successfully."
        );
      }
    } else {
      console.warn(
        "DUE TO INSUFFICIENT WALLET BALANCE, SKIPPING TEST CASE OF THE ADVANCE ROUTE LIFI ACTION FROM NATIVE TOKEN TO ANOTHER CHAIN'S ERC20 TOKEN IN THE QUOTE REQUEST PAYLOAD ON THE OPTIMISM NETWORK"
      );
    }
  });

  it("REGRESSION: Perform the advance route lifi action from ERC20 token to another chain's native token in the quote request payload on the optimism network", async () => {
    if (runTest) {
      // Prepare the quoteRequest Payload
      let quoteRequestPayload;
      let fromChainId = NETWORK_NAME_TO_CHAIN_ID[NetworkNames.Optimism];
      let toChainId = NETWORK_NAME_TO_CHAIN_ID[NetworkNames.Xdai];
      let fromTokenAddress = optimismUsdcAddress;
      let toTokenAddress = ethers.constants.AddressZero; // Xdai - Native Token
      let fromAmount = ethers.utils.parseUnits("0.5", 6);

      quoteRequestPayload = {
        fromChainId: fromChainId,
        toChainId: toChainId,
        fromTokenAddress: fromTokenAddress,
        toTokenAddress: toTokenAddress,
        fromAmount: fromAmount,
        serviceProvider: CrossChainServiceProvider.LiFi, // Optional parameter
      };

      // Get the advance routes lifi
      let advanceRoutesLiFi;
      try {
        advanceRoutesLiFi = await optimismMainNetSdk.getAdvanceRoutesLiFi(
          quoteRequestPayload
        );

        if (advanceRoutesLiFi.items.length > 0) {
          for (let i = 0; i < advanceRoutesLiFi.items.length; i++) {
            try {
              assert.isNotEmpty(
                advanceRoutesLiFi.items[i].id,
                "The id value is empty in the advance routes lifi response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isNumber(
                advanceRoutesLiFi.items[i].fromChainId,
                "The fromChainId value is not number in the advance routes lifi response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isNotEmpty(
                advanceRoutesLiFi.items[i].fromAmountUSD,
                "The fromAmountUSD value is empty in the advance routes lifi response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isNotEmpty(
                advanceRoutesLiFi.items[i].fromAmount,
                "The fromAmount value is empty in the advance routes lifi response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isNotEmpty(
                advanceRoutesLiFi.items[i].fromToken,
                "The fromToken value is empty in the advance routes lifi response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.strictEqual(
                advanceRoutesLiFi.items[i].fromAddress,
                optimismSmartWalletAddress,
                "The fromAmount value is not displayed correct in the advance routes lifi response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isNumber(
                advanceRoutesLiFi.items[i].toChainId,
                "The toChainId value is not number in the advance routes lifi response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isNotEmpty(
                advanceRoutesLiFi.items[i].toAmountUSD,
                "The toAmountUSD value is empty in the advance routes lifi response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isNotEmpty(
                advanceRoutesLiFi.items[i].toAmount,
                "The toAmount value is empty in the advance routes lifi response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isNotEmpty(
                advanceRoutesLiFi.items[i].toAmountMin,
                "The toAmountMin value is empty in the advance routes lifi response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isNotEmpty(
                advanceRoutesLiFi.items[i].toToken,
                "The toToken value is empty in the advance routes lifi response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.strictEqual(
                advanceRoutesLiFi.items[i].toAddress,
                optimismSmartWalletAddress,
                "The toAddress value is not displayed correct in the advance routes lifi response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isNotEmpty(
                advanceRoutesLiFi.items[i].gasCostUSD,
                "The gasCostUSD value is empty in the advance routes lifi response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isFalse(
                advanceRoutesLiFi.items[i].containsSwitchChain,
                "The containsSwitchChain value is not false in the advance routes lifi response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isNotEmpty(
                advanceRoutesLiFi.items[i].steps,
                "The steps value is empty in the advance routes lifi response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isNotEmpty(
                advanceRoutesLiFi.items[i].insurance,
                "The insurance value is empty in the advance routes lifi response."
              );
            } catch (e) {
              console.error(e);
            }

            try {
              assert.isNotEmpty(
                advanceRoutesLiFi.items[i].tags,
                "The tags value is enpty in the advance routes lifi response."
              );
            } catch (e) {
              console.error(e);
            }
          }

          if (advanceRoutesLiFi.items.length > 0) {
            // Select the first advance route lifi
            let advanceRouteLiFi = advanceRoutesLiFi.items[0];
            let transactions = await optimismMainNetSdk.getStepTransaction({
              route: advanceRouteLiFi,
            });

            for (let j = 0; j < transactions.items.length; j++) {
              try {
                assert.isNotEmpty(
                  transactions.items[j].to,
                  "The To Address value is empty in the transactions response."
                );
              } catch (e) {
                console.error(e);
              }

              try {
                assert.isNotEmpty(
                  transactions.items[j].gasLimit,
                  "The gasLimit value is empty in the transactions response."
                );
              } catch (e) {
                console.error(e);
              }

              try {
                assert.isNotEmpty(
                  transactions.items[j].gasPrice,
                  "The gasPrice value is empty in the transactions response."
                );
              } catch (e) {
                console.error(e);
              }

              try {
                assert.isNotEmpty(
                  transactions.items[j].data,
                  "The data value is empty in the transactions response."
                );
              } catch (e) {
                console.error(e);
              }

              try {
                assert.isNotEmpty(
                  transactions.items[j].value,
                  "The value's value is empty in the transactions response."
                );
              } catch (e) {
                console.error(e);
              }

              try {
                assert.isNumber(
                  transactions.items[j].chainId,
                  "The chainId value is not number in the transactions response."
                );
              } catch (e) {
                console.error(e);
              }

              try {
                assert.isNull(
                  transactions.items[j].type,
                  "The type value is not null in the transactions response."
                );
              } catch (e) {
                console.error(e);
              }
            }

            for (let transaction of transactions.items) {
              // Batch the approval transaction
              await optimismMainNetSdk.batchExecuteAccountTransaction({
                to: transaction.to,
                data: transaction.data,
                value: transaction.value,
              });
            }
          }
        } else {
          assert.fail(
            "Not getting the items in the advanceRoutesLiFi response."
          );
        }
      } catch (e) {
        console.error(e);
        assert.fail(
          "An error is displated while performing the action on the advance routes lifi."
        );
      }

      // Estimating the batch
      let EstimationResponse;
      let EstimatedGas_Estimate;
      let FeeAmount_Estimate;
      let EstimatedGasPrice_Estimate;

      try {
        EstimationResponse = await optimismMainNetSdk.estimateGatewayBatch();

        for (let k = 0; k < EstimationResponse.requests.length; k++) {
          try {
            assert.isNotEmpty(
              EstimationResponse.requests[k].to,
              "The To Address value is empty in the Batch Execution Account Transaction response."
            );
          } catch (e) {
            console.error(e);
          }

          try {
            assert.isNotEmpty(
              EstimationResponse.requests[k].data,
              "The data value is empty in the Batch Execution Account Transaction response."
            );
          } catch (e) {
            console.error(e);
          }
        }

        try {
          assert.isNotEmpty(
            EstimationResponse.estimation.feeAmount,
            "The feeAmount value is empty in the Estimation Response."
          );
          FeeAmount_Estimate = EstimationResponse.estimation.feeAmount._hex;
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNotEmpty(
            EstimationResponse.estimation.feeTokenReceiver,
            "The feeTokenReceiver Address of the Estimate Batch Response is empty in the Batch Estimation Response."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNumber(
            EstimationResponse.estimation.estimatedGas,
            "The estimatedGas value is not number in the Estimate Batch Response."
          );
          EstimatedGas_Estimate = EstimationResponse.estimation.estimatedGas;
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNotEmpty(
            EstimationResponse.estimation.estimatedGasPrice,
            "The estimatedGasPrice value is empty in the Estimation Response."
          );
          EstimatedGasPrice_Estimate =
            EstimationResponse.estimation.estimatedGasPrice._hex;
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNotEmpty(
            EstimationResponse.estimation.signature,
            "The signature value is empty in the Estimation Response."
          );
        } catch (e) {
          console.error(e);
        }
      } catch (e) {
        console.error(e);
        assert.fail(
          "The estimation of the batch is not performed successfully."
        );
      }

      // Submitting the batch
      let SubmissionResponse;
      let EstimatedGas_Submit;
      let FeeAmount_Submit;
      let EstimatedGasPrice_Submit;

      try {
        SubmissionResponse = await optimismMainNetSdk.submitGatewayBatch({
          guarded: false,
        });

        try {
          assert.isNull(
            SubmissionResponse.transaction,
            "The transaction value is not null in the Submit Batch Response."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNotEmpty(
            SubmissionResponse.hash,
            "The hash value is empty in the Submit Batch Response."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.strictEqual(
            SubmissionResponse.state,
            "Queued",
            "The status of the Submit Batch Response is not displayed correctly."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.strictEqual(
            SubmissionResponse.account,
            optimismSmartWalletAddress,
            "The account address of the Submit Batch Response is not displayed correctly."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNumber(
            SubmissionResponse.nonce,
            "The nonce value is not number in the Submit Batch Response."
          );
        } catch (e) {
          console.error(e);
        }

        for (let x = 0; x < SubmissionResponse.to.length; x++) {
          try {
            assert.isNotEmpty(
              SubmissionResponse.to[x],
              "The To Address is not empty in the Submit Batch Response."
            );
          } catch (e) {
            console.error(e);
          }

          try {
            assert.isNotEmpty(
              SubmissionResponse.data[x],
              "The data value is empty in the Submit Batch Response."
            );
          } catch (e) {
            console.error(e);
          }
        }

        try {
          assert.isNotEmpty(
            SubmissionResponse.senderSignature,
            "The senderSignature value is empty in the Submit Batch Response."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNumber(
            SubmissionResponse.estimatedGas,
            "The Estimated Gas value is not number in the Submit Batch Response."
          );
          EstimatedGas_Submit = SubmissionResponse.estimatedGas;
        } catch (e) {
          console.error(e);
        }

        try {
          assert.strictEqual(
            EstimatedGas_Estimate,
            EstimatedGas_Submit,
            "The Estimated Gas value is not displayed correctly."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNotEmpty(
            SubmissionResponse.estimatedGasPrice._hex,
            "The estimatedGasPrice value is empty in the Submit Batch Response."
          );
          EstimatedGasPrice_Submit = SubmissionResponse.estimatedGasPrice._hex;
        } catch (e) {
          console.error(e);
        }

        try {
          assert.strictEqual(
            EstimatedGasPrice_Estimate,
            EstimatedGasPrice_Submit,
            "The Estimated Gas Price value is not displayed correctly."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNull(
            SubmissionResponse.feeToken,
            "The feeToken value is not null in the Submit Batch Response."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNotEmpty(
            SubmissionResponse.feeAmount._hex,
            "The feeAmount value is empty in the Submit Batch Response."
          );
          FeeAmount_Submit = SubmissionResponse.feeAmount._hex;
        } catch (e) {
          console.error(e);
        }

        try {
          assert.strictEqual(
            FeeAmount_Estimate,
            FeeAmount_Submit,
            "The Fee Amount value is not displayed correctly."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNotEmpty(
            SubmissionResponse.feeData,
            "The feeData value is empty in the Submit Batch Response."
          );
        } catch (e) {
          console.error(e);
        }

        try {
          assert.isNull(
            SubmissionResponse.delayedUntil,
            "The delayedUntil value is not null in the Submit Batch Response."
          );
        } catch (e) {
          console.error(e);
        }
      } catch (e) {
        console.error(e);
        assert.fail(
          "The submittion of the batch is not performed successfully."
        );
      }
    } else {
      console.warn(
        "DUE TO INSUFFICIENT WALLET BALANCE, SKIPPING TEST CASE OF THE ADVANCE ROUTE LIFI ACTION FROM ERC20 TOKEN TO ANOTHER CHAIN'S NATIVE TOKEN IN THE QUOTE REQUEST PAYLOAD ON THE OPTIMISM NETWORK"
      );
    }
  });

  it("REGRESSION: Perform the advance route lifi action with the same ERC20 tokens in the quote request payload on the optimism network", async () => {
    if (runTest) {
      // Prepare the quoteRequest Payload
      let quoteRequestPayload;
      let fromChainId = NETWORK_NAME_TO_CHAIN_ID[NetworkNames.Optimism];
      let toChainId = NETWORK_NAME_TO_CHAIN_ID[NetworkNames.Xdai];
      let fromTokenAddress = optimismUsdcAddress; // optimism - USDC
      let toTokenAddress = optimismUsdcAddress; // optimism - USDC
      let fromAmount = ethers.utils.parseUnits("0.5", 6);

      quoteRequestPayload = {
        fromChainId: fromChainId,
        toChainId: toChainId,
        fromTokenAddress: fromTokenAddress,
        toTokenAddress: toTokenAddress,
        fromAmount: fromAmount,
        serviceProvider: CrossChainServiceProvider.LiFi, // Optional parameter
      };

      // Get the advance routes lifi
      try {
        let advanceRoutesLiFi = await optimismMainNetSdk.getAdvanceRoutesLiFi(
          quoteRequestPayload
        );

        if (advanceRoutesLiFi.items.length == 0) {
          console.log(
            "The items are not displayed in the get advance Routes LiFi response as expected."
          );
        } else {
          console.log(
            "The more than one items are displayed in the get advance Routes LiFi response as expected."
          );
        }
      } catch (e) {
        console.error(e);
        assert.fail(
          "The items are displayed in the get advance Routes LiFi response when perform the advance route lifi action with the same ERC20 tokens."
        );
      }
    } else {
      console.warn(
        "DUE TO INSUFFICIENT WALLET BALANCE, SKIPPING TEST CASE OF THE ADVANCE ROUTE LIFI ACTION WITH THE SAME ERC20 TOKENS IN THE QUOTE REQUEST PAYLOAD ON THE OPTIMISM NETWORK"
      );
    }
  });

  it("REGRESSION: Perform the advance route lifi action with exceeded token balance in the quote request payload on the optimism network", async () => {
    if (runTest) {
      // Prepare the quoteRequest Payload
      let quoteRequestPayload;
      let fromChainId = NETWORK_NAME_TO_CHAIN_ID[NetworkNames.Optimism];
      let toChainId = NETWORK_NAME_TO_CHAIN_ID[NetworkNames.Xdai];
      let fromTokenAddress = optimismUsdcAddress;
      let toTokenAddress = xdaiUsdcAddress;
      let fromAmount = ethers.utils.parseUnits("1000", 6); // Exceeded Token Balance

      quoteRequestPayload = {
        fromChainId: fromChainId,
        toChainId: toChainId,
        fromTokenAddress: fromTokenAddress,
        toTokenAddress: toTokenAddress,
        fromAmount: fromAmount,
        serviceProvider: CrossChainServiceProvider.LiFi, // Optional parameter
      };

      // Get the advance routes lifi
      let advanceRoutesLiFi;
      try {
        advanceRoutesLiFi = await optimismMainNetSdk.getAdvanceRoutesLiFi(
          quoteRequestPayload
        );

        if (advanceRoutesLiFi.items.length > 0) {
          // Select the first advance route lifi
          let advanceRouteLiFi = advanceRoutesLiFi.items[0];
          let transactions = await optimismMainNetSdk.getStepTransaction({
            route: advanceRouteLiFi,
          });

          for (let transaction of transactions.items) {
            // Batch the approval transaction
            await optimismMainNetSdk.batchExecuteAccountTransaction({
              to: transaction.to,
              data: transaction.data,
              value: transaction.value,
            });
          }
        }
      } catch (e) {
        console.error(e);
        assert.fail(
          "An error is dipslayed in the getAdvanceRoutesLiFi response."
        );
      }

      // Estimating the batch
      try {
        try {
          await optimismMainNetSdk.estimateGatewayBatch();
        } catch (e) {
          if (e.errors[0].constraints.reverted == "Transaction reverted") {
            console.log(
              "The validation for exceeded Value is displayed as expected while the batch execution."
            );
          } else {
            console.error(e);
            assert.fail(
              "The expected validation is not displayed when entered the exceeded Value while performing batch execution."
            );
          }
        }
      } catch (e) {
        console.error(e);
        assert.fail(
          "The expected validation is not displayed when entered the exceeded Value while performing batch execution."
        );
      }
    } else {
      console.warn(
        "DUE TO INSUFFICIENT WALLET BALANCE, SKIPPING TEST CASE OF THE ADVANCE ROUTE LIFI ACTION WITH EXCEEDED TOKEN BALANCE IN THE QUOTE REQUEST PAYLOAD ON THE OPTIMISM NETWORK"
      );
    }
  });

  it("REGRESSION: Perform the advance route lifi action with low token balance in the quote request payload on the optimism network", async () => {
    if (runTest) {
      // Prepare the quoteRequest Payload
      let quoteRequestPayload;
      let fromChainId = NETWORK_NAME_TO_CHAIN_ID[NetworkNames.Optimism];
      let toChainId = NETWORK_NAME_TO_CHAIN_ID[NetworkNames.Xdai];
      let fromTokenAddress = optimismUsdcAddress;
      let toTokenAddress = xdaiUsdcAddress;
      let fromAmount = ethers.utils.parseUnits("0.00001", 6); // Low Token Balance

      quoteRequestPayload = {
        fromChainId: fromChainId,
        toChainId: toChainId,
        fromTokenAddress: fromTokenAddress,
        toTokenAddress: toTokenAddress,
        fromAmount: fromAmount,
        serviceProvider: CrossChainServiceProvider.LiFi, // Optional parameter
      };

      // Get the advance routes lifi
      let advanceRoutesLiFi;
      try {
        advanceRoutesLiFi = await optimismMainNetSdk.getAdvanceRoutesLiFi(
          quoteRequestPayload
        );

        if (advanceRoutesLiFi.items.length > 0) {
          // Select the first advance route lifi
          let advanceRouteLiFi = advanceRoutesLiFi.items[0];
          let transactions = await optimismMainNetSdk.getStepTransaction({
            route: advanceRouteLiFi,
          });

          for (let transaction of transactions.items) {
            // Batch the approval transaction
            await optimismMainNetSdk.batchExecuteAccountTransaction({
              to: transaction.to,
              data: transaction.data,
              value: transaction.value,
            });
          }
        }
      } catch (e) {
        console.error(e);
        assert.fail(
          "An error is dipslayed in the getAdvanceRoutesLiFi response."
        );
      }

      // Estimating the batch
      try {
        try {
          await optimismMainNetSdk.estimateGatewayBatch();
          assert.fail(
            "The estimation is performed even if the token balance is low."
          );
        } catch (e) {
          if (e.message == "Can not estimate empty batch") {
            console.log(
              "The estimation is not performed with low token balance as expected."
            );
          } else {
            console.error(e);
            assert.fail("The estimation is performed with low token balance.");
          }
        }
      } catch (e) {
        console.error(e);
        assert.fail("The estimation is performed with low token balance.");
      }
    } else {
      console.warn(
        "DUE TO INSUFFICIENT WALLET BALANCE, SKIPPING TEST CASE OF THE ADVANCE ROUTE LIFI ACTION WITH LOW TOKEN BALANCE IN THE QUOTE REQUEST PAYLOAD ON THE OPTIMISM NETWORK"
      );
    }
  });

  it("REGRESSION: Perform the advance route lifi action without estimation of the batch on the optimism network", async () => {
    if (runTest) {
      // Prepare the quoteRequest Payload
      let quoteRequestPayload;
      let fromChainId = NETWORK_NAME_TO_CHAIN_ID[NetworkNames.Optimism];
      let toChainId = NETWORK_NAME_TO_CHAIN_ID[NetworkNames.Xdai];
      let fromTokenAddress = optimismUsdcAddress;
      let toTokenAddress = xdaiUsdcAddress;
      let fromAmount = ethers.utils.parseUnits("1", 6);

      quoteRequestPayload = {
        fromChainId: fromChainId,
        toChainId: toChainId,
        fromTokenAddress: fromTokenAddress,
        toTokenAddress: toTokenAddress,
        fromAmount: fromAmount,
        serviceProvider: CrossChainServiceProvider.LiFi, // Optional parameter
      };

      // Get the advance routes lifi
      let advanceRoutesLiFi;
      try {
        advanceRoutesLiFi = await optimismMainNetSdk.getAdvanceRoutesLiFi(
          quoteRequestPayload
        );

        if (advanceRoutesLiFi.items.length > 0) {
          // Select the first advance route lifi
          let advanceRouteLiFi = advanceRoutesLiFi.items[0];
          let transactions = await optimismMainNetSdk.getStepTransaction({
            route: advanceRouteLiFi,
          });

          for (let transaction of transactions.items) {
            // Batch the approval transaction
            await optimismMainNetSdk.batchExecuteAccountTransaction({
              to: transaction.to,
              data: transaction.data,
              value: transaction.value,
            });
          }
        }
      } catch (e) {
        console.error(e);
        assert.fail(
          "An error is dipslayed in the getAdvanceRoutesLiFi response."
        );
      }

      // Submitting the batch
      try {
        try {
          await optimismMainNetSdk.submitGatewayBatch({
            guarded: false,
          });
          assert.fail(
            "Status of the batch is submitted without Estimation of batch."
          );
        } catch (e) {
          if (e.message == "Can not submit not estimated batch") {
            console.log(
              "The validation is displayed when submiting the batch without estimation."
            );
          } else {
            console.error(e);
            assert.fail(
              "The submition of batch is completed without estimation."
            );
          }
        }
      } catch (e) {
        console.error(e);
        assert.fail("The submition of batch is completed without estimation.");
      }
    } else {
      console.warn(
        "DUE TO INSUFFICIENT WALLET BALANCE, SKIPPING TEST CASE OF THE ADVANCE ROUTE LIFI ACTION WITHOUT ESTIMATION OF THE BATCH ON THE OPTIMISM NETWORK"
      );
    }
  });
});
