// stores files, values, contacts and encrypted values

let FileSaver = require('file-saver');
let Hash = require('../models/Hash.js');
let SwarmFeeds = require('./FDS-SwarmFeeds.js');
let Crypto = require('./FDS-Crypto.js');
let Web3 = require('web3');

let Contact = require('../models/Contact.js');

class SwarmStore {
  constructor(config, Account){
    this.config = config;
    this.Account = Account;
    this.Store = Account.Store;
    this.SF = new SwarmFeeds(config.swarmGateway);
  }

  retrieveFile(storerAccount, hash, decryptProgressCallback = console.log, downloadProgressCallback = console.log){
    return this.Store.getDecryptedFile(hash, storerAccount.privateKey.substring(2), decryptProgressCallback, downloadProgressCallback);
  }

  // stored files

  initStored(storerAccount){
    this.storeEncryptedValue('stored-1.0', '{"storedFiles":[]}', storerAccount, storerAccount.privateKey);
  }

  getStored(query, storerAccount){
    return this.retrieveDecryptedValue('stored-1.0', storerAccount.address, storerAccount.privateKey).then((response)=>{
      let storedFiles = JSON.parse(response).storedFiles;
      let storedHashes = storedFiles.map((f)=>{ return new Hash(f, storerAccount); });
      return storedHashes;
    }).catch((error)=>{
      if(error === 404){
        return [];
      }else{
        throw new Error(error);
      }
    });
  }

  storeFile(storerAccount, file, encryptProgressCallback, uploadProgressCallback, progressMessageCallback){
    return this.Store.storeEncryptedFile(storerAccount, file, storerAccount.privateKey, encryptProgressCallback, uploadProgressCallback, progressMessageCallback).then((hash)=>{
      return this.getStored('all', storerAccount).then((storedFiles)=>{
          storedFiles.push(hash.toJSON());
          return this.storeEncryptedValue('stored-1.0', JSON.stringify({storedFiles: storedFiles}), storerAccount, storerAccount.privateKey);
        });
    });
  }

  // contacts

  initContacts(storerAccount){
    return this.storeEncryptedValue('contacts-1.0', '[]', storerAccount, storerAccount.privateKey);
  }

  getContacts(storerAccount){
    return this.retrieveDecryptedValue('contacts-1.0', storerAccount.address, storerAccount.privateKey)
      .then((contactsJSON)=>{
        let contacts = JSON.parse(contactsJSON);
        return contacts.map((c)=>new Contact(c));
      })
      .catch((error)=>{
        if(error === 404){
          return [];
        }else{
          throw new Error(`couldn't retrieve contacts: ${error}`);
        }
      });
  }

  storeContact(storerAccount, contact){
    return this.getContacts(storerAccount).then((contacts)=>{
      let flatContacts = contacts.map((c)=>c.toJSON());
      flatContacts.push(contact.toJSON());
      let contactsJSON = JSON.stringify(flatContacts);
      return this.storeEncryptedValue('contacts-1.0', contactsJSON, storerAccount, storerAccount.privateKey);
    });
  }

  // values

  storeValue(key, value, storerAccount){
    return this.SF.set(storerAccount.address, key, storerAccount.privateKey, value);
  }

  retrieveValue(key, storerAccount){
    return this.SF.get(storerAccount.address, key);
  }

  // encrypted values

  storeEncryptedValue(key, value, storerAccount, password){
    let iv = Crypto.generateRandomIV();
    return Crypto.encryptString(value, password, iv).then((encryptedString)=>{
      let ivAndEncryptedString = Web3.utils.bytesToHex(iv) + encryptedString.substring(2);
      return this.SF.set(storerAccount.address, key, storerAccount.privateKey, ivAndEncryptedString);
    });
  }

  retrieveDecryptedValue(key, address, password){
    return this.SF.get(address, key, 'arraybuffer').then((encryptedBuffer)=>{
      let ivAndEncryptedString = Web3.utils.bytesToHex(encryptedBuffer);
      let iv = ivAndEncryptedString.substring(0,34);
      let encryptedString = ivAndEncryptedString.substring(34);
      return Crypto.decryptString(encryptedString, password, iv);
    });
  }


}

module.exports = SwarmStore;