export interface LauncherClientConfig {
  launcherURL: string;
  creatorUrl: string;
}

export interface AppDescriptor {
  application: string;
  parts: Array<{
    subFolderName?: string;
    category?: string;
    shared: {
      mission?: { id: string; version: string };
      runtime: { name: string; version: string; };
      nodejs?: { name: string; version: string; };
      maven?: { groupId: string; artifactId: string; version: string; };
    };
    capabilities?: Array<{ module: string; }>;
  }>;

}

export class ExampleAppDescriptor {
  public projectName?: string;
  public clusterId?: string;
  public gitRepository?: string;
  public gitOrganization?: string;
  public projectVersion: string;
  public targetEnvironment: string;
  public mission: string;
  public runtime: string;
  public runtimeVersion: string;
  public groupId: string;
  public artifactId: string;

  constructor(payload: LaunchAppPayload | DownloadAppPayload) {
    this.groupId = 'com.yourcompany.newapp';
    this.artifactId = payload.project.application;
    this.projectVersion = '1.0.0';
    this.targetEnvironment = 'os';
    const part = payload.project.parts[0];
    this.mission = part.shared.mission!.id;
    this.runtime = part.shared.runtime.name;
    this.runtimeVersion = part.shared.runtime.version;
    if ((payload as LaunchAppPayload).projectName) {
      const launchPayload = payload as LaunchAppPayload;
      this.projectName = launchPayload.projectName;
      this.clusterId = launchPayload.clusterId;
      this.gitRepository = launchPayload.gitRepository;
      this.gitOrganization = launchPayload.gitOrganization;
    } else {
      this.projectName = payload.project.application;
    }
  }

  public static toExampleAppDescriptor(payload: LaunchAppPayload | DownloadAppPayload): string {
    const obj = new ExampleAppDescriptor(payload);
    const str: string[] = [];
    for (const p in obj) {
      if (obj.hasOwnProperty(p) && obj[p]) {
        str.push(`${encodeURIComponent(p)}=${encodeURIComponent(obj[p])}`);
      }
    }
    return str.join('&');
  }
}

interface GitRepository {
  gitOrganization?: string;
  gitRepository?: string;
}

interface OpenShiftClusterProject {
  clusterId?: string;
  clusterUrl?: string;
  clusterToken?: string;
  projectName: string;
}

interface ProjectDescriptor {
  project: AppDescriptor;
}

export type DownloadAppPayload = ProjectDescriptor;
export type LaunchAppPayload = ProjectDescriptor & GitRepository & OpenShiftClusterProject;

export interface StatusListener {
  onMessage(message: StatusMessage);

  onError(error: any);

  onComplete();
}

export interface StatusMessage {
  statusMessage: string;
  data?: {
    routes?: { [x: string]: string | undefined }
    location?: string;
    error?: string;
  };
}

export interface PropertyValue {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  metadata?: any;
}

export interface OpenShiftCluster {
  connected: boolean;
  id: string;
  name: string;
  type: string;
  consoleUrl?: string;
  oauthUrl?: string;
}

export interface GitInfo {
  avatarUrl: string;
  login: string;
  organizations: string[];
  repositories: string[];
}

export interface FieldProperty {
  id: string;
  name: string;
  description: string;
  type: string;
  required: boolean;
  default?: string;
  props?: FieldProperty[];
  values?: string[];
  valuesWithEnums?: PropertyValue[];
  shared?: boolean;
  enabledWhen?: {
    propId: string;
    equals: string[];
  };
}

export interface Capability {
  module: string;
  name: string;
  description: string;
  props: FieldProperty[];
  metadata: {
    category: string;
    icon: string;
  };
}

export interface Catalog {
  missions: ExampleMission[];
  runtimes: ExampleRuntime[];
  boosters: Example[];
}

export interface ExampleVersion {
  id: string;
  name: string;
  metadata?: any;
}

export interface ExampleRuntime {
  id: string;
  name: string;
  description?: string;
  metadata?: any;
  icon: string;
  versions: any;
}

export interface ExampleMission {
  id: string;
  name: string;
  description?: string;
  metadata?: any;
  runtime?: ExampleRuntime[];
}

export interface Example {
  name: string;
  description?: string;
  metadata?: any;
  mission: ExampleMission | string;
  runtime: ExampleRuntime | string;
  version: ExampleVersion | string;
  source?: any;
}

export type AnyExample = Example | ExampleMission | ExampleRuntime;

export function toRuntime(arg: string) {
  const parts = arg.split('/', 2);
  return { name: parts[0], version: parts.length > 1 ? parts[1] : undefined };
}

export interface GitRepositoryExistsPayload {
  repositoryName: string;
  gitProvider?: string;
}

export enum GitProviderType {
  BITBUCKET = 'BITBUCKET',
  GITEA = 'GITEA',
  GITHUB = 'GITHUB',
  GITLAB = 'GITLAB'
}

export interface GitProvider {
  id: string;
  name: string;
  apiUrl: string;
  repositoryUrl: string;
  type: GitProviderType;
  clientProperties?: any;
}

export interface ExistsResult {
  exists: boolean;
}

export interface LaunchAppResult {
  id: string;
  events: Array<{ name: string, message: string }>;
}

export interface BuilderImage {
  id: string;
  name: string;
  metadata?: {
    language?: string,
    isBuilder?: boolean,
    suggestedEnv?: { [key: string]: string };
  };
}

export interface AnalyzeResult {
  image: string;
  builderImages: BuilderImage[];
}

export interface Enums {
  [id: string]: PropertyValue[];
}

export interface DownloadAppResult {
  downloadLink: string;
}

export interface Authorizations {
  [headerName: string]: string;
}

export type AuthorizationsProvider = (provider: string) => Promise<Authorizations | undefined>;

export class AuthorizationError extends Error {
  constructor(m: string, public readonly originalError?: any) {
    super(m);

    // Set the prototype explicitly.
    Object.setPrototypeOf(this, AuthorizationError.prototype);
  }
}
