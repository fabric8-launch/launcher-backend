package io.fabric8.launcher.service.git.bitbucket;


import io.fabric8.launcher.base.http.HttpClient;
import io.fabric8.launcher.base.test.hoverfly.LauncherPerTestHoverflyRule;
import io.fabric8.launcher.service.git.AbstractGitServiceTest;
import io.fabric8.launcher.service.git.api.ImmutableGitOrganization;
import io.fabric8.launcher.service.git.bitbucket.api.BitbucketWebhookEvent;
import io.fabric8.launcher.service.git.spi.GitServiceSpi;
import io.specto.hoverfly.junit.rule.HoverflyRule;
import org.junit.ClassRule;
import org.junit.Rule;
import org.junit.rules.RuleChain;

import static io.fabric8.launcher.base.test.hoverfly.LauncherHoverflyEnvironment.createDefaultHoverflyEnvironment;
import static io.fabric8.launcher.base.test.hoverfly.LauncherHoverflyRuleConfigurer.createMultiTestHoverflyProxy;
import static io.fabric8.launcher.service.git.bitbucket.api.BitbucketEnvironment.LAUNCHER_MISSIONCONTROL_BITBUCKET_APPLICATION_PASSWORD;
import static io.fabric8.launcher.service.git.bitbucket.api.BitbucketEnvironment.LAUNCHER_MISSIONCONTROL_BITBUCKET_USERNAME;

public class BitbucketServiceTest extends AbstractGitServiceTest {

    private static final HoverflyRule HOVERFLY_RULE = createMultiTestHoverflyProxy("bitbucket.org");

    @ClassRule
    public static final RuleChain RULE_CHAIN = RuleChain// After recording on a real environment against a real service,
            // You should adapt the Hoverfly descriptors (.json) to make them work in simulation mode with the mock environment.
            .outerRule(createDefaultHoverflyEnvironment(HOVERFLY_RULE)
                               .andForSimulationOnly(LAUNCHER_MISSIONCONTROL_BITBUCKET_USERNAME.propertyKey(), "fabric8-launcher")
                               .andForSimulationOnly(LAUNCHER_MISSIONCONTROL_BITBUCKET_APPLICATION_PASSWORD.propertyKey(), "enfjaj2RE3R3JNF"))
            .around(HOVERFLY_RULE);

    @Rule
    public LauncherPerTestHoverflyRule hoverflyPerTestRule = new LauncherPerTestHoverflyRule(HOVERFLY_RULE);

    @Override
    protected BitbucketServiceFactory getGitServiceFactory() {
        return new BitbucketServiceFactory(HttpClient.create());
    }

    @Override
    protected GitServiceSpi getGitService() {
        return getGitServiceFactory().create();
    }

    @Override
    protected String[] getTestHookEvents() {
        return new String[]{BitbucketWebhookEvent.REPO_PUSH.id(), BitbucketWebhookEvent.PULL_REQUEST_CREATED.id()};
    }

    @Override
    protected String getTestLoggedUser() {
        return LAUNCHER_MISSIONCONTROL_BITBUCKET_USERNAME.value();
    }

    @Override
    protected ImmutableGitOrganization getTestOrganization() {
        return ImmutableGitOrganization.of("fabric8-launcher-it");
    }

    @Override
    protected String getRawFileUrl(String fullRepoName, String fileName) {
        return "https://bitbucket.org/" + fullRepoName + "/raw/master/" + fileName;
    }
}
