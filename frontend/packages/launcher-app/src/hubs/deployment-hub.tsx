import { Button } from '@patternfly/react-core';
import * as React from 'react';
import { useAuthorizationManager } from '../contexts/authorization-context';
import { OpenshiftClusterLoader, OpenshiftClustersLoader } from '../loaders/openshiftcluster-loader';
import { ClusterPicker, ClusterPickerValue } from '../pickers/cluster-picker';
import { FormHub, SpecialValue, FormPanel, DescriptiveHeader, OverviewEmpty, OverviewComplete, ExternalLink } from '@launcher/component';
import { useAuthenticationApi } from '../auth/auth-context';

export interface DeploymentFormValue {
  clusterPickerValue?: ClusterPickerValue;
}

export const DeploymentHub: FormHub<DeploymentFormValue> = {
  id: 'openshift-deployment',
  title: 'OpenShift Deployment',
  checkCompletion: value => !!value.clusterPickerValue && ClusterPicker.checkCompletion(value.clusterPickerValue),
  Overview: props => {
    const authApi = useAuthenticationApi();
    if (!authApi.user && authApi.enabled) {
      return (
        <OverviewEmpty
        id={DeploymentHub.id}
        title="You need to login for OpenShift deployment"
        action={<Button variant="primary" onClick={authApi.login}>Login</Button>}
      >
        When you are logged in we can deploy this application on your cluster.
      </OverviewEmpty>
      );
    }
    if (!DeploymentHub.checkCompletion(props.value)) {
      return (
        <OverviewEmpty
          id={DeploymentHub.id}
          title="You need to configure the OpenShift deployment"
          action={<Button variant="primary" onClick={props.onClick}>Configure OpenShift Deployment</Button>}
        >
          You are going to choose where your application will be built, deployed and served.
        </OverviewEmpty>
      );
    }
    if (props.value.clusterPickerValue!.clusterUrl !== undefined) {
      return (
        <OverviewComplete id={DeploymentHub.id} title="OpenShift Deployment is configured">
          You application will be deployed to a
          <ExternalLink style={{ padding: '6px' }} href={props.value.clusterPickerValue!.clusterUrl}>
            <SpecialValue>Custom</SpecialValue>
          </ExternalLink> OpenShift cluster.
        </OverviewComplete>
      );
    } else {
      return (
        <OpenshiftClusterLoader clusterId={props.value.clusterPickerValue!.clusterId!}>
          {result => (
            <OverviewComplete id={DeploymentHub.id} title="OpenShift Deployment is configured">
              You application will be deployed to the
              {result!.consoleUrl && <ExternalLink style={{padding: '6px'}} href={result!.consoleUrl}>
                <SpecialValue>{result!.name}</SpecialValue>
              </ExternalLink>} OpenShift cluster.
              {!result!.consoleUrl && <SpecialValue>{result!.name}</SpecialValue>}
            </OverviewComplete>
          )}
        </OpenshiftClusterLoader>
      );
    }
  },
  Form: props => {
    const auth = useAuthorizationManager();
    return (
      <FormPanel
        id={DeploymentHub.id}
        initialValue={props.initialValue}
        validator={DeploymentHub.checkCompletion}
        onSave={props.onSave}
        onCancel={props.onCancel}
      >
        {
          (inputProps) => (
            <React.Fragment>
              <DescriptiveHeader
                description="Choose an OpenShift cluster to build,
               deploy and serve your application automatically on each push to your repository’s master branch."
              />
              <OpenshiftClustersLoader>
                {(clusters) => (
                  <ClusterPicker.Element
                    clusters={clusters}
                    value={inputProps.value.clusterPickerValue || {}}
                    onChange={(clusterPickerValue) => inputProps.onChange({...inputProps.value, clusterPickerValue})}
                    authorizationLinkGenerator={(clusterId) => auth.generateAuthorizationLink(clusterId)}
                  />
                )}
              </OpenshiftClustersLoader>
            </React.Fragment>
          )}
      </FormPanel>
    );
  }
};
