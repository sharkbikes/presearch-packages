"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _MultiPartyEscrow = _interopRequireDefault(require("singularitynet-platform-contracts/abi/MultiPartyEscrow"));

var _MultiPartyEscrow2 = _interopRequireDefault(require("singularitynet-platform-contracts/networks/MultiPartyEscrow"));

var _bignumber = require("bignumber.js");

var _lodash = require("lodash");

var _PaymentChannel = _interopRequireDefault(require("./PaymentChannel"));

var _logger = _interopRequireDefault(require("./utils/logger"));

var _bignumber_helper = require("./utils/bignumber_helper");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

class MPEContract {
  /**
   * @param {Web3} web3
   * @param {number} networkId
   */
  constructor(web3, networkId) {
    this._web3 = web3;
    this._networkId = networkId;
    this._contract = new this._web3.eth.Contract(_MultiPartyEscrow.default, _MultiPartyEscrow2.default[networkId].address);
  }
  /**
   * An instance of Multi Party Contract generated by Web3
   * @type {Contract}
   * @see {@link https://web3js.readthedocs.io/en/1.0/web3-eth-contract.html|Web3 Contract}
   */


  get contract() {
    return this._contract;
  }
  /**
   * The public address of the MPE account
   * @type {string}
   */


  get address() {
    return this._contract.options.address;
  }
  /**
   * Returns the balance against the address in Multi Party Escrow Account
   * @param {string} address - The public address of account
   * @returns {Promise<BigNumber>}
   */


  async balance(address) {
    _logger.default.debug('Fetching MPE account balance', {
      tags: ['MPE']
    });

    return this.contract.methods.balances(address).call();
  }
  /**
   * Transfers tokens from the account to MPE account
   * @param {Account} account - The account from which the tokens needs to be transferred.
   * @param {BigNumber} amountInCogs - The amount to transfer in cogs
   * @returns {Promise.<TransactionReceipt>}
   */


  async deposit(account, amountInCogs) {
    const amount = (0, _bignumber_helper.toBNString)(amountInCogs);

    _logger.default.info(`Depositing ${amount}cogs to MPE account`, {
      tags: ['MPE']
    });

    const depositOperation = this.contract.methods.deposit;
    return account.sendTransaction(this.address, depositOperation, amount);
  }
  /**
   * Withdraws tokens from MPE account and deposits to the account
   * @param {Account} account - The account to deposit tokens
   * @param {BigNumber} amountInCogs - The amount to be withdrawn
   * @returns {Promise.<TransactionReceipt>}
   */


  async withdraw(account, amountInCogs) {
    const amount = (0, _bignumber_helper.toBNString)(amountInCogs);

    _logger.default.info(`Withdrawing ${amount}cogs from MPE account`, {
      tags: ['MPE']
    });

    const withdrawOperation = this.contract.methods.withdraw;
    return account.sendTransaction(this.address, withdrawOperation, amount);
  }
  /**
   * Opens a payment channel between an account and the given service with the specified tokens and expiry period
   * @param {Account} account - The account to create payment channel for
   * @param {ServiceClient} service - The AI service between which the payment channel needs to be opened
   * @param {BigNumber} amountInCogs - The initial tokens with the which payment channel needs to be opened
   * @param {BigNumber} expiry - The expiry of the payment channel in terms of block number
   * @returns {Promise.<TransactionReceipt>}
   */


