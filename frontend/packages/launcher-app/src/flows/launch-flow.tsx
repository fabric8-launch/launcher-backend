import React, { useEffect, useState, ReactNode } from 'react';
import { Button, Toolbar, ToolbarGroup } from '@patternfly/react-core';

import { useLauncherClient } from '../contexts/launcher-client-context';
import { DownloadIcon, ErrorCircleOIcon, PlaneDepartureIcon } from '@patternfly/react-icons';
import style from './launch-flow.module.scss';
import { ExampleApp, NewApp } from './types';
import { gitInfoLoader } from '../loaders/git-info-loader';
import { ProcessingApp } from '../next-steps/processing-app';
import { DownloadNextSteps } from '../next-steps/download-next-steps';
import { LaunchNextSteps } from '../next-steps/launch-next-steps';
import { effectSafety, useAnalytics, HubNSpoke } from '@launcher/component';
import { StatusMessage, DownloadAppPayload, LaunchAppPayload } from '../client/types';

enum Status {
  EDITION = 'EDITION', RUNNING = 'RUNNING', COMPLETED = 'COMPLETED', ERROR = 'ERROR', DOWNLOADED = 'DOWNLOADED'
}

export const NAME_REGEX = /^[a-zA-Z](?!.*--)(?!.*__)[a-zA-Z0-9-_]{2,38}[a-zA-Z0-9]$/;

export function useAutoSetDestRepository(defaultName: string, setApp) {
  const client = useLauncherClient();
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const safety = effectSafety();
    gitInfoLoader(client).then(gitInfo => {
      if (gitInfo.login) {
        safety.callSafely(() => {
          setApp((prev: ExampleApp | NewApp) => {
            if (prev.destRepository.userRepositoryPickerValue && prev.destRepository.userRepositoryPickerValue.name) {
              return prev;
            }
            return {...prev, destRepository: {userRepositoryPickerValue: {name: defaultName}, isProviderAuthorized: true}};
          });
          setShowForm(true);
          setLoading(false);
        });
      } else {
        safety.callSafely(() => {
          setApp((prev: ExampleApp | NewApp) => {
            setShowForm(false);
            return {...prev, destRepository: {isProviderAuthorized: false}};
          });
          setLoading(false);
        });
      }
    });
    return safety.unload;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return {showForm, loading};
}

export function useAutoSetCluster(setApp) {
  const client = useLauncherClient();
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const safety = effectSafety();
    client.ocClusters().then(clusters => {
      const connectedClusters = clusters.filter(cluster => cluster.connected);
      if (connectedClusters.length === 1) {
        safety.callSafely(() => {
          setApp((prev: ExampleApp | NewApp) => {
            if (prev.deployment.clusterPickerValue && prev.deployment.clusterPickerValue.clusterId) {
              return prev;
            }
            const selectCluster = connectedClusters[0];
            return ({...prev, deployment: {clusterPickerValue: {clusterId: selectCluster.id, clusterType: selectCluster.type}}});
          });
          setShowForm(clusters.length > 1);
          setLoading(false);
        });
      } else {
        safety.callSafely(() => {
          setShowForm(true);
          setLoading(false);
        });
      }
    }).catch(e => {
      console.warn('An error happened while trying to load clusters for auto-selection', e);
      setLoading(false);
    });
    return safety.unload;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return {showForm, loading};
}

interface RunState {
  status: Status;
  result?: any;
  error?: any;
  statusMessages: StatusMessage[];
}

interface LaunchFlowProps {
  id: string;
  title: string | ReactNode;
  items: any[];
  hint?: string;
  isReadyForLaunch: boolean;
  isReadyForDownload: boolean;
  buildDownloadAppPayload: () => DownloadAppPayload;
  buildLaunchAppPayload: () => LaunchAppPayload;
  onCancel?: () => void;
  canDownload?: boolean;
}

