import forge from 'node-forge';

const bytesTobase64 = (bytes: string): string => {
  return forge.util.encode64(bytes);
};

const bytesToHex = (bytes: string): string => {
  return forge.util.bytesToHex(bytes);
};

const bytesToUtf8 = (bytes: string): string => {
  return forge.util.decodeUtf8(bytes);
};

const bytesToUtf16 = (bytes: string): string => {
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    arr[i] = bytes.charCodeAt(i);
  }
  return forge.util.text.utf16.decode(arr);
};

const hexToBytes = (str: string): string => {
  return forge.util.hexToBytes(str);
};

const base64ToBytes = (str: string): string => {
  return forge.util.decode64(str);
};

const utf8ToBytes = (str: string): string => {
  return forge.util.encodeUtf8(str);
};

const utf16ToBytes = (str: string): string => {
  const bytes: Uint8Array = forge.util.text.utf16.encode(str);
  let result = '';
  for (let i = 0; i < bytes.length; i++) {
    result += String.fromCharCode(bytes[i]);
  }
  return result;
};

export const parse = {
  utf8: utf8ToBytes,
  utf16: utf16ToBytes,
  hex: hexToBytes,
  base64: base64ToBytes,
};

export const stringify = {
  utf8: bytesToUtf8,
  utf16: bytesToUtf16,
  hex: bytesToHex,
  base64: bytesTobase64,
};

export const cloneBytes = (buffer: forge.util.ByteBuffer): forge.util.ByteBuffer => {
  const clonedBuffer = forge.util.createBuffer();
  const data = buffer.getBytes();
  clonedBuffer.putBytes(data);

  return clonedBuffer;
};

export const arrayToBytes = (
  array: string | ArrayBuffer | forge.util.ArrayBufferView | forge.util.ByteStringBuffer,
): forge.util.ByteBuffer => {
  return forge.util.createBuffer(array);
};

export const bytesToArray = (buffer: forge.util.ByteBuffer): Uint8Array => {
  const clonedData = cloneBytes(buffer);
  const bytesStr = clonedData.getBytes();
  const uint8Array = new Uint8Array(bytesStr.length);
  for (let i = 0; i < bytesStr.length; i++) {
    uint8Array[i] = bytesStr.charCodeAt(i);
  }
  return uint8Array;
};

export default { parse, stringify, arrayToBytes, bytesToArray };
