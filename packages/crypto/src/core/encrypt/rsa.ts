import forge from 'node-forge';

import type { RsaOptions } from '../../type';
import { arrayToBytes as forgeArrayToBytes, parse as forgeParse, stringify as forgeStringify } from '../../utils/forge';
import { parse as wordArrayParse, wordArrayToArray } from '../../utils/wordArray';

const PUB_REGEX = /^-----BEGIN PUBLIC KEY-----[\s\S]+?-----END PUBLIC KEY-----[\s\S]*$/;
const PRI_REGEX =
  /^-----BEGIN (?:RSA |ENCRYPTED )?PRIVATE KEY-----[\s\S]+?-----END (?:RSA |ENCRYPTED )?PRIVATE KEY-----[\s\S]*$/;
const ALLOW_HASH_ALGORITHM = ['md5', 'sha1', 'sha256', 'sha384', 'sha512']; // sha224 not supported

const getPad = (pad: string): forge.pki.rsa.EncryptionScheme => {
  switch (pad.toLowerCase()) {
    case 'rsa-oaep':
    case 'rsa-oaep-sha1':
    case 'rsa-oaep-sha224':
    case 'rsa-oaep-sha256':
    case 'rsa-oaep-sha384':
    case 'rsa-oaep-sha512':
    case 'rsa-oaep-md5':
      return 'RSA-OAEP';
    case 'rsaes-pkcs1-v1_5':
      return 'RSAES-PKCS1-V1_5';
    case 'nopadding':
    default:
      return 'NONE';
  }
};

const getKey = (
  key: string,
  type: 'public' | 'private',
  passphrase: string,
  passphraseEncode: NonNullable<RsaOptions['passphraseEncode']>,
): forge.pki.rsa.PublicKey | forge.pki.rsa.PrivateKey => {
  let rsaKey: forge.pki.rsa.PublicKey | forge.pki.rsa.PrivateKey | undefined;

  if (type === 'public') {
    if (!PUB_REGEX.test(key)) throw new Error('Key is not a valid public key');

    rsaKey = forge.pki.publicKeyFromPem(key);
  } else if (type === 'private') {
    if (!PRI_REGEX.test(key)) throw new Error('Key is not a valid private key');

    if (key.includes('ENCRYPTED')) {
      if (!passphrase) throw new Error('Passphrase is required for encrypted private key');

      const passphraseBuffer = wordArrayParse[passphraseEncode as keyof typeof wordArrayParse](passphrase);
      rsaKey = forge.pki.decryptRsaPrivateKey(
        key,
        forgeArrayToBytes(wordArrayToArray(passphraseBuffer) as unknown as ArrayBuffer).getBytes(),
      );
    } else {
      rsaKey = forge.pki.privateKeyFromPem(key);
    }
  }

  if (!rsaKey) throw new Error('Failed to parse RSA key');

  return rsaKey;
};

const getHashAlgorithm = (pad: NonNullable<RsaOptions['pad']>): string => {
  if (getPad(pad) !== 'RSA-OAEP') return '';

  const p = pad.toLowerCase();
  const algorithm = p === 'rsa-oaep' ? 'sha1' : p.replace('rsa-oaep-', '');
  return ALLOW_HASH_ALGORITHM.includes(algorithm) ? algorithm : '';
};

const getSchemeOptions = (
  pad: NonNullable<RsaOptions['pad']>,
):
  | {
      md: forge.md.MessageDigest;
      mgf1: {
        md: forge.md.MessageDigest;
      };
    }
  | undefined => {
  const algorithm = getHashAlgorithm(pad);
  if (!algorithm) return undefined;

  return {
    md: (forge.md as unknown as Record<string, { create: () => forge.md.MessageDigest }>)[algorithm].create(),
    mgf1: {
      md: (forge.md as unknown as Record<string, { create: () => forge.md.MessageDigest }>)[algorithm].create(),
    },
  };
};

