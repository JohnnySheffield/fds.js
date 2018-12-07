let NodeCrypto = require('crypto');

class Crypto {
  calculateSharedSecret(privateKey, recipientPublicKey){
    let sender = NodeCrypto.createECDH('secp256k1');
    sender.setPrivateKey(privateKey.substring(2,66), 'hex');
    return sender.computeSecret("04"+recipientPublicKey.substring(2,132), 'hex').toString('hex');
  }

  encryptBuffer(buffer, password){
    // in a promise because later we'll put this in a web worker
    return new Promise((resolve, reject) => {
      if(!password) throw new Error('You must supply a password.');
      let cipher = NodeCrypto.createCipher('aes-256-ctr', password);
      let crypted = cipher.update(new Uint8Array(buffer));
      let cryptedFinal = cipher.final();
      let c = new Uint8Array(crypted.length + cryptedFinal.length);
      c.set(crypted);
      c.set(cryptedFinal, crypted.length);
      resolve(c);
    });
  }

  decryptBuffer(buffer, password){
    var decipher = NodeCrypto.createDecipher('aes-256-ctr', password);
    var dec = decipher.update(buffer);
    let decFinal = decipher.final();
    let d = new Uint8Array(dec.length + decFinal.length);
    d.set(dec);
    d.set(decFinal, dec.length);
    return d;
  }

  decryptedFile(encryptedBuffer, password, decryptedFileName, mimeType) {
    let decryptedBuffer = this.decryptBuffer(encryptedBuffer, password);
    let blob = new Blob([decryptedBuffer], { name: decryptedFileName, type: mimeType });
    blob.name = decryptedFileName;
    return decryptedBuffer;
  }  
}

module.exports = new Crypto;