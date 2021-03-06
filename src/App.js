import React, { Component } from 'react';

import '@shopify/polaris/styles.css';
import {
  Page,
  Card,
  Button,
  TextField,
  Select
} from '@shopify/polaris';

import Web3 from 'web3';
import {ZeroEx} from '0x.js';
import BigNumber from 'bignumber.js';
import trade from './trade.js';

const provider = new Web3.providers.HttpProvider('http://localhost:8545')
const zeroEx = new ZeroEx(provider);
let WETH_ADDRESS;
let ZRX_ADDRESS;


class App extends Component {

   constructor(props) {
    super(props);
      this.state = {
      signedOrders: null,
      makerInputAddress: "",
      takerInputAddress: "",
      makerAskAmount: "",
      makerAskAmountChange: "",
      makerBuyAmount: "",
      open: true,
      makerBalance: "",
      takerBalance: "",
      accountsList: [],
      tokenList: [],
      makerReceiveToken: null,
      makerSellToken: null,
      takerDepositToken: "",
      makerTokenType: null,
      takerTokenType: null,
    }
    this.handleMakerInputChange = this.handleMakerInputChange.bind(this);
    this.handleMakerSellAmountChange = this.handleMakerSellAmountChange.bind(this);
    this.handleMakerAskAmountChange = this.handleMakerAskAmountChange.bind(this);
    this.handleTakerInputChange = this.handleTakerInputChange.bind(this);
    this.handleMakerBuyAmountChange = this.handleMakerBuyAmountChange.bind(this);
    this.getMakerBalance = this.getMakerBalance.bind(this);
    this.getTakerBalance = this.getTakerBalance.bind(this);
    this.generateTestAddress = this.generateTestAddress.bind(this);

    this.offer = this.offer.bind(this);
    this.buy = this.buy.bind(this);


  }

  componentDidMount() {
      (async () => {
      const tokenList = await zeroEx.tokenRegistry.getTokensAsync();
      this.setState({tokenList: tokenList});
      })().catch(console.log);
  }


    offer(makerInputAddress,makerSellAmount,makerAskAmount, makerSellToken, makerReceiveToken) {
      (async () => {
      console.log("OFFER");

      const DECIMALS = 18;

      // Addresses
      const NULL_ADDRESS = ZeroEx.NULL_ADDRESS;                                    // Ethereum Null address
      const WETH_ADDRESS = await zeroEx.etherToken.getContractAddressAsync();      // The wrapped ETH token contract
      const ZRX_ADDRESS  = await zeroEx.exchange.getZRXTokenAddressAsync();        // The ZRX token contract

const SELLING_TOKEN_ADDRESS = await zeroEx.tokenRegistry.getTokenAddressBySymbolIfExistsAsync(makerSellToken)
const RECEIVING_TOKEN_ADDRESS = await zeroEx.tokenRegistry.getTokenAddressBySymbolIfExistsAsync(makerReceiveToken);

      const EXCHANGE_ADDRESS   = await zeroEx.exchange.getContractAddressAsync();  // The Exchange.sol address (0x exchange smart contract)
      const accounts =  await zeroEx.getAvailableAddressesAsync();



        // Unlimited allowances to 0x contract for maker
        const txHashAllowMaker = await zeroEx.token.setUnlimitedProxyAllowanceAsync(ZRX_ADDRESS,  makerInputAddress);
        await zeroEx.awaitTransactionMinedAsync(txHashAllowMaker);


        // Generate order
        const order = {
          maker: makerInputAddress,
          taker: NULL_ADDRESS,
          feeRecipient: NULL_ADDRESS,
          makerTokenAddress: SELLING_TOKEN_ADDRESS,
          takerTokenAddress: RECEIVING_TOKEN_ADDRESS,
          exchangeContractAddress: EXCHANGE_ADDRESS,
          salt: ZeroEx.generatePseudoRandomSalt(),
          makerFee: new BigNumber(0),
          takerFee: new BigNumber(0),
          makerTokenAmount: ZeroEx.toBaseUnitAmount(new BigNumber(makerSellAmount), DECIMALS),  // Base 18 decimals
          takerTokenAmount: ZeroEx.toBaseUnitAmount(new BigNumber(makerAskAmount), DECIMALS),  // Base 18 decimals
          expirationUnixTimestampSec: new BigNumber(Date.now() + 3600000),          // Valid up to an hour
        };

        // Create orderHash
        const orderHash = ZeroEx.getOrderHashHex(order);

        // Signing orderHash -> ecSignature
        const ecSignature = await zeroEx.signOrderHashAsync(orderHash, makerInputAddress);

        // Appending signature to order
        const signedOrder = {
                   ...order,
                   ecSignature,
                            };

        this.setState({signedOrders: signedOrder})
        console.log("SIGNED ORDER")
        console.log(signedOrder)

        })().catch(console.log);

  }