const getKeySize = (rsaKey: forge.pki.rsa.PublicKey | forge.pki.rsa.PrivateKey): number => {
  const keySizeBits = rsaKey.n.bitLength();
  const keySizeBytes = (keySizeBits + 7) >> 3;
  return keySizeBytes;
};

const getMaxMsgBytes = (
  rsaKey: forge.pki.rsa.PublicKey | forge.pki.rsa.PrivateKey,
  pad: NonNullable<RsaOptions['pad']>,
): number => {
  const padding = getPad(pad);
  const keySizeBytes = getKeySize(rsaKey);

  if (padding === 'RSA-OAEP') {
    const algorithm = getHashAlgorithm(pad);
    if (!algorithm) throw new Error(`Unsupported OAEP hash algorithm for pad: ${pad}`);
    const hashSizeBytes = (forge.md as unknown as Record<string, { create: () => forge.md.MessageDigest }>)[
      algorithm
    ].create().digestLength;

    return keySizeBytes - 2 * hashSizeBytes - 2; // ≈‌ Math.ceil(keySizeBits / 8) - 2 * hashSizeBytes - 2
  } else if (padding === 'RSAES-PKCS1-V1_5') {
    return keySizeBytes - 11; // ≈‌ Math.ceil(keySizeBits / 8) - 11
  }

  return keySizeBytes;
};

/**
 * RSA 加密/解密工具对象
 */
