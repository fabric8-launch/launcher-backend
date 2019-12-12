export interface KeycloakConfig {
  clientId: string;
  realm: string;
  url: string;
  gitProvider: 'gitea' | 'github';
}

export interface OpenshiftConfig {
  loadGitProvider: () => Promise<GitProviderConfig>,
  openshift: {
    clientId: string;
    url?: string;
    validateTokenUri: string;
    responseType?: string;
  };
}

export interface GitProviderConfig {
  gitProvider: 'gitea' | 'github';
  gitea?: {
    clientId: string;
    url: string;
    redirectUri: string;
    validateTokenUri: string;
  };
  github?: {
    clientId: string;
    validateTokenUri: string;
  };
}

export interface Authorizations {
  [headerName: string]: string;
}

export interface User {
  authorizationsByProvider: { [provider: string]: Authorizations | undefined };
  accountLink: { [provider: string]: string; };
  userName: string;
  userPreferredName: string;
  sessionState: string;
}

export type OptionalUser = User | undefined;
