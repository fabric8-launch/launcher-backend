import { filter } from '../helpers/launchers';
import { Locations } from '../helpers/locations';
import { HttpService, RequestConfig } from '../http.service';
import { defaultAuthorizationsProvider, LauncherClient } from '../launcher.client';
import { AnalyzeResult, AnyExample, AuthorizationError, Authorizations, AuthorizationsProvider, Capability, Catalog, DownloadAppPayload, DownloadAppResult, Enums, ExampleAppDescriptor, ExistsResult, GitInfo, GitProvider, GitRepositoryExistsPayload, LaunchAppPayload, LaunchAppResult, LauncherClientConfig, OpenShiftCluster, PropertyValue, StatusListener, StatusMessage } from '../types';

interface RequestConfigOptions {
  gitProvider?: string;
  executionIndex?: number;
  clusterId?: string;
  clusterUrl?: string;
  clusterToken?: string;
  authorizations?: Authorizations;
}

export default class DefaultLauncherClient implements LauncherClient {

  public authorizationsProvider: AuthorizationsProvider;

  constructor(private readonly httpService: HttpService, private readonly config: LauncherClientConfig) {
    this.authorizationsProvider = defaultAuthorizationsProvider;
  }

  public async exampleCatalog(): Promise<Catalog> {
    return await this.httpService.get<Catalog>(this.config.launcherURL, '/booster-catalog');
  }

  public async findExampleApps(query: AnyExample):
    Promise<AnyExample[]> {
    return filter(query, await this.exampleCatalog());
  }

  public async capabilities(): Promise<Capability[]> {
    const requestConfig = await this.getRequestConfig();
    return await this.httpService.get<Capability[]>(this.config.creatorUrl, '/capabilities', requestConfig);
  }

  public async enum(id: string): Promise<PropertyValue[]> {
    const enums = await this.httpService.get<PropertyValue[]>(this.config.creatorUrl, '/enums');
    return enums[id] || [];
  }

  public async enums(): Promise<Enums> {
    return await this.httpService.get<Enums>(this.config.creatorUrl, '/enums');
  }

  public async importAnalyze(gitImportUrl: string): Promise<AnalyzeResult> {
    const endpoint = `/import/analyze?gitImportUrl=${encodeURIComponent(gitImportUrl)}`;
    return await this.httpService.get<AnalyzeResult>(this.config.creatorUrl, endpoint);
  }

  public async download(payload: DownloadAppPayload): Promise<DownloadAppResult> {
    const requestConfig = await this.getRequestConfig();
    if (payload.project.parts.length === 1 && payload.project.parts[0].shared.mission) {
      return ({
        downloadLink: Locations.joinPath(this.config.launcherURL, '/launcher/zip?') +
          ExampleAppDescriptor.toExampleAppDescriptor(payload),
      });
    } else {
      const r = await this.httpService.post<DownloadAppPayload, { id: string }>(
        this.config.creatorUrl, '/zip',
        payload,
        requestConfig
      );
      return ({
        downloadLink: `${this.config.creatorUrl}/download?id=${r.id}`
      });
    }
  }

  public async gitProviders(): Promise<GitProvider[]> {
    return this.httpService.get<GitProvider[]>(this.config.launcherURL, '/services/git/providers');
  }

  public async launch(payload: LaunchAppPayload): Promise<LaunchAppResult> {
    let endpoint = this.config.creatorUrl;
    let p: any = payload;

    if (payload.project.parts.length === 1 && payload.project.parts[0].shared.mission) {
      endpoint = Locations.joinPath(this.config.launcherURL, '/launcher');
      p = ExampleAppDescriptor.toExampleAppDescriptor(payload);
    }

    const authorizations = {
      ...(payload.gitRepository ? await this.requireGitAuthorizations() : {}),
      ...(await this.requireOpenShiftAuthorizations())
    };
    const requestConfig = await this.getRequestConfig({
      clusterId: payload.clusterId,
      clusterUrl: payload.clusterUrl,
      clusterToken: payload.clusterToken,
      authorizations
    });
    delete payload.clusterToken;
    delete payload.clusterUrl;
    const r = await this.httpService.post<any, { uuid_link: string, events: [] }>(
      endpoint, '/launch', p, requestConfig
    );
    return {
      id: r.uuid_link,
      events: r.events
    };
  }

