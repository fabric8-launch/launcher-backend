import jsSHA from 'jssha';
import Keycloak from 'keycloak-js';
import _ from 'lodash';
import { v4 as uuidv4 } from 'uuid';
import { AuthenticationApi } from '../authentication-api';
import { Authorizations, KeycloakConfig, OptionalUser } from '../types';

interface StoredData {
  token: string;
  refreshToken?: string;
  idToken?: string;
}

function takeFirst<R>(fn: (...args: any) => Promise<R>): (...args: any) => Promise<R> {
  let pending: Promise<R> | undefined;
  let resolve: (val: R) => void;
  let reject: (err: Error) => void;
  return function(...args) {
    if (!pending) {
      pending = new Promise((_resolve, _reject) => {
        resolve = _resolve;
        reject = _reject;
      });
      fn(...args).then((val) => {
        pending = undefined;
        resolve(val);
      }, error => {
        pending = undefined;
        reject(error);
      });
    }
    return pending;
  };
}

export class KeycloakAuthenticationApi implements AuthenticationApi {

  private _user: OptionalUser;
  private onUserChangeListener?: (user: OptionalUser) => void = undefined;

  private static base64ToUri(b64: string): string {
    return b64.replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  }

  private readonly keycloak: Keycloak.KeycloakInstance;

  constructor(private config: KeycloakConfig, keycloakCoreFactory = Keycloak) {
    this.keycloak = keycloakCoreFactory(config);
    this.refreshToken = takeFirst(this.refreshToken);
  }

  public setOnUserChangeListener(listener: (user: OptionalUser) => void) {
    this.onUserChangeListener = listener;
  }

  public init = (): Promise<OptionalUser> => {
    return new Promise((resolve, reject) => {
      const sessionKC = KeycloakAuthenticationApi.getStoredData();
      this.keycloak.init({ ...sessionKC, checkLoginIframe: false })
        .error((e) => reject(e))
        .success(() => {
          this.initUser();
          resolve(this._user);
        });
      this.keycloak.onTokenExpired = () => {
        this.refreshToken(true)
          .catch(e => console.error(e));
      };
    });
  };

  public async getAuthorizations(provider: string): Promise<Authorizations | undefined> {
    if (!this._user) {
      return;
    }
    return this._user.authorizationsByProvider['kc'];
  }

  public get user() {
    return this._user;
  }

  public login = () => {
    this.keycloak.login();
    return Promise.resolve();
  };

  public logout = () => {
    KeycloakAuthenticationApi.clearStoredData();
    this.keycloak.logout();
  };

  public getAccountManagementLink = () => {
    if (!this._user) {
      return undefined;
    }
    return this.keycloak.createAccountUrl();
  };

  public refreshToken = (force: boolean = false): Promise<OptionalUser> => {
    return new Promise<OptionalUser>((resolve, reject) => {
      if (this._user) {
        console.info('Checking if token needs to be refreshed...');
        this.keycloak.updateToken(force ? -1 : 60)
          .success(() => {
            this.initUser();
            resolve(this.user);
          })
          .error(() => {
            this.logout();
            reject('Failed to refresh token');
          });
      } else {
        reject('User is not authenticated');
      }
    });
  };

  public generateAuthorizationLink = (provider: string = this.config.gitProvider, redirect?: string): string => {
    if (!this.user) {
      return '';
    }
    if (this.user.accountLink[provider]) {
      return this.user.accountLink[provider];
    }
    const nonce = uuidv4();
    const clientId = this.config.clientId;
    const hash = nonce + this.user.sessionState
      + clientId + provider;
    const shaObj = new jsSHA('SHA-256', 'TEXT');
    shaObj.update(hash);
    const hashed = KeycloakAuthenticationApi.base64ToUri(shaObj.getHash('B64'));
    // tslint:disable-next-line
    const link = `${this.keycloak.authServerUrl}/realms/${this.config.realm}/broker/${provider}/link?nonce=${encodeURI(nonce)}&hash=${hashed}&client_id=${encodeURI(clientId)}&redirect_uri=${encodeURI(redirect || window.location.href)}`;
    this.user.accountLink[provider] = link;
    return link;
  };

  private initUser() {
    if (!this.keycloak) {
      this._user = {
        userName: 'Anonymous',
        userPreferredName: 'Anonymous',
        authorizationsByProvider: { kc: { Authorization: `Bearer eyJhbGciOiJIUzI1NiJ9.e30.ZRrHA1JJJW8opsbCGfG_HACGpVUMN_a9IV7pAx_Zmeo` } },
        sessionState: 'sessionState',
        accountLink: {},
      };
      this.triggerUserChange();
      return;
    }
    if (this.keycloak.token) {
      KeycloakAuthenticationApi.setStoredData({
        token: this.keycloak.token,
        refreshToken: this.keycloak.refreshToken,
        idToken: this.keycloak.idToken,
      });
      this._user = {
        userName: _.get(this.keycloak, 'tokenParsed.name'),
        userPreferredName: _.get(this.keycloak, 'tokenParsed.preferred_username'),
        authorizationsByProvider: { kc: { Authorization: `Bearer ${this.keycloak.token}` } },
        sessionState: _.get(this.keycloak, 'tokenParsed.session_state'),
        accountLink: {},
      };
      this.triggerUserChange();
    }
  }

  public get enabled(): boolean {
    return true;
  }

  private triggerUserChange() {
    if (this.onUserChangeListener) {
      this.onUserChangeListener(this._user);
    }
  }

  private static clearStoredData() {
    sessionStorage.clear();
    localStorage.removeItem('kc');
  }

  private static setStoredData(data: StoredData) {
    localStorage.setItem('kc', JSON.stringify(data));
  }

  private static getStoredData(): StoredData | undefined {
    const item = localStorage.getItem('kc');
    return item && JSON.parse(item);
  }
}
