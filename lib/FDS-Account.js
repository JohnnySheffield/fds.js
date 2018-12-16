let AccountStore = require('./FDS-AccountStore.js');
let Wallet = require('./FDS-Wallet.js');
let ENS = require('./FDS-ENS.js');
let Utils = require('./FDS-Utils.js');
let Crypto = require('./FDS-Crypto.js');
let Mail = require('./FDS-Mail.js');
let Swarm = require('./FDS-Swarm.js');
let SwarmStore = require('./FDS-SwarmStore.js');

class Accounts {

  constructor(config){
    this.ENS = new ENS(config.ethGateway, config.ensConfig);
    this.AccountStore = new AccountStore(config, this);
    this.Store = new Swarm(config, this);
    this.SwarmStore = new SwarmStore(config, this);
    this.Mail = new Mail(config, this);
  }

  getAll(){
    return this.AccountStore.getAll();
  }

  /**
   * Creates an FDS account with associated ENS name and stores the account info in localstorage.
   * @createAccount
   * @param {string} subdomain - the subdomain of the ENS record.
   * @param {string} password - password for wallet encryption.
   * @returns {promise} outcome of attempt to create account, Account object or error.      
   */  
  create(subdomain, password, feedbackMessageCallback){
    if(this.isMailboxNameValid(subdomain) === false){
      return Promise.reject('account name is not valid.');
    }else{
      return this.isMailboxNameAvailable(subdomain).then((response)=>{
        if(response === true){
          return this.createSubdomain(subdomain, password, feedbackMessageCallback).then((wallet)=>{
            return this.AccountStore.addAccount(subdomain, wallet.walletV3);
          });
        }else{
          throw new Error('account name is not available.');
        }
      });      
    }
  }

  /**
   * Creates an FDS account with associated ENS name and stores the account info in localstorage.
   * @createSubdomain
   */ 
  createSubdomain(subdomain, password, feedbackMessageCallback){
    console.time('create wallet')
    return new Promise((resolve, reject)=>{
      let dw = new Wallet(); 
      console.timeEnd('create wallet')
      resolve(dw.generate(password));
    }).then((wallet)=>{
      let address = "0x" + wallet.walletV3.address;
      return this.ENS.registerSubdomainToAddress(
        subdomain, 
        address, 
        wallet,
        feedbackMessageCallback
      ).then(()=>{
        return wallet;
      });
    });
  }

  get(subdomain){
    let account = this.AccountStore.get(subdomain);
    if(account === false){
      throw new Error(`${subdomain} account does not exist locally, please import it.`)
    }
    return account;
  }

  // unlock
  unlock(subdomain, password){
    let account = this.get(subdomain);
    let wallet = new Wallet();
    return wallet.fromJSON(account.wallet, password).then((wallet)=>{
      account.address = wallet.getAddressString();
      account.publicKey = wallet.getPublicKeyString();
      account.privateKey =  wallet.getPrivateKeyString();
      return account;
    });  
  }

  //restore
  restore(subdomain, walletJSONString){
    return this.AccountStore.restore(subdomain, walletJSONString);
  }

  delete(subdomain){
    return this.AccountStore.delete(subdomain);
  }

  restoreFromFile(file){
    var match = file.name.match(/fairdrop-wallet-(.*)-backup/);
    if(match.length === 2){
      var subdomain = match[1];
    }else{
      throw new Error('file name should be in the format fairdrop-wallet-subdomain-backup')
    }
    return Utils.fileToString(file).then((walletJSON) => {
      this.restore(subdomain, walletJSON);
    });
  }

  // check to see if name conforms to eth subdomain restrictions
  isMailboxNameValid(mailboxName){
    if(mailboxName === undefined || mailboxName === false) return false;
    let pattern = /^[a-zA-Z0-9_-]*$/
    let matches = mailboxName.match(pattern)
    if(
      mailboxName.length < 23 && 
      mailboxName.length > 3 && 
      matches !== null && 
      matches.length > 0
    ){
      return true;      
    }else{
      return false;
    }
  }

  isMailboxNameAvailable(mailboxName){
    return this.ENS.getSubdomainAvailiability(mailboxName);
  }

}

module.exports = Accounts;