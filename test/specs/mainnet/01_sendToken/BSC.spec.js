import * as dotenv from "dotenv";
dotenv.config(); // init dotenv

import { assert } from "chai";
import { EnvNames, NetworkNames, Sdk } from "etherspot";
import { utils } from "ethers";

let bscMainNetSdk;
let bscSmartWalletAddress;
let bscSmartWalletOutput;
let bscNativeAddress = null;
let bscUsdcAddress = "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d";
let bscUsdtAddress = "0x55d398326f99059fF775485246999027B3197955";
let toAddress = "0x71Bec2309cC6BDD5F1D73474688A6154c28Db4B5";
let value = "1000000000000"; // 18 decimal
let runTest;

describe("The SDK, when sending a native token with bsc network on the MainNet", () => {
  beforeEach("Checking the sufficient wallet balance", async () => {
    // initialize the sdk
    try {
      bscMainNetSdk = new Sdk(process.env.PRIVATE_KEY, {
        env: EnvNames.MainNets,
        networkName: NetworkNames.Bsc,
      });

      assert.strictEqual(
        bscMainNetSdk.state.accountAddress,
        "0xa5494Ed2eB09F37b4b0526a8e4789565c226C84f",
        "The EOA Address is not calculated correctly."
      );
    } catch (e) {
      console.error(e);
      assert.fail("The SDK is not initialled successfully.");
    }

    // Compute the smart wallet address
    try {
      bscSmartWalletOutput = await bscMainNetSdk.computeContractAccount();
      bscSmartWalletAddress = bscSmartWalletOutput.address;

      assert.strictEqual(
        bscSmartWalletAddress,
        "0x666E17ad27fB620D7519477f3b33d809775d65Fe",
        "The smart wallet address is not calculated correctly."
      );
    } catch (e) {
      console.error(e);
      assert.fail("The smart wallet address is not calculated successfully.");
    }

    let output = await bscMainNetSdk.getAccountBalances();
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
      if (tokenAddress === bscNativeAddress) {
        native_balance = output.items[i].balance;
        native_final = utils.formatUnits(native_balance, 18);
      } else if (tokenAddress === bscUsdcAddress) {
        usdc_balance = output.items[i].balance;
        usdc_final = utils.formatUnits(usdc_balance, 18);
      } else if (tokenAddress === bscUsdtAddress) {
        usdt_balance = output.items[i].balance;
        usdt_final = utils.formatUnits(usdt_balance, 18);
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

  it("SMOKE: Perform the send native token on the bsc network", async () => {
    if (runTest) {
      let AddTransactionToBatchOutput;
      // Adding transaction to a batch
      try {
        AddTransactionToBatchOutput =
          await bscMainNetSdk.batchExecuteAccountTransaction({
            to: toAddress,
            value: value,
          });
      } catch (e) {
        console.error(e);
        assert.fail(
          "The addition of transaction in the batch is not performed successfully."
        );
      }

      try {
        assert.isNotEmpty(
          AddTransactionToBatchOutput.requests[0].to,
          "The To Address value is empty in the Batch Response."
        );
      } catch (e) {
        console.error(e);
      }

      try {
        assert.isNotEmpty(
          AddTransactionToBatchOutput.requests[0].data,
          "The data value is empty in the Batch Reponse."
        );
      } catch (e) {
        console.error(e);
      }

      try {
        assert.isNull(
          AddTransactionToBatchOutput.estimation,
          "The estimation value is not null in the Batch Response."
        );
      } catch (e) {
        console.error(e);
      }

      // Estimating the batch
      let EstimationResponse;
      let EstimatedGas_Estimate;
      let FeeAmount_Estimate;
      let EstimatedGasPrice_Estimate;

      try {
        EstimationResponse = await bscMainNetSdk.estimateGatewayBatch();
      } catch (e) {
        console.error(e);
        assert.fail(
          "The estimation of the batch is not performed successfully."
        );
      }

      try {
        assert.isNotEmpty(
          EstimationResponse.requests[0].to,
          "The To Address value is empty in the Batch Estimation Response."
        );
      } catch (e) {
        console.error(e);
      }

      try {
        assert.isNotEmpty(
          EstimationResponse.requests[0].data,
          "The data value is empty in the Batch Estimation Response."
        );
      } catch (e) {
        console.error(e);
      }

      try {
        assert.isNotEmpty(
          EstimationResponse.estimation.feeTokenReceiver,
          toAddress,
          "The feeTokenReceiver Address of the Batch Estimation Response is not displayed correctly."
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
          EstimationResponse.estimation.feeAmount,
          "The feeAmount value is empty in the Estimation Response."
        );
        FeeAmount_Estimate = EstimationResponse.estimation.feeAmount._hex;
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

      // Submitting the batch
      let SubmissionResponse;
      let EstimatedGas_Submit;
      let FeeAmount_Submit;
      let EstimatedGasPrice_Submit;

      try {
        SubmissionResponse = await bscMainNetSdk.submitGatewayBatch({
          guarded: false,
        });
      } catch (e) {
        console.error(e);
        assert.fail(
          "The submittion of the batch is not performed successfully."
        );
      }

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
          bscSmartWalletAddress,
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
          "The To Address value is empty in the Submit Batch Response."
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
    } else {
      console.warn(
        "DUE TO INSUFFICIENT WALLET BALANCE, SKIPPING TEST CASE OF THE SEND NATIVE TOKEN ON THE BSC NETWORK"
      );
    }
  });

  it("REGRESSION: Perform the send native token with invalid to address on the bsc network", async () => {
    if (runTest) {
      // Adding transaction to a batch with invalid To Address
      try {
        try {
          await bscMainNetSdk.batchExecuteAccountTransaction({
            to: "0x0fd7508903376dab743a02743cadfdc2d92fceb", // Invalid To Address
            value: "1000000000000",
          });
          assert.fail(
            "The batch execution completed with incorrect To Address."
          );
        } catch (e) {
          if (e.errors[0].constraints.isAddress == "to must be an address") {
            console.log(
              "The validation for To Address is displayed as expected while batch execution."
            );
          } else {
            console.error(e);
            assert.fail(
              "The expected validation is not displayed when entered the invalid To Address while performing batch execution."
            );
          }
        }
      } catch (e) {
        console.error(e);
        assert.fail(
          "The expected validation is not displayed when entered the invalid To Address while performing batch execution."
        );
      }
    } else {
      console.warn(
        "DUE TO INSUFFICIENT WALLET BALANCE, SKIPPING TEST CASE OF THE SEND NATIVE TOKEN WITH INVALID TO ADDRESS ON THE BSC NETWORK"
      );
    }
  });

  it("REGRESSION: Perform the send native token with invalid value on the bsc network", async () => {
    if (runTest) {
      // Adding transaction to a batch with invalid Value
      try {
        try {
          await bscMainNetSdk.batchExecuteAccountTransaction({
            to: "0x0fd7508903376dab743a02743cadfdc2d92fceb8",
            value: "0.001", // Invalid Value
          });
          assert.fail("The batch execution colmpleyed with incorrect Value.");
        } catch (e) {
          if (
            e.errors[0].constraints.IsBigNumberish ==
            "value must be big numberish"
          ) {
            console.log(
              "The validation for Value is displayed as expected while the batch execution."
            );
          } else {
            console.error(e);
            assert.fail(
              "The expected validation is not displayed when entered the invalid Value while performing batch execution."
            );
          }
        }
      } catch (e) {
        console.error(e);
        assert.fail(
          "The expected validation is not displayed when entered the invalid Value while performing batch execution."
        );
      }
    } else {
      console.warn(
        "DUE TO INSUFFICIENT WALLET BALANCE, SKIPPING TEST CASE OF THE SEND NATIVE TOKEN WITH INVALID VALUE ON THE BSC NETWORK"
      );
    }
  });

  it("REGRESSION: Perform the send native token with exceeded value on the bsc network", async () => {
    if (runTest) {
      // Adding transaction to a batch with Value as more than the actual Value of the wallet balance
      try {
        await bscMainNetSdk.batchExecuteAccountTransaction({
          to: "0x0fd7508903376dab743a02743cadfdc2d92fceb8",
          value: "100000000000000000000000", // Exceeded Value
        });
      } catch (e) {
        console.error(e);
        assert.fail(
          "The exceeded Value is not required in the wallet balance for the batch execution."
        );
      }

      // estinating the batch
      try {
        try {
          await bscMainNetSdk.estimateGatewayBatch();
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
        "DUE TO INSUFFICIENT WALLET BALANCE, SKIPPING TEST CASE OF THE SEND NATIVE TOKEN WITH EXCEEDED VALUE ON THE BSC NETWORK"
      );
    }
  });

  it("REGRESSION: Perform the send native token on the same address on the bsc network", async () => {
    if (runTest) {
      // Adding transaction to a batch on the same address
      try {
        try {
          await bscMainNetSdk.batchExecuteAccountTransaction({
            to: "0x666E17ad27fB620D7519477f3b33d809775d65Fe", // Send Native Token on Same Address
            value: "1000000000000",
          });
          assert.fail(
            "Addition of the transaction to batch on the same address is performed."
          );
        } catch (e) {
          if (
            e.message ==
            "Destination address should not be the same as sender address"
          ) {
            console.log(
              "The validation is displayed while entering the duplicate sender address."
            );
          } else {
            console.error(e);
            assert.fail(
              "The validation is not displayed while entering the duplicate sender address."
            );
          }
        }
      } catch (e) {
        console.error(e);
        assert.fail(
          "The validation is not displayed while entering the duplicate sender address."
        );
      }
    } else {
      console.warn(
        "DUE TO INSUFFICIENT WALLET BALANCE, SKIPPING TEST CASE OF THE SEND NATIVE TOKEN ON THE SAME ADDRESS ON THE BSC NETWORK"
      );
    }
  });

  it("REGRESSION: Perform the send native token without estimation of the batch on the bsc network", async () => {
    if (runTest) {
      // Adding transaction to a batch without estimation of the batch
      try {
        await bscMainNetSdk.batchExecuteAccountTransaction({
          to: "0x0fd7508903376dab743a02743cadfdc2d92fceb8",
          value: "1000000000000",
        });
      } catch (e) {
        console.error(e);
        assert.fail(
          "The addition of transaction in the batch is not performed successfully."
        );
      }

      // Submitting the batch
      try {
        try {
          await bscMainNetSdk.submitGatewayBatch({
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
        "DUE TO INSUFFICIENT WALLET BALANCE, SKIPPING TEST CASE OF THE SEND NATIVE TOKEN WITHOUT ESTIMATION OF THE BATCH ON THE BSC NETWORK"
      );
    }
  });
});
