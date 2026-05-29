export const def = Object.defineProperty;

const { hasOwnProperty } = Object.prototype;
export function has(obj: Record<string, any>, name: string | symbol): boolean {
  return hasOwnProperty.call(obj, name);
}

export function get(obj: Record<string, any>, name: string | symbol): PropertyDescriptor | undefined {
  return Object.getOwnPropertyDescriptor(obj, name);
}

export function mergeDeep(...objects: any[]): any {
  const isObject = (item: any): item is object => item && typeof item === 'object' && !Array.isArray(item);
  return objects.reduce((prev, obj) => {
    Object.keys(obj).forEach((key) => {
      const pVal = prev[key];
      const oVal = obj[key];
      if (Array.isArray(pVal) && Array.isArray(oVal)) {
        prev[key] = pVal.concat(...oVal);
      } else if (isObject(pVal) && isObject(oVal)) {
        prev[key] = mergeDeep(pVal, oVal);
      } else {
        prev[key] = oVal;
      }
    });
    return prev;
  }, {});
}