  buy(signedOrder, takerInputAddress, makerBuyAmount, takerDepositToken) {
    (async () => {
      console.log("BUY");
      const DECIMALS = 18;
       const WETH_ADDRESS = await zeroEx.etherToken.getContractAddressAsync();
              // Unlimited allowances to 0x contract for taker
        const txHashAllowTaker = await zeroEx.token.setUnlimitedProxyAllowanceAsync(WETH_ADDRESS, takerInputAddress);
        await zeroEx.awaitTransactionMinedAsync(txHashAllowTaker);

        // Convert 1 to base unit 16
        const ethToConvert = ZeroEx.toBaseUnitAmount(new BigNumber(1), DECIMALS);

        // Change ETH to WETH
        const txHashWETH = await zeroEx.etherToken.depositAsync(ethToConvert, takerInputAddress);

        //Mine the transaction that converts ETH to WETH
        await zeroEx.awaitTransactionMinedAsync(txHashWETH);

        // Verify if order is fillable
        await zeroEx.exchange.validateOrderFillableOrThrowAsync(signedOrder);

        //Try to fill order
        const shouldThrowOnInsufficientBalanceOrAllowance = true;
        const fillTakerTokenAmount = ZeroEx.toBaseUnitAmount(new BigNumber(makerBuyAmount), DECIMALS);

        // Try filling order
        const txHash = await zeroEx.exchange.fillOrderAsync(signedOrder, fillTakerTokenAmount,
                                                                  shouldThrowOnInsufficientBalanceOrAllowance, takerInputAddress,);

        // Transaction Receipt
        const txReceipt = await zeroEx.awaitTransactionMinedAsync(txHash);
        console.log("Receipt")
        console.log(txReceipt.logs);

        })().catch(console.log);
  }


  handleMakerInputChange(event) {
    this.setState({makerInputAddress: event});
  }

  handleMakerSellAmountChange(event) {
    this.setState({makerSellAmount: event});
  }

  handleMakerAskAmountChange(event) {
    this.setState({makerAskAmount: event});
  }

  handleTakerInputChange(event) {
    this.setState({takerInputAddress: event});
  }

  handleMakerBuyAmountChange(event) {
    this.setState({makerBuyAmount: event});
  }

  getMakerBalance(makerTokenType, makerInputAddress) {

    const DECIMALS = 18;

    (async () => {

      const tokenAddress = await zeroEx.tokenRegistry.getTokenAddressBySymbolIfExistsAsync(makerTokenType)
      const balance = await zeroEx.token.getBalanceAsync(tokenAddress, makerInputAddress)
    
    this.setState({makerBalance: balance.toNumber()});

        })().catch(console.log);
  }

  getTakerBalance(takerTokenType, takerInputAddress) {
    const DECIMALS = 18;

    (async () => {
      const tokenAddress = await zeroEx.tokenRegistry.getTokenAddressBySymbolIfExistsAsync(takerTokenType)
      const balance = await zeroEx.token.getBalanceAsync(tokenAddress, takerInputAddress)
    this.setState({takerBalance: balance.toNumber()});

        })().catch(console.log);
  }

  generateTestAddress() {
    (async () => {
      const accounts =  await zeroEx.getAvailableAddressesAsync();
      this.setState({accountsList: accounts});

        })().catch(console.log);
  }