  async openChannel(account, service, amountInCogs, expiry) {
    const amount = (0, _bignumber_helper.toBNString)(amountInCogs);
    const expiryStr = (0, _bignumber_helper.toBNString)(expiry);
    const {
      payment_address: recipientAddress,
      group_id_in_bytes: groupId
    } = service.group;

    _logger.default.info(`Opening new payment channel [amount: ${amount}, expiry: ${expiryStr}]`, {
      tags: ['MPE']
    });

    const openChannelOperation = this.contract.methods.openChannel;
    const signerAddress = await account.getSignerAddress();
    const openChannelFnArgs = [signerAddress, recipientAddress, groupId, amount, expiryStr];
    return account.sendTransaction(this.address, openChannelOperation, ...openChannelFnArgs);
  }
  /**
   * Deposits the specified tokens to MPE Account and opens a payment channel between an account and the given service
   * with the specified tokens and expiry period
   * @param {Account} account - The account against which the operations needs to be performed
   * @param {ServiceClient} service - The AI service between which the payment channel needs to be opened
   * @param {BigNumber} amountInCogs - The initial tokens with the which payment channel needs to be opened
   * @param {BigNumber} expiry - The expiry of the payment channel in terms of block number
   * @returns {Promise.<TransactionReceipt>}
   */


  async depositAndOpenChannel(account, service, amountInCogs, expiry) {
    const amount = (0, _bignumber_helper.toBNString)(amountInCogs);
    const expiryStr = (0, _bignumber_helper.toBNString)(expiry);
    const {
      payment_address: recipientAddress,
      group_id_in_bytes: groupId
    } = service.group;
    const alreadyApprovedAmount = await account.allowance();

    if (amountInCogs > alreadyApprovedAmount) {
      await account.approveTransfer(amountInCogs);
    }

    const depositAndOpenChannelOperation = this.contract.methods.depositAndOpenChannel;
    const signerAddress = await account.getSignerAddress();
    const operationArgs = [signerAddress, recipientAddress, groupId, amount, expiryStr];

    _logger.default.info(`Depositing ${amount}cogs to MPE address and Opening new payment channel [expiry: ${expiryStr}]`, {
      tags: ['MPE']
    });

    return account.sendTransaction(this.address, depositAndOpenChannelOperation, ...operationArgs);
  }
  /**
   * Funds an existing payment channel
   * @param {Account} account - The account against which the operations needs to be performed
   * @param {BigNumber} channelId - The payment channel id
   * @param {BigNumber} amountInCogs - The number of tokens to fund the channel
   * @returns {Promise.<TransactionReceipt>}
   */


  async channelAddFunds(account, channelId, amountInCogs) {
    const channelIdStr = (0, _bignumber_helper.toBNString)(channelId);
    const amount = (0, _bignumber_helper.toBNString)(amountInCogs);
    await this._fundEscrowAccount(account, amountInCogs);

    _logger.default.info(`Funding PaymentChannel[id: ${channelIdStr}] with ${amount}cogs`, {
      tags: ['MPE']
    });

    const channelAddFundsOperation = this.contract.methods.channelAddFunds;
    return account.sendTransaction(this.address, channelAddFundsOperation, channelIdStr, amount);
  }
  /**
   * Extends an existing payment channel
   * @param {Account} account - The account against which the operations needs to be performed
   * @param {BigNumber} channelId - The payment channel id
   * @param {BigNumber} expiry - The expiry in terms of block number to extend the channel
   * @returns {Promise.<TransactionReceipt>}
   */


  async channelExtend(account, channelId, expiry) {
    const channelIdStr = (0, _bignumber_helper.toBNString)(channelId);
    const expiryStr = (0, _bignumber_helper.toBNString)(expiry);

    _logger.default.info(`Extending PaymentChannel[id: ${channelIdStr}]. New expiry is block# ${expiryStr}`, {
      tags: ['MPE']
    });

    const channelExtendOperation = this.contract.methods.channelExtend;
    return account.sendTransaction(this.address, channelExtendOperation, channelIdStr, expiryStr);
  }
  /**
   * Extends and adds funds to an existing payment channel
   * @param {Account} account - The account against which the operations needs to be performed
   * @param {BigNumber} channelId - The payment channel id
   * @param {BigNumber} expiry - The expiry in terms of block number to extend the channel
   * @param {BigNumber} amountInCogs - The number of tokens to fund the channel
   * @returns {Promise.<TransactionReceipt>}
   */


