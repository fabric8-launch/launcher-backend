import { Button } from '@patternfly/react-core';
import * as React from 'react';
import { useAuthorizationManager } from '../contexts/authorization-context';
import { OpenshiftClusterLoader, OpenshiftClustersLoader } from '../loaders/openshiftcluster-loader';
import { ClusterPicker, ClusterPickerValue } from '../pickers/cluster-picker';
import { FormHub, SpecialValue, FormPanel, DescriptiveHeader, OverviewEmpty, OverviewComplete, ExternalLink } from '@launcher/component';

export interface DeploymentFormValue {
  clusterPickerValue?: ClusterPickerValue;
}

export const DeploymentHub: FormHub<DeploymentFormValue> = {
  id: 'openshift-deployment',
  title: 'OpenShift Deployment',
  checkCompletion: value => !!value.clusterPickerValue && ClusterPicker.checkCompletion(value.clusterPickerValue),
  Overview: props => {
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