export function LaunchFlow(props: LaunchFlowProps) {
  const [run, setRun] = useState<RunState>({status: Status.EDITION, statusMessages: []});
  const client = useLauncherClient();
  const analytics = useAnalytics();

  useEffect(() => analytics.event('Flow', 'Open', props.id), [analytics, props.id]);

  const canDownload = props.canDownload === undefined || props.canDownload;
  const onCancel = props.onCancel || (() => {
  });
  const launch = () => {
    if (!props.isReadyForLaunch) {
      throw new Error('Launch must not be called when app is not ready!');
    }

    setRun({status: Status.RUNNING, statusMessages: []});

    client.launch(props.buildLaunchAppPayload()).then((result) => {
      setRun((prev) => ({...prev, result}));
      client.follow(result.id, result.events, {
        onMessage: (statusMessages) => {
          setRun((prev) => ({...prev, statusMessages: [...prev.statusMessages, statusMessages]}));
        },
        onComplete: () => {
          setRun((prev) => ({...prev, status: Status.COMPLETED}));
        },
        onError: (error) => {
          setRun((prev) => ({...prev, status: Status.ERROR, error}));
        }
      });
    }).catch(error => {
      setRun((prev) => ({...prev, status: Status.ERROR, error}));
    });
  };

  const download = () => {
    if (!props.isReadyForDownload) {
      throw new Error('Download must not be called when app is not ready!');
    }

    setRun({status: Status.RUNNING, statusMessages: []});

    client.download(props.buildDownloadAppPayload()).then((result) => {
      setRun((prev) => ({...prev, result, status: Status.DOWNLOADED}));
    }).catch(error => {
      setRun((prev) => ({...prev, status: Status.ERROR, error}));
    });
  };

  const toolbar = (
    <Toolbar className={style.toolbar}>
      <ToolbarGroup className={style.toolbarGroup}>
        <Button
          variant="primary"
          onClick={launch}
          className={style.toolbarButton}
          isDisabled={!props.isReadyForLaunch}
          aria-label="Launch Application"
        >
          <PlaneDepartureIcon className={style.buttonIcon}/>Launch
        </Button>
        {canDownload && (
          <Button
            variant="primary"
            onClick={download}
            className={style.toolbarButton}
            isDisabled={!props.isReadyForDownload}
            aria-label="Download Application"
          >
            <DownloadIcon className={style.buttonIcon}/>Download
          </Button>
        )}
        <Button
          variant="secondary"
          onClick={props.onCancel}
          className={style.toolbarButton}
          aria-label="Cancel"
        >
          <ErrorCircleOIcon className={style.buttonIcon}/>Cancel
        </Button>
      </ToolbarGroup>

    </Toolbar>
  );

  const progressEvents = run.status === Status.RUNNING && run.result && run.result.events;
  const progressEventsResults = run.status === Status.RUNNING && run.result && run.statusMessages;

  const links = run.statusMessages.filter(m => m.data).map(m => {
    if (m.data!.routes) {
      return m.data!.routes;
    }
    return {[m.statusMessage]: m.data!.location};
  })!.reduce(
    (map, obj) => {
      for (const key of Object.keys(obj)) {
        map[key] = obj[key];
      }
      return map;
    }, {}
  );

  const goBackToEdition = () => setRun({status: Status.EDITION, statusMessages: []});

  return (
    <React.Fragment>
      <HubNSpoke title={props.title} items={props.items} toolbar={toolbar} error={run.error} hint={props.hint}/>
      {run.status === Status.RUNNING && (
        <ProcessingApp progressEvents={progressEvents} progressEventsResults={progressEventsResults}/>)}
      {!run.error && run.status === Status.COMPLETED && (<LaunchNextSteps links={links} onClose={onCancel}/>)}
      {!run.error && run.status === Status.DOWNLOADED
      && (<DownloadNextSteps onClose={goBackToEdition} downloadLink={run.result.downloadLink}/>)}
    </React.Fragment>
  );
}
