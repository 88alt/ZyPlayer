# @zy/crypto

Crypto for Node.js and Web — hash, hmac, symmetric/asymmetric encryption, encoding, and more.

## Install

`@zy/crypto` is not published to npm yet.

Add it as a workspace dependency in your package:

```json
{
  "dependencies": {
    "@zy/crypto": "workspace:*"
  }
}
```

```bash
pnpm install
```

## API

### Hash

```ts
import { hash } from '@zy/crypto';

hash['md5-32']({ src: 'hello' });
hash.sha256({ src: 'hello', outputEncode: 'hex' });
hash.sm3({ src: 'hello' });
```

Supported: `md5-16`, `md5-32`, `sha1`, `sha224`, `sha256`, `sha3`, `sha384`, `sha512`, `sha512-224`, `sha512-256`, `ripemd160`, `sm3`

### HMAC

```ts
import { hmac } from '@zy/crypto';

hmac.sha256({ src: 'hello', key: 'secret' });
hmac.sm3({ src: 'hello', key: 'secret' });
```

Supported: `md5-16`, `md5-32`, `sha1`, `sha224`, `sha256`, `sha3`, `sha384`, `sha512`, `sha512-224`, `sha512-256`, `ripemd160`, `sm3`

### Encrypt

#### AES (node-forge, supports GCM)

```ts
import { aes } from '@zy/crypto';

const encrypted = aes.encode({
  src: 'hello',
  key: '1234567890123456',
  iv: '1234567890123456',
  mode: 'cbc',
  pad: 'pkcs7padding',
  outputEncode: 'hex',
});

const decrypted = aes.decode({
  src: encrypted,
  key: '1234567890123456',
  iv: '1234567890123456',
  mode: 'cbc',
  pad: 'pkcs7padding',
  inputEncode: 'hex',
  outputEncode: 'utf8',
});
```

#### DES / 3DES / RC4 / Rabbit

```ts
import { des, tripleDes, rc4, rabbit } from '@zy/crypto';

des.encode({ src: 'hello', key: '12345678', iv: '12345678', mode: 'cbc' });
```

#### SM4

```ts
import { sm4 } from '@zy/crypto';

sm4.encode({ src: 'hello', key: '1234567890123456', iv: '1234567890123456', mode: 'cbc' });
```

#### RSA

```ts
import { rsa } from '@zy/crypto';

rsa.encode({
  src: 'hello',
  key: '-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----',
  pad: 'rsaes-pkcs1-v1_5',
  outputEncode: 'hex',
});
```

### Encode

```ts
import { base64, unicode, html, gzip, url, hex } from '@zy/crypto';

base64.encode({ src: 'hello' });
base64.decode({ src: 'aGVsbG8=' });

unicode.encode({ src: 'hello' });
html.encode({ src: '<b>bold</b>' });
gzip.encode({ src: 'hello' });
url.encode({ src: 'https://example.com?q=hello' });
hex.encode({ src: 'hello' });
```

## Build

```bash
pnpm build
```

## Modules

| Module                    | Description                                     |
| ------------------------- | ----------------------------------------------- |
| `hash`                    | Hash algorithms (MD5, SHA, SM3, RIPEMD160)      |
| `hmac`                    | HMAC algorithms                                 |
| `aes`                     | AES encrypt/decrypt (node-forge, GCM supported) |
| `des` / `tripleDes`       | DES/3DES encrypt/decrypt (CryptoJS)             |
| `rc4` / `rc4Drop`         | RC4 encrypt/decrypt                             |
| `rabbit` / `rabbitLegacy` | Rabbit encrypt/decrypt                          |
| `rsa`                     | RSA encrypt/decrypt (node-forge)                |
| `sm4`                     | SM4 encrypt/decrypt (sm-crypto-v2)              |
| `base64`                  | Base64 encode/decode                            |
| `unicode`                 | Unicode encode/decode                           |
| `html`                    | HTML entity encode/decode                       |
| `gzip`                    | Gzip compress/decompress                        |
| `url`                     | URL encode/decode                               |
| `hex`                     | Hex encode/decode                               |
