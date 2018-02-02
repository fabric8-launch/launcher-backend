package io.fabric8.launcher.web.endpoints.inputs;

import javax.ws.rs.FormParam;

/**
 * @author <a href="mailto:ggastald@redhat.com">George Gastaldi</a>
 */
public class LaunchProjectile extends ZipProjectile {

    @FormParam("targetEnvironment")
    private String targetEnvironment;

    @FormParam("pipelineId")
    private String pipelineId;

    @FormParam("spacePath")
    private String spacePath;

    @FormParam("gitOrganization")
    private String gitOrganization;

    @FormParam("gitRepository")
    private String gitRepository;

    public String getTargetEnvironment() {
        return targetEnvironment;
    }

    public String getPipelineId() {
        return pipelineId;
    }

    public String getSpacePath() {
        return spacePath;
    }

    public String getGitOrganization() {
        return gitOrganization;
    }

    public String getGitRepository() {
        return gitRepository;
    }
}
