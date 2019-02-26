package io.fabric8.launcher.service.git.gitea.api;

import io.fabric8.launcher.base.EnvironmentEnum;

/**
 * @author <a href="mailto:ggastald@redhat.com">George Gastaldi</a>
 * @deprecated use the {@link io.fabric8.launcher.service.git.spi.GitProviderConfig} feature instead
 */
@Deprecated
public enum GiteaEnvironment implements EnvironmentEnum {
    LAUNCHER_BACKEND_GITEA_URL,
    LAUNCHER_BACKEND_GITEA_USERNAME,
    LAUNCHER_BACKEND_GITEA_TOKEN
}