  render() {
    console.log(this.state)
    return (
      <Page
        title="SWAP 20"
    >
        <Card>
          <Card.Section>
            <TextField
              label="Deposit address"
              helpText="Input address you want your tokens to be deposited."
              value={this.state.takerInputAddress}
              onChange={(event)=> this.handleTakerInputChange(event)}
              type="text"
            />
          </Card.Section>
          <Card.Section>
            <Select
              label="Buying Token Type"
              options={this.state.tokenList.map((token, i) =>
            `${token.symbol}`)}
              placeholder="Specify the token to be sold."
              value={this.state.takerDepositToken}
              onChange={(value)=> this.setState({takerDepositToken: value})}
            />
            <TextField
              label="Buy amount"
              value={this.state.makerBuyAmount}
              onChange={(event)=> this.handleMakerBuyAmountChange(event)}
              type="number"
              helpText="Input the amount of tokens you want to sell."
            />
          </Card.Section>
          

          <Card.Section>
          <Button destructive onClick={()=>this.buy(this.state.signedOrders,this.state.takerInputAddress,this.state.makerBuyAmount, this.state.takerDepositToken)}>Buy</Button>
          </Card.Section>
        </Card>

        <Card>
          <Card.Section>
            <TextField
              label="Seller address"
              helpText="Input address you want any leftover tokens to be sent to."
              value={this.state.makerInputAddress}
              onChange={(event)=> this.handleMakerInputChange(event)}
              type="text"
            />
            </Card.Section>
            <Card.Section>

             <Select
              label="Selling Token Type"
              options={this.state.tokenList.map((token, i) =>
            `${token.symbol}`)}
              placeholder="Specify the token to be sold."
              value={this.state.makerSellToken}
              onChange={(value)=> this.setState({makerSellToken: value})}
            />

             <TextField
              label="Sell"
              helpText="Specify the amount of token to be sold."
              value={this.state.makerSellAmount}
              onChange={(event)=> this.handleMakerSellAmountChange(event)}
              type="text"
            />
            </Card.Section>
            <Card.Section>
            <Select
              label="Receiving Token"
              options={this.state.tokenList.map((token, i) =>
            `${token.symbol}`)}
              placeholder="Specify the token to be received."
              value={this.state.makerReceiveToken}
              onChange={(value)=> this.setState({makerReceiveToken: value})}
            />
             <TextField
              label="Receiving Amount"
              helpText="Specify the amount of token to be received."
              value={this.state.makerAskAmount}
              onChange={(event)=> this.handleMakerAskAmountChange(event)}
              type="text"
            />
            </Card.Section>

            <Card.Section>
              <Button primary onClick={()=> this.offer(this.state.makerInputAddress,this.state.makerSellAmount,this.state.makerAskAmount,this.state.makerSellToken, this.state.makerReceiveToken)}>Offer</Button>
            </Card.Section>
        </Card>
        <Card title="Seller Balance">
          <Card.Section>
            <Select
              label="Token Type"
              options={this.state.tokenList.map((token, i) =>
            `${token.symbol}`)}
              placeholder="Select"
              value={this.state.makerTokenType}
              onChange={(value)=> this.setState({makerTokenType: value})}
            />
            <TextField
              label="Seller address"
              helpText="Input address to show balance."
              value={this.state.makerInputAddress}
              onChange={(event)=> this.handleMakerInputChange(event)}
              type="text"
            />
            <div>Current Balance: {this.state.makerBalance}</div>
            <Card.Section>
              <Button primary onClick={()=> this.getMakerBalance(this.state.makerTokenType ,this.state.makerInputAddress)}>Get Balance</Button>
            </Card.Section>
          </Card.Section>
        </Card>
        <Card title="Buyer Balance">
          <Card.Section>
            <Select
              label="Token Type"
              options={this.state.tokenList.map((token, i) =>
            `${token.symbol}`)}
              placeholder="Select"
              value={this.state.takerTokenType}
              onChange={(value)=> this.setState({takerTokenType: value})}
            />
            <TextField
              label="Buyer address"
              helpText="Input address to show balance."
              value={this.state.takerInputAddress}
              onChange={(event)=> this.handleTakerInputChange(event)}
              type="text"
            />
            <div>Current Balance: {this.state.takerBalance}</div>
            <Card.Section>
              <Button primary onClick={()=> this.getTakerBalance(this.state.takerTokenType ,this.state.takerInputAddress)}>Get Balance</Button>
            </Card.Section>
          </Card.Section>
        </Card>
        <Card title="Generate Test addresses">
          <Card.Section>
            <div>Test address: </div>
            {this.state.accountsList.map((account, i) =>
            <li key={i}>{account}</li>)}
            <Card.Section>
              <Button primary onClick={()=> this.generateTestAddress()}>Generate test addresses</Button>
            </Card.Section>
          </Card.Section>
        </Card>
      </Page>
    );
  }
}

export default App;
