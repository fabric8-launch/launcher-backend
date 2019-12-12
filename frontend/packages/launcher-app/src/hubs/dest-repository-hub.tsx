import * as React from 'react';

import { UserRepositoryPicker, UserRepositoryPickerValue, valueToPath } from '../pickers/user-repository-picker';
import { GitInfoLoader } from '../loaders/git-info-loader';
import { Button } from '@patternfly/react-core';
import { useAuthorizationManager } from '../contexts/authorization-context';
import { ButtonLink, FormPanel, DescriptiveHeader, OverviewEmpty, optionalBool, FormHub, OverviewComplete, SpecialValue } from '@launcher/component';
import { useAuthenticationApi } from '../auth/authentication-api-factory';

export interface DestRepositoryFormValue {
  userRepositoryPickerValue?: UserRepositoryPickerValue;
  isProviderAuthorized?: boolean;
}

export const DestRepositoryHub: FormHub<DestRepositoryFormValue> = {
  id: 'dest-repository',
  title: 'Destination Repository',
  checkCompletion: value => !!value.isProviderAuthorized
    && !!value.userRepositoryPickerValue && UserRepositoryPicker.checkCompletion(value.userRepositoryPickerValue),
  Overview: props => {
    const auth = useAuthorizationManager();
    const authApi = useAuthenticationApi();
    if (!optionalBool(props.value.isProviderAuthorized, true)) {
      return (
        <OverviewEmpty
          id={`${DestRepositoryHub.id}-unauthorized`}
          title="You need to authorize Git."
          action={(authApi.user === undefined ?
            <Button variant="primary" onClick={authApi.login}>Login</Button> :
            <ButtonLink href={auth.generateAuthorizationLink()}>Authorize</ButtonLink>)}
        >
          Once authorized, you will be able to choose a repository provider and a location...
        </OverviewEmpty>
      );
    }
    if (!DestRepositoryHub.checkCompletion(props.value)) {
      return (
        <OverviewEmpty
          id={DestRepositoryHub.id}
          title="You need to configure the destination repository"
          action={<Button variant="primary" onClick={props.onClick}>Select Destination Repository</Button>}
        >
          You are going to configure the repository where your application code will be located
        </OverviewEmpty>
      );
    }
    return (
      <OverviewComplete id={DestRepositoryHub.id} title={`Destination Repository is configured`}>
        <SpecialValue>{valueToPath(props.value.userRepositoryPickerValue!)}</SpecialValue> is configured
        as destination repository on Git.
      </OverviewComplete>
    );
  },
  Form: props => {
    return (
      <FormPanel
        id={DestRepositoryHub.id}
        initialValue={props.initialValue}
        validator={DestRepositoryHub.checkCompletion}
        onSave={props.onSave}
        onCancel={props.onCancel}
      >
        {
          (inputProps) => (
            <React.Fragment>
              <DescriptiveHeader
                description="You can select where your application source code will be located."
              />
              <GitInfoLoader>
                {(gitInfo) => (
                  <UserRepositoryPicker.Element
                    gitInfo={gitInfo}
                    value={inputProps.value.userRepositoryPickerValue || {}}
                    onChange={(userRepositoryPickerValue) => inputProps.onChange({ ...inputProps.value, userRepositoryPickerValue })}
                  />
                )}
              </GitInfoLoader>
            </React.Fragment>
          )}
      </FormPanel>
    );
  }
};
