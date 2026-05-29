export interface IAuthInfo {
  isProxy: boolean;
  scheme: string;
  host: string;
  port: number;
  realm: string;
}

export interface IAuthCert {
  username: string;
  password: string;
}

export interface IAuthCacheProgress {
  callback: (username: string, password: string) => void;
  webContentsId: number;
  url: string;
}

export interface IAuthSendPayload {
  authInfo: IAuthInfo;
  url: string;
  webContentsId: number;
}

export type IAuthRelayPayload = IAuthSendPayload & {
  authCert: IAuthCert;
};