  async channelExtendAndAddFunds(account, channelId, expiry, amountInCogs) {
    const channelIdStr = (0, _bignumber_helper.toBNString)(channelId);
    const amount = (0, _bignumber_helper.toBNString)(amountInCogs);
    const expiryStr = (0, _bignumber_helper.toBNString)(expiry);
    await this._fundEscrowAccount(account, amountInCogs);

    _logger.default.info(`Extending and Funding PaymentChannel[id: ${channelIdStr}] with amount: ${amount} and expiry: ${expiryStr}`, {
      tags: ['MPE']
    });

    const channelExtendAndAddFundsOperation = this.contract.methods.channelExtendAndAddFunds;
    return account.sendTransaction(this.address, channelExtendAndAddFundsOperation, channelIdStr, expiryStr, amount);
  }
  /**
   * Claims unused tokens in a channel.
   * @param {Account} account - The account against which the operations needs to be performed
   * @param {BigNumber} channelId - Channel ID from which to claim the unused tokens
   * @returns {Promise.<TransactionReceipt>}
   */


  async channelClaimTimeout(account, channelId) {
    const channelIdStr = (0, _bignumber_helper.toBNString)(channelId);

    _logger.default.info(`Claiming unused funds from expired channel PaymentChannel[id: ${channelIdStr}]`, {
      tags: ['MPE']
    });

    const channelClaimTimeoutOperation = this.contract.methods.channelClaimTimeout;
    return account.sendTransaction(this.address, channelClaimTimeoutOperation, channelIdStr);
  }
  /**
   * Fetches the latest state of the payment channel
   * @param {BigNumber} channelId - The payment channel id
   * @returns {Promise<any>} - The return value(s) of the smart contract method. If it returns a single value, it’s returned as is. If it has multiple return values they are returned as an object with properties and indices:
   */


  async channels(channelId) {
    const channelIdStr = (0, _bignumber_helper.toBNString)(channelId);

    _logger.default.debug(`Fetch latest PaymentChannel[id: ${channelIdStr}] state`, {
      tags: ['MPE']
    });

    return this.contract.methods.channels(channelIdStr).call();
  }
  /**
   * Fetches all the payment channels opened between the account and the service starting from the given block number
   * @param {Account} account
   * @param {ServiceClient} service
   * @param {number} [startingBlockNumber=MPE Contract deployment block number] - The starting block number to fetch the
   * open channels from
   * @returns {Promise.<PaymentChannel[]>}
   */


  async getPastOpenChannels(account, service, startingBlockNumber) {
    const fromBlock = startingBlockNumber || (await this._deploymentBlockNumber());

    _logger.default.debug(`Fetching all payment channel open events starting at block: ${fromBlock}`, {
      tags: ['MPE']
    });

    const address = await account.getAddress();
    const options = {
      filter: {
        sender: address,
        recipient: service.group.payment_address,
        groupId: service.group.group_id_in_bytes
      },
      fromBlock,
      toBlock: 'latest'
    };
    const channelsOpened = await this.contract.getPastEvents('ChannelOpen', options);
    return (0, _lodash.map)(channelsOpened, channelOpenEvent => {
      const {
        channelId
      } = channelOpenEvent.returnValues;
      return new _PaymentChannel.default(channelId, this._web3, account, service, this);
    });
  }

  async _fundEscrowAccount(account, amountInCogs) {
    const address = await account.getAddress();
    const currentEscrowBalance = await this.balance(address);

    if (amountInCogs > currentEscrowBalance) {
      await account.depositToEscrowAccount(amountInCogs - currentEscrowBalance);
    }
  }

  async _deploymentBlockNumber() {
    const {
      transactionHash
    } = _MultiPartyEscrow2.default[this._networkId];
    const {
      blockNumber
    } = await this._web3.eth.getTransactionReceipt(transactionHash);
    return blockNumber;
  }

}

var _default = MPEContract;
exports.default = _default;