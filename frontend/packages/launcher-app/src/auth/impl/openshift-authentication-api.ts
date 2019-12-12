import axios from 'axios';
import { OpenshiftConfig, OptionalUser, Authorizations, GitProviderConfig } from '../types';
import { AuthenticationApi } from '../authentication-api';

export const AUTH_HEADER_KEY = 'Authorization';
export const OPENSHIFT_AUTH_HEADER_KEY = 'X-OpenShift-Authorization';
export const GIT_AUTH_HEADER_KEY = 'X-Git-Authorization';
export const OPENSHIFT_AUTH_STORAGE_KEY = 'openshift-auth';

const FAKE_AUTH_HEADER = `Bearer eyJhbGciOiJIUzI1NiJ9.e30.ZRrHA1JJJW8opsbCGfG_HACGpVUMN_a9IV7pAx_Zmeo`;

export class OpenshiftAuthenticationApi implements AuthenticationApi {
  private _user: OptionalUser;
  private onUserChangeListener?: (user: OptionalUser) => void = undefined;
  private gitConfig: GitProviderConfig = {} as GitProviderConfig;

  constructor(private config: OpenshiftConfig) {
    if (!config.openshift.responseType) {
      config.openshift.responseType = 'token';
    }
  }

  public async init(): Promise<OptionalUser> {
    this.gitConfig = await this.config.loadGitProvider();
    this._user = this.storedUser;
    let openshiftAuthorizations: Authorizations | undefined;
    if (this._user) {
      openshiftAuthorizations = this._user.authorizationsByProvider.openshift;
    } else {
      openshiftAuthorizations = {
        [AUTH_HEADER_KEY]: FAKE_AUTH_HEADER
      };
      const params = this.parseQuery(window.location.hash.substring(1));
      if (params.access_token) {
        openshiftAuthorizations[OPENSHIFT_AUTH_HEADER_KEY] = `Bearer ${params.access_token}`;
      }
    }
    if (openshiftAuthorizations) {
      try {
        const username = await this.validateOpenShiftAuthorizations(openshiftAuthorizations);
        this._user = {
          userName: username,
          userPreferredName: username,
          authorizationsByProvider: {
            git: this.getProviderAuthorizations('git'),
            openshift: openshiftAuthorizations,
          },
          sessionState: '',
          accountLink: {},
        };
      } catch (e) {
        this.logout();
      }
    }
    const storedGitAuthorizations = this.getProviderAuthorizations('git');
    if (!storedGitAuthorizations) {
      const gitAccessToken = await this.getGitAccessToken();
      if (gitAccessToken && this._user) {
        this._user.authorizationsByProvider.git = {
          [AUTH_HEADER_KEY]: FAKE_AUTH_HEADER,
          [GIT_AUTH_HEADER_KEY]: `Bearer ${gitAccessToken}`,
        };
      }
    }
    this.resetUrl();
    this.storeUser();

    return this._user;
  }

  public async getAuthorizations(provider: string): Promise<Authorizations | undefined> {
    return this.getProviderAuthorizations(provider);
  }

  public getProviderAuthorizations(provider: string): Authorizations | undefined {
    if (!this._user) {
      return;
    }
    return this._user.authorizationsByProvider[provider];
  }

  public generateAuthorizationLink = (provider?: string, redirect?: string): string => {
    const gitProvider = provider || this.gitConfig.gitProvider;
    if (gitProvider === 'github') {
      const redirectUri = redirect || this.cleanUrl(window.location.href);
      return 'https://github.com/login/oauth/authorize?response_type=code&client_id=' +
        `${this.gitConfig.github!.clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=repo%2Cadmin%3Arepo_hook`;
    }
    if (gitProvider === 'gitea') {
      return `${this.gitConfig.gitea!.url}?response_type=code&client_id=` +
        `${this.gitConfig.gitea!.clientId}&redirect_uri=${encodeURIComponent(this.gitConfig.gitea!.redirectUri)}`;
    }

    return this.loginUrl(provider);
  };

  public login = (): void => {
    const url = this.loginUrl();
    window.location.assign(url);
  };

  public logout = (): void => {
    localStorage.removeItem(OPENSHIFT_AUTH_STORAGE_KEY);
    this._user = undefined;
    this.triggerUserChange();
  };

  public getAccountManagementLink = () => {
    return '';
  };

  public refreshToken = async (force?: boolean): Promise<OptionalUser> => {
    return this._user;
  };

  private loginUrl(baseUrl?: string) {
    const conf = this.config.openshift;
    const redirect = this.cleanUrl(window.location.href);
    const url = `${baseUrl || conf.url}` +
      `?client_id=${encodeURIComponent(conf.clientId)}` +
      `&response_type=${encodeURIComponent(conf.responseType!)}` +
      `&redirect_uri=${encodeURIComponent(redirect)}`;
    return url;
  }

  get user() {
    return this._user;
  }

  get enabled(): boolean {
    return true;
  }

  public setOnUserChangeListener(listener: (user: OptionalUser) => void) {
    this.onUserChangeListener = listener;
  }

  private triggerUserChange() {
    if (this.onUserChangeListener) {
      this.onUserChangeListener(this._user);
    }
  }

  private get storedUser(): OptionalUser | undefined {
    const user = localStorage.getItem(OPENSHIFT_AUTH_STORAGE_KEY);
    try {
      if (user) {
        return JSON.parse(user);
      }
    } catch (e) {
      console.warn('stored user was corrupte');
      localStorage.removeItem(OPENSHIFT_AUTH_STORAGE_KEY);
    }
    return undefined;
  }

  private storeUser() {
    if (this.user) {
      localStorage.setItem(OPENSHIFT_AUTH_STORAGE_KEY, JSON.stringify(this.user));
      this.triggerUserChange();
    }
  }

  private async validateOpenShiftAuthorizations(authorizations: Authorizations): Promise<string> {
    const response = await axios.get(this.config.openshift.validateTokenUri, {
      headers: authorizations
    });
    return response.data.name;
  }

  private async getGitAccessToken(): Promise<string | undefined> {
    const query = window.location.href.substr(window.location.href.indexOf('?') + 1);
    const code = this.parseQuery(query).code;
    if (code) {
      const data: any = { code };
      const provider = this.gitConfig.gitProvider;
      data.id = provider === 'github' ? 'GitHub' : 'Gitea';
      const response = await axios.get(this.gitConfig[provider]!.validateTokenUri, {
        params: data
      });
      return response.data;
    }
    return undefined;
  }

  private cleanUrl(url: string) {
    return url.split('#')[0]
    .replace(/&code=[a-z0-9]+/, '') // code is in the middle of the query
    .replace(/\?code=[a-z0-9]+&/, '?') // code is in the beginning of the query with multiple params
    .replace(/\?code=[a-z0-9]+/, ''); // code is at the only param in the query
  }

  private resetUrl() {
    window.history.replaceState(undefined, document.title, this.cleanUrl(window.location.pathname));
  }

  private parseQuery(queryString: string): { [key: string]: string } {
    return queryString.split('&')
      .reduce((initial, item) => {
        if (item) {
          const parts = item.split('=');
          // @ts-ignore
          initial[parts[0]] = decodeURIComponent(parts[1] || '');
        }
        return initial;
      }, {});
  }
}
