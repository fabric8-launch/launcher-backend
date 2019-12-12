import '@patternfly/react-core/dist/styles/base.css';
import React from 'react';
import { Redirect, Route, Switch } from 'react-router';
import { BrowserRouter } from 'react-router-dom';
import { AuthenticationApiContext, useAuthenticationApiStateProxy } from '../auth/auth-context';
import { newAuthApi } from '../auth/authentication-api-factory';
import { createRouterLink, getRequestedRoute, useRouter } from '../router/use-router';
import { authConfig, authMode, creatorApiUrl, launcherApiUrl, publicUrl } from './config';
import './launcher-app.scss';
import { Layout } from './layout';
import { LauncherMenu } from '../launcher/launcher';
import { CreateNewAppFlow } from '../flows/create-new-app-flow';
import { ImportExistingFlow } from '../flows/import-existing-flow';
import { DeployExampleAppFlow } from '../flows/deploy-example-app-flow';
import { DataLoader } from '@launcher/component';
import { LauncherDepsProvider } from '../contexts/launcher-client-provider';
import { LoginPage } from './login-page';


function Routes(props: {}) {
  const router = useRouter();
  const requestedRoute = getRequestedRoute(router);
  if(requestedRoute) {
    return <Redirect to={requestedRoute} />
  }

  const Menu = () => {
    return (
      <LauncherMenu
        createNewApp={createRouterLink(router, '/flow/new-app')}
        createExampleApp={createRouterLink(router, '/flow/deploy-example-app')}
        importExistingApp={createRouterLink(router, '/flow/import-existing-app')}
      />
    );
  };
  const WithCancel = (cancelProps: { children: (onCancel: () => void) => any }) => {
    const rootLink = createRouterLink(router, '/');
    return cancelProps.children(rootLink.onClick);
  };
  const CreateNewAppFlowRoute = () => (<WithCancel>{onCancel => <CreateNewAppFlow onCancel={onCancel} />}</WithCancel>);
  const ImportExistingFlowRoute = () => (<WithCancel>{onCancel => <ImportExistingFlow onCancel={onCancel} />}</WithCancel>);
  const DeployExampleAppFlowRoute = () => (<WithCancel>{onCancel => <DeployExampleAppFlow onCancel={onCancel} />}</WithCancel>);
  return (
    <Switch>
      <Route path="/" exact component={LoginPage} />
      <Route path="/home" exact component={Menu} />
      <Route path="/flow/new-app" exact component={CreateNewAppFlowRoute} />
      <Route path="/flow/import-existing-app" exact component={ImportExistingFlowRoute} />
      <Route path="/flow/deploy-example-app" exact component={DeployExampleAppFlowRoute} />
      <Redirect to="/" />
    </Switch>
  );
}

function HomePage(props: {}) {
  return (
    <BrowserRouter basename={publicUrl}>
      <Layout>
        <div className="launcher-container">
          <Routes />
        </div>
      </Layout>
    </BrowserRouter>
  );
}

const authApi = newAuthApi(authMode, authConfig);

export function LauncherApp() {
  const proxyAuthApi = useAuthenticationApiStateProxy(authApi);
  const authLoader = () => {
    return proxyAuthApi.init().catch(e => console.error(e));
  };
  return (
    <DataLoader loader={authLoader}>
      <AuthenticationApiContext.Provider value={proxyAuthApi}>
        <LauncherDepsProvider
          authorizationsManager={proxyAuthApi}
          creatorUrl={creatorApiUrl}
          launcherUrl={launcherApiUrl}
        >
          <HomePage />
        </LauncherDepsProvider>
      </AuthenticationApiContext.Provider>
    </DataLoader >
  );
}
