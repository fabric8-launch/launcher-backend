package io.fabric8.launcher.service.keycloak.impl;

import java.io.IOException;
import java.util.Optional;
import java.util.logging.Level;
import java.util.logging.Logger;

import javax.enterprise.context.ApplicationScoped;
import javax.inject.Inject;
import javax.ws.rs.core.HttpHeaders;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.fabric8.launcher.base.EnvironmentSupport;
import io.fabric8.launcher.base.identity.Identity;
import io.fabric8.launcher.base.identity.IdentityFactory;
import io.fabric8.launcher.service.keycloak.api.KeycloakService;
import okhttp3.Call;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;

/**
 * The implementation of the {@link KeycloakService}
 *
 * @author <a href="mailto:ggastald@redhat.com">George Gastaldi</a>
 */
@ApplicationScoped
public class KeycloakServiceImpl implements KeycloakService {

    public static final String LAUNCHPAD_MISSIONCONTROL_KEYCLOAK_URL = "LAUNCHPAD_KEYCLOAK_URL";

    public static final String LAUNCHPAD_MISSIONCONTROL_KEYCLOAK_REALM = "LAUNCHPAD_KEYCLOAK_REALM";

    @Inject
    public KeycloakServiceImpl() {
        this(EnvironmentSupport.INSTANCE.getEnvVarOrSysProp(LAUNCHPAD_MISSIONCONTROL_KEYCLOAK_URL),
             EnvironmentSupport.INSTANCE.getEnvVarOrSysProp(LAUNCHPAD_MISSIONCONTROL_KEYCLOAK_REALM));
    }

    public KeycloakServiceImpl(String keyCloakURL, String realm) {
        this.keyCloakURL = keyCloakURL;
        this.realm = realm;
        this.gitHubURL = buildURL(keyCloakURL, realm, "github");
        this.openShiftURL = buildURL(keyCloakURL, realm, "openshift-v3");

        httpClient = new OkHttpClient.Builder().build();
    }

    private static final Logger logger = Logger.getLogger(KeycloakServiceImpl.class.getName());

    private static final String TOKEN_URL_TEMPLATE = "%s/realms/%s/broker/%s/token";

    private final String keyCloakURL;

    private final String realm;

    private final String gitHubURL;

    private final String openShiftURL;

    private final OkHttpClient httpClient;

    private Identity getOpenShiftIdentity(String keycloakAccessToken) {
        return IdentityFactory.createFromToken(getToken(openShiftURL, keycloakAccessToken));
    }

    /**
     * GET https://sso.openshift.io/auth/realms/launchpad/broker/openshift-v3/token
     * Authorization: Bearer <keycloakAccessToken>
     *
     * @param authorization the keycloak access token
     * @param cluster name of the cluster e.g. openshift-v3
     * @return Identity with the openshift token
     */
    @Override
    public Identity getOpenShiftIdentity(String authorization, String cluster) {
        Identity openShiftIdentity;
        if (IdentityFactory.useDefaultIdentities()) {
            openShiftIdentity = IdentityFactory.getDefaultOpenShiftIdentity();
        } else {
            if (cluster == null) {
                openShiftIdentity = getOpenShiftIdentity(authorization);
            } else {
                Optional<Identity> identityOptional = getIdentity(cluster, authorization);
                if (!identityOptional.isPresent()) throw new IllegalArgumentException("openshift identity not present");
                openShiftIdentity = identityOptional.get();
            }
        }
        return openShiftIdentity;
    }

    /**
     * GET https://sso.openshift.io/auth/realms/launchpad/broker/github/token
     * Authorization: Bearer <keycloakAccessToken>
     *
     * @param keycloakAccessToken the keycloak access token
     * @return Identity with the github token
     */
    @Override
    public Identity getGitHubIdentity(String keycloakAccessToken) throws IllegalArgumentException {
        Identity identity;
        if (IdentityFactory.useDefaultIdentities()) {
            identity = IdentityFactory.getDefaultGithubIdentity();
        } else {
            identity = createFromToken(keycloakAccessToken);
        }
        return identity;
    }

    private Identity createFromToken(String keycloakAccessToken) throws IllegalArgumentException {
        return IdentityFactory.createFromToken(getToken(gitHubURL, keycloakAccessToken));
    }

    @Override
    public Optional<Identity> getIdentity(String provider, String token) {
        assertRequired(keyCloakURL, "keyCloakURL");
        assertRequired(realm, "realm");
        String url = buildURL(keyCloakURL, realm, provider);
        Identity identity = null;
        try {
            String providerToken = getToken(url, token);
            identity = IdentityFactory.createFromToken(providerToken);
        } catch (Exception e) {
            logger.log(Level.FINE, "Error while grabbing token from provider " + provider, e);
        }
        return Optional.ofNullable(identity);

    }

    static String buildURL(String host, String realm, String provider) {
        return String.format(TOKEN_URL_TEMPLATE, host, realm, provider);
    }

    private static void assertRequired(String param, String error) {
        if (param == null || param.trim().isEmpty()) {
            throw new IllegalStateException(String.format("Keycloak %s is null", error));
        }
    }

    private String getToken(String url, String token) {
        assertRequired(token, "access token");
        Request request = new Request.Builder()
                .url(url)
                .header(HttpHeaders.AUTHORIZATION, token)
                .build();
        Call call = httpClient.newCall(request);
        try (Response response = call.execute()) {
            String content = response.body().string();
            // Keycloak does not respect the content-type
            if (content.startsWith("{")) {
                ObjectMapper mapper = new ObjectMapper();
                JsonNode node = mapper.readTree(content);
                if (response.isSuccessful()) {
                    return node.get("access_token").asText();
                } else if (response.code() == 400) {
                    throw new IllegalArgumentException(node.get("errorMessage").asText());
                } else {
                    throw new IllegalStateException(node.get("errorMessage").asText());
                }
            } else {
                //access_token=1bbf10a0009d865fcb2f60d40a0ca706c7ca1e48&scope=admin%3Arepo_hook%2Cgist%2Cread%3Aorg%2Crepo%2Cuser&token_type=bearer
                String tokenParam = "access_token=";
                int idxAccessToken = content.indexOf(tokenParam);
                if (idxAccessToken < 0) {
                    throw new IllegalStateException("Access Token not found");
                }
                return content.substring(idxAccessToken + tokenParam.length(), content.indexOf('&', idxAccessToken + tokenParam.length()));
            }
        } catch (IOException io) {
            throw new IllegalStateException("Error while fetching token from keycloak", io);
        }
    }
}