export const rsa = {
  /**
   * RSA 加密
   * 1/224/256/384: https://emn178.github.io/online-tools/rsa/encrypt/
   * 1/256/384/512: https://tools.tdsay.cn/view/tool/encryptRsa.html
   * https://rivers.chaitin.cn/toolkit/cyberChef/RSAEncrypt
   * http://tool.chacuo.net/cryptrsapubkey
   * 超长文本: https://www.toolzl.com/tools/testrsa.html
   * 变态模式: https://the-x.cn/cryptography/Rsa.aspx
   * 变态模式: https://apiked.com/rsa
   * 变态模式: https://hsmkit.com/rsa-encryption
   *
   * @param {RsaOptions} options - 加密参数
   * @returns {string} - 加密结果
   *
   * @example
   * rsa.encode({
   *   src: 'this is an example',
   *   key: `-----BEGIN PUBLIC KEY-----
        MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAtT8DozafVIYR3Xim2GQX
        TRN0Y/LOh6iwX9xnBwDv+dmEvgJ9J7EDyzkubzsRPGsD+QPtim0Pf4qFat0g2nZb
        0VdTPWubYif2dS6R+I7Orw9khaXAGl6TS3DB1hc66u4EKx2v2dHLIhXj580T1VlY
        SU6+mibO2Lxj0NQfTKlYr9IHo2MnFwVJxCXuxv2hSn5WQT0eQRV1NpxPmeV5soHg
        mDjhqEc4S+2fH1LD73IVkqtZtgkhw3t2kZQWiX7jPWcydKMisG+s7SPNKDq1EMTq
        yCIKiJRUvLfZV1GRSaeYw5clbbxcoPIGv2L7iq/NrbZCWgQs6Bk88p8lJaK77HOl
        AQIDAQAB
        -----END PUBLIC KEY-----
      `,
   *   passphrase: 'zy',
   *   type: 0,
   *   pad: 'rsaes-pkcs1-v1_5',
   *   passphraseEncode: 'utf8',
   *   inputEncode: 'utf8',
   *   outputEncode: 'hex',
   * });
   *  => 091ddc4bb40a8acfaace3585bfb0e78ef3e69a7e4abe9abad9ebce6a8c76aca8887d018ef830a93575c37d1ff132a0ee8055e4e549982d36cf56bb39f6a9f59dad5457cb70ae22be44a3dccd5e03c56a41c975edb7d8134b73d511ec02fa170ac9e12b0aa703cc543ee439276bf16a65cfb2217ff1b7f2069bd1cbbfdb6486a5f42c061f7a59a1468bca612d29eefa83b664987f62d88d621f4568be335d11b71bacbdf6798bf0ac9a5c9fde298255bbf1aca8e5047caeec9f9da7d7b717a9cd3d7ccfa0b6029cf94c99a3ffd17e359391668a11d14a6e4da132d870a4ce4addba22e7fe9c3b90df9e908e796d4a10ea33d86c22ba2af320ee096f6ceaf6e5e7
   *  => nKuZeJClPhChgZRwHwuREXz044ty8lYwOIIOY6fM1PhivBef60t6VfcBNsaHYT9OpNFuu7thcD5GT9ritD8pZbcJFWzcAXm3ica3TJUJ1acXrb7OBJhT9qS2+fB61x3T79U5hY9uVfDwctCNruQWeA96TD8unPc8B/hTioRVfFeqxSYcMn2urO0LQ49TvvYsOATcIEaeweaBDoEiwNjiyWJT6b258t9qD1AiCFzCEX1we0eOmRsL3qpuvGE5vK0KL5pRZDUJOg1GTrGOMcRcfzVWTMBABuy9HsvbA4ezQZ0LS96lB7hqxPG01CV8J+aCD3PLL5XFzOIXnFLs4f3t3g==
   */
  encode: (options: RsaOptions): string => {
    const {
      src,
      key,
      passphrase = '',
      type = 0, // 0: 公钥加密, 1: 私钥加密（非标）
      long = false,
      longBlock = 117, // auto/117/128
      pad = 'rsaes-pkcs1-v1_5',
      passphraseEncode = 'utf8',
      inputEncode = 'utf8',
      outputEncode = 'base64',
    } = options;

    if (!['base64', 'hex'].includes(outputEncode.toLowerCase())) return '';
    if (!src || !key) return '';

    const rsaKey = getKey(key, type === 1 ? 'private' : 'public', passphrase, passphraseEncode);
    const scheme = getPad(pad);
    const schemeOptions = getSchemeOptions(pad);

    const plaintextBuffer = wordArrayParse[inputEncode as keyof typeof wordArrayParse](src);
    const plaintextBytes = forgeArrayToBytes(wordArrayToArray(plaintextBuffer) as unknown as ArrayBuffer).getBytes();

    const encryptFn = (data: string): string => {
      const n = rsaKey.n;
      const e = (rsaKey as forge.pki.rsa.PublicKey).e;
      const d = (rsaKey as forge.pki.rsa.PrivateKey).d;

      if (type === 0) {
        // 公钥加密: C = M^e mod n
        if (scheme === 'RSAES-PKCS1-V1_5' || scheme === 'RSA-OAEP') {
          return (rsaKey as forge.pki.rsa.PublicKey).encrypt(data, scheme, schemeOptions);
        } else if (scheme === 'NONE') {
          const dataBI = new forge.jsbn.BigInteger(forgeStringify.hex(data), 16);
          const encryptedBI = dataBI.modPow(e, n);
          const hex = encryptedBI.toString(16).padStart(n.bitLength() / 4, '0');
          return forgeParse.hex(hex);
        }

        throw new Error(`Public key encryption does not support ${pad} padding`);
      } else {
        // 私钥加密: C = M^d mod n
        if (scheme === 'RSA-OAEP') {
          throw new Error('Private key encryption does not support RSA-OAEP padding');
        } else if (scheme === 'RSAES-PKCS1-V1_5' || scheme === 'NONE') {
          let hexToEncrypt: string = '';
          if (scheme === 'RSAES-PKCS1-V1_5') {
            const keyBytes = rsaKey.n.bitLength() / 8;
            const dataLen = data.length;
            const padLen = keyBytes - dataLen - 3;
            if (padLen < 8) throw new Error('Data too long for key size');

            // 0x00 || 0x01 || PS (0xFF bytes) || 0x00 || Data
            hexToEncrypt = `0001${'FF'.repeat(padLen)}00${forgeStringify.hex(data)}`;
          } else if (scheme === 'NONE') {
            hexToEncrypt = forgeStringify.hex(data);
          }

          const dataBI = new forge.jsbn.BigInteger(hexToEncrypt, 16);
          const encryptedBI = dataBI.modPow(d, n);
          const encryptedHex = encryptedBI.toString(16).padStart(n.bitLength() / 4, '0');
          return forgeParse.hex(encryptedHex);
        }

        throw new Error(`Private key encryption does not support ${pad} padding`);
      }
    };

    let encrypted = '';
    if (long) {
      const maxBlock = typeof longBlock === 'number' && longBlock > 0 ? longBlock : getMaxMsgBytes(rsaKey, pad);

      const encryptedChunks: string[] = [];
      for (let offSet = 0; offSet < plaintextBytes.length; offSet += maxBlock) {
        const chunk = plaintextBytes.slice(offSet, offSet + maxBlock);
        encryptedChunks.push(encryptFn(chunk));
      }

      encrypted = encryptedChunks.join('');
    } else {
      encrypted = encryptFn(plaintextBytes);
    }

    return forgeStringify[outputEncode as keyof typeof forgeStringify](encrypted);
  },
  /**
   * RSA 解密
   * 1/224/256/384: https://emn178.github.io/online-tools/rsa/decrypt/
   * 1/256/384/512: https://tools.tdsay.cn/view/tool/encryptRsa.html
   * https://rivers.chaitin.cn/toolkit/cyberChef/RSADecrypt
   * http://tool.chacuo.net/cryptrsaprikey
   * 超长文本: https://www.toolzl.com/tools/testrsa.html
   * 变态模式: https://the-x.cn/cryptography/Rsa.aspx
   * 变态模式: https://apiked.com/rsa
   * 变态模式: https://hsmkit.com/rsa-encryption
   *
   * @param {RsaOptions} options - 解密参数
   * @returns {string} - 解密结果
   *
   * @example
   * rsa.decode({
   *   src: '091ddc4bb40a8acfaace3585bfb0e78ef3e69a7e4abe9abad9ebce6a8c76aca8887d018ef830a93575c37d1ff132a0ee8055e4e549982d36cf56bb39f6a9f59dad5457cb70ae22be44a3dccd5e03c56a41c975edb7d8134b73d511ec02fa170ac9e12b0aa703cc543ee439276bf16a65cfb2217ff1b7f2069bd1cbbfdb6486a5f42c061f7a59a1468bca612d29eefa83b664987f62d88d621f4568be335d11b71bacbdf6798bf0ac9a5c9fde298255bbf1aca8e5047caeec9f9da7d7b717a9cd3d7ccfa0b6029cf94c99a3ffd17e359391668a11d14a6e4da132d870a4ce4addba22e7fe9c3b90df9e908e796d4a10ea33d86c22ba2af320ee096f6ceaf6e5e7',
   *   key: `-----BEGIN ENCRYPTED PRIVATE KEY-----
        MIIFDjBABgkqhkiG9w0BBQ0wMzAbBgkqhkiG9w0BBQwwDgQIDmaxKA1sPuECAggA
        MBQGCCqGSIb3DQMHBAiQ+zejUc+vvASCBMh+wCmZc8Z6eTuuxO2Vk+0u2eyEh5YF
        ysJ450CFlBP6XT8XLB3YkvhFYJPAE1GcBe0MJjRcRGDsE+XINwOqzALbdwAXEVcF
        gMCvDnG0SR2Q4oEmZd02ExgcbI3098V7kVMQkXH0DHzquH6QQJjxPKkLgA5B6VAn
        c+lmpTsduHossG3Xtl1RSchcOiBsTcOgrcRacVx/gD9PIEbzyoHD0tz0R7HEIZJ2
        ZJ4lbRBGgNPPo6VxPKel6mIfGCfWQpKTc8OVKnHxk3WPmmLssxsMHNMP2SGY8JzG
        WseO479YV+PkR9iSEJj4hvBVW1vIzX1JIrva2RTowBE3T8M/r/p+zdFFoKvOjvDf
        Ko4nrOp8dQ86qTo1vjwxjOTJNhqDFhLz6JXaz9613sVBISbhbVRrvqgrhe2ZcUjt
        y8iN1ajLe/5mWY3Pj9nnKmZC4ZuXYquOgNayjxGNR/F7oaJLETNkTZ/zQJYvyq5A
        PqvdPWSsNDex7K46F0Gpte5B9NZrISN4/BL9QX4tQFBOoXsCWqyA0Vjk6BE0uFZg
        nsHCPMNjNr1LjniXBM8uHysEvSfEV2YFu8gZSkKvmjEPwWePvV5JMV0js1rtV8Bs
        u58lIV+iQ8W5TxCu2Bm+wXd3z1ylNrboteAwpe6onz53RWRNLr215WIh8Rqo+xUE
        qlJ3W5Oim/lwnnafd5lcSPLFgvkrhiDtLmZOJZxP28Kty0JvIapi93sXBClZim5Q
        swgo/BKt0zxa1g9c/Wrn5UBXnUu59LSIro50vrcF77r/awhmvnjtm5ocQdhmFshp
        oHXbcgXAFIfIJkRcLT58bm0Yvzw7lTmB0cpg6+eN3CrqlWDOtzDgSY3hPii/aIQq
        sxSL7OufYUaGY1p2N/r/ZRlGGsdgATUYhkllD+9pIZbwRDjfmkmI11xm+FKarkFK
        1/wagJpyu8WXO1BhzwZXxS7HWN6RwfL8aF94gPrb1XzFJgL8PTWNWtjWWcY5cN0f
        p/hzgJ8rj9iMycBj7hNoDF+L6jZRIQ/N67AMDXW7YrmQQG+KvSGckisJzNrwMXZO
        wBseBitkgC38WC4nMhPGcA45ovX4g2jyJnug5zMoa94X58SCzCjIt9Q+fd8U0g1i
        djxHGZguvh2EbSJYmKw3yumU1jDIfqc5Pdio3It74XCuWKSVaxVa8oVmcZGByvDw
        XYcbcq6MZsS3jrIo2tvbjRHqoNYO6djnfHeO80YVb/xuL5f28zawz+X2JC5oiOT7
        iafE7KMa0ACd/CkR2Wguf1PqEL/tO6K3EkVxDrYPP8X9QlZJriM5jP5zWwy3PtKi
        y/po8dQLmARJveyoyJrog8clHC20VaMfs9Y+WTjREwRe80ZXkvZD8l/b4zWjfMIX
        IVPBUa20weJUUiEe5m0vld1M3W+dIEdjoeQWujPIVYO58+Cy7QOzclWOR0XPldHL
        zu2ec5HjylRM4dVQVbgelkDndYOP8C0Dek5ahsm95G+4Pm7TjW7HJA0TsRcBjDnv
        KDVoCXFTx+MVMI98fcJKNaOMVtmlUpk5QFO2TLV72HknzsGRcmd3+kTOHDkzb/PP
        btl1/B0Iv/JqYYbJFpu0xRL8esTHuTd/tsc8kDV4ryClSvwgZAjbv/3/wlcvUbfe
        yYk=
        -----END ENCRYPTED PRIVATE KEY-----
      `,
   *   passphrase: 'zy',
   *   type: 1,
   *   long: true,
   *   pad: 'rsaes-pkcs1-v1_5',
   *   passphraseEncode: 'utf8',
   *   inputEncode: 'hex',
   *   outputEncode: 'utf8',
   * });
   *  => this is an example
   */
  decode: (options: RsaOptions): string => {
    const {
      src,
      key,
      passphrase = '',
      type = 0, // 0: 私钥解密, 1: 公钥解密（非标）
      long = false,
      pad = 'rsaes-pkcs1-v1_5',
      passphraseEncode = 'utf8',
      inputEncode = 'base64',
      outputEncode = 'utf8',
    } = options;

    if (!['base64', 'hex'].includes(inputEncode.toLowerCase())) return '';
    if (!src || !key) return '';

    const rsaKey = getKey(key, type === 1 ? 'public' : 'private', passphrase, passphraseEncode);
    const schemeOptions = getSchemeOptions(pad);
    const scheme = getPad(pad);

    const cipherBuffer = wordArrayParse[inputEncode as keyof typeof wordArrayParse](src);
    const cipherBytes = forgeArrayToBytes(wordArrayToArray(cipherBuffer) as unknown as ArrayBuffer).getBytes();

    const decryptFn = (data: string): string => {
      const n = rsaKey.n;
      const e = (rsaKey as forge.pki.rsa.PublicKey).e;
      const d = (rsaKey as forge.pki.rsa.PrivateKey).d;

      if (type === 0) {
        // 私钥解密: M = C^d mod n
        if (scheme === 'RSAES-PKCS1-V1_5' || scheme === 'RSA-OAEP') {
          return (rsaKey as forge.pki.rsa.PrivateKey).decrypt(data, scheme, schemeOptions);
        } else if (scheme === 'NONE') {
          const dataBI = new forge.jsbn.BigInteger(forgeStringify.hex(data), 16);
          const decryptedBI = dataBI.modPow(d, n);
          const hex = decryptedBI.toString(16).padStart(n.bitLength() / 4, '0');
          return forgeParse.hex(hex);
        }

        throw new Error(`Private key decryption does not support ${pad} padding`);
      } else {
        // 公钥解密: M = C^e mod n
        if (scheme === 'RSA-OAEP') {
          throw new Error('Public key decryption does not support RSA-OAEP padding');
        } else if (scheme === 'RSAES-PKCS1-V1_5' || scheme === 'NONE') {
          const cipherBI = new forge.jsbn.BigInteger(forgeStringify.hex(data), 16);
          const decryptedBI = cipherBI.modPow(e, n);

          const k = Math.ceil(n.bitLength() / 8);
          const decryptedHex = decryptedBI.toString(16).padStart(k * 2, '0');

          if (scheme === 'RSAES-PKCS1-V1_5') {
            // 填充格式: 00 || BT (01或02) || PS || 00 || Data
            // 私钥加密通常使用 BT=01
            const bt = decryptedHex.substring(2, 4);
            if (decryptedHex.startsWith('00') && (bt === '01' || bt === '02')) {
              const separatorPos = decryptedHex.indexOf('00', 4);
              if (separatorPos !== -1 && separatorPos % 2 === 0) {
                return forgeParse.hex(decryptedHex.substring(separatorPos + 2));
              }
            }
            throw new Error('Invalid PKCS#1 v1.5 padding');
          }

          return forgeParse.hex(decryptedHex);
        }

        throw new Error('Public key decryption is not supported');
      }
    };

    let decrypted = '';
    if (long) {
      const maxBlock = getKeySize(rsaKey);

      const decryptedChunks: string[] = [];
      for (let offSet = 0; offSet < cipherBytes.length; offSet += maxBlock) {
        const chunk = cipherBytes.slice(offSet, offSet + maxBlock);
        decryptedChunks.push(decryptFn(chunk));
      }

      decrypted = decryptedChunks.join('');
    } else {
      decrypted = decryptFn(cipherBytes);
    }

    return forgeStringify[outputEncode as keyof typeof forgeStringify](decrypted);
  },
};
