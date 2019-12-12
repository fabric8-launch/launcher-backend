package io.fabric8.launcher.web.endpoints;

import java.util.Collection;
import java.util.List;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;

import javax.enterprise.context.RequestScoped;
import javax.enterprise.inject.Instance;
import javax.inject.Inject;
import javax.validation.constraints.NotNull;
import javax.ws.rs.GET;
import javax.ws.rs.HEAD;
import javax.ws.rs.Path;
import javax.ws.rs.PathParam;
import javax.ws.rs.Produces;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.SecurityContext;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.spotify.futures.CompletableFutures;
import io.fabric8.kubernetes.client.KubernetesClientException;
import io.fabric8.launcher.base.identity.Identity;
import io.fabric8.launcher.base.identity.TokenIdentity;
import io.fabric8.launcher.core.api.security.Secured;
import io.fabric8.launcher.core.spi.IdentityProvider;
import io.fabric8.launcher.service.openshift.api.ImmutableParameters;
import io.fabric8.launcher.service.openshift.api.OpenShiftCluster;
import io.fabric8.launcher.service.openshift.api.OpenShiftClusterRegistry;
import io.fabric8.launcher.service.openshift.api.OpenShiftService;
import io.fabric8.launcher.service.openshift.api.OpenShiftServiceFactory;
import io.fabric8.launcher.service.openshift.api.OpenShiftUser;

import static java.util.stream.Collectors.toList;

/**
 * @author <a href="mailto:ggastald@redhat.com">George Gastaldi</a>
 */
@Path("/services/openshift")
@RequestScoped
public class OpenShiftEndpoint {

    @Inject
    OpenShiftServiceFactory openShiftServiceFactory;

    @Inject
    OpenShiftClusterRegistry clusterRegistry;

    @Inject
    Instance<IdentityProvider> identityProviderInstance;

    @Inject
    Instance<OpenShiftService> openShiftService;

    @Inject
    Instance<TokenIdentity> authorizationInstance;

    @Context
    SecurityContext securityContext;

    @GET
    @Path("/clusters")
    @Produces(MediaType.APPLICATION_JSON)
    public Collection<ClusterVerified> getSupportedOpenShiftClusters() throws ExecutionException, InterruptedException {
        final Identity authorization;
        final IdentityProvider identityProvider;
        if (openShiftServiceFactory.getDefaultIdentity().isPresent()) {
            authorization = openShiftServiceFactory.getDefaultIdentity().get();
            identityProvider = IdentityProvider.NULL_PROVIDER;
        } else {
            authorization = authorizationInstance.get();
            identityProvider = identityProviderInstance.get();
        }
        List<CompletableFuture<ClusterVerified>> futures =
                clusterRegistry.getSubscribedClusters(securityContext.getUserPrincipal()).stream()
                        .map(cluster -> identityProvider.getIdentityAsync(authorization, cluster.getId())
                                .thenApply(
                                        identity -> identity.map(value -> getClusterVerified(cluster, value))
                                                .orElseGet(() -> new ClusterVerified(cluster, false))))
                        .collect(toList());
        return CompletableFutures.allAsList(futures).get();
    }

    private ClusterVerified getClusterVerified(OpenShiftCluster cluster, Identity identity) {
        final ImmutableParameters.Builder builder = ImmutableParameters.builder().cluster(cluster).identity(identity);
        final OpenShiftService service = openShiftServiceFactory.create(builder.build());
        try {
            service.getLoggedUser();
            return new ClusterVerified(cluster, true);
        } catch (KubernetesClientException e) {
            //means that we have an invalid token e.g. cluster got deprovisioned
            return new ClusterVerified(cluster, false);
        }
    }

    @GET
    @Path("/clusters/all")
    @Produces(MediaType.APPLICATION_JSON)
    public Set<OpenShiftCluster> getAllOpenShiftClusters() {
        // Return all clusters
        return clusterRegistry.getClusters();
    }


    @HEAD
    @Secured
    @Path("/projects/{project}")
    public Response openShiftProjectExists(@NotNull @PathParam("project") String project) {
        if (openShiftService.get().projectExists(project)) {
            return Response.ok().build();
        } else {
            return Response.status(Response.Status.NOT_FOUND).build();
        }
    }

    @GET
    @Secured
    @Path("/user")
    @Produces(MediaType.APPLICATION_JSON)
    public OpenShiftUser getUser() {
        return openShiftService.get().getLoggedUser();
    }

    /**
     * Used in OpenShiftEndpoint#getSupportedOpenShiftClusters
     */
    private static class ClusterVerified {

        @JsonProperty
        final boolean connected;

        @JsonProperty
        final OpenShiftCluster cluster;

        private ClusterVerified(OpenShiftCluster cluster, boolean connected) {
            this.cluster = cluster;
            this.connected = connected;
        }

    }

}