  public follow(id: string, events: Array<{ name: string }>, listener: StatusListener) {
    const socket = new WebSocket(Locations.createWebsocketUrl(this.config.launcherURL) + id);
    socket.onmessage = (msg) => {
      const message = JSON.parse(msg.data) as StatusMessage;
      if (message.data && message.data.error) {
        listener.onError(new Error(message.data.error));
        socket.close();
      } else {
        listener.onMessage(message);
        if (message.statusMessage === events[events.length - 1].name) {
          listener.onComplete();
          socket.close();
        }
      }
    };
    socket.onerror = listener.onError;
    socket.onclose = listener.onComplete;
  }

  public async gitRepositoryExists(payload: GitRepositoryExistsPayload): Promise<ExistsResult> {
    const authorizations = await this.requireGitAuthorizations();
    const requestConfig = await this.getRequestConfig({ authorizations });
    return await this.httpService.head<ExistsResult>(this.config.launcherURL,
      `/services/git/repositories/${payload.repositoryName}`, requestConfig);
  }

  public async gitInfo(): Promise<GitInfo> {
    const authorizations = await this.requireGitAuthorizations();
    const requestConfig = await this.getRequestConfig({ authorizations });
    try {
      return await this.httpService.get<GitInfo>(this.config.launcherURL, '/services/git/user', requestConfig);
    } catch (e) {
      if (e.response) {
        if (e.response.status === 404) {
          throw new AuthorizationError('Server returned not found when loading gitInfo', e);
        }
        if (e.response.status === 401) {
          throw new AuthorizationError('Server returned authorized when loading gitInfo', e);
        }
      }
      throw e;
    }
  }
  public async ocClusters(): Promise<OpenShiftCluster[]> {
    const requestConfig = await this.getRequestConfig();
    try {
      const r = await this.httpService.get<any>(this.config.launcherURL, '/services/openshift/clusters', requestConfig);
      return r.map(c => ({
        ...c.cluster, connected: c.connected
      }));
    } catch (e) {
      if (e.response) {
        if (e.response.status === 404) {
          throw new AuthorizationError('Server returned not found when loading ocClusters', e);
        }
        if (e.response.status === 401) {
          throw new AuthorizationError('Server returned authorized when loading ocClusters', e);
        }
      }
      throw e;
    }
  }

  public async ocExistsProject(projectName: string): Promise<ExistsResult> {
    const authorizations = await this.requireOpenShiftAuthorizations();
    const requestConfig = await this.getRequestConfig({ authorizations });
    try {
      return await this.httpService.head<ExistsResult>(this.config.launcherURL,
        `/services/openshift/projects/${projectName}`,
        requestConfig
      );
    } catch (e) {
      if (e.response && e.response.status === 404) {
        return Promise.resolve({ exists: false } as ExistsResult);
      } else {
        throw e;
      }
    }
  }

  private async requireGitAuthorizations() {
    const auth = await this.authorizationsProvider('git');
    if (!auth) {
      throw new AuthorizationError('Git Authorization is required to perform this request');
    }
    return auth;
  }

  private async requireOpenShiftAuthorizations() {
    const auth = await this.authorizationsProvider('openshift');
    if (!auth) {
      throw new AuthorizationError('OpenShift Authorization is required to perform this request');
    }
    return auth;
  }

  private async getRequestConfig(config: RequestConfigOptions = {})
    : Promise<RequestConfig> {
    const headers = {
      ...config.authorizations
    };
    if (config.gitProvider) {
      headers['X-Git-Provider'] = config.gitProvider;
    }
    if (config.executionIndex) {
      headers['X-Execution-Step-Index'] = config.executionIndex;
    }
    if (config.clusterId) {
      headers['X-OpenShift-Cluster'] = config.clusterId;
    }
    if (config.clusterUrl) {
      headers['X-OpenShift-Cluster-URL'] = config.clusterUrl;
    }
    if (config.clusterToken) {
      headers['X-OpenShift-Authorization'] = 'Bearer ' + config.clusterToken;
    }
    return { headers };
  }

}
