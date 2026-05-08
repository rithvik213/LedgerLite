package com.ledgerlite.transaction.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import java.util.Map;
import java.util.UUID;

/**
 * Feign client for account-service.
 *
 * URL is env-driven rather than Eureka-resolved so the service is portable
 * to any runtime (docker-compose, K8s, local dev) without a service registry.
 * In K8s, ACCOUNT_SERVICE_URL=http://account-service:8082 (the K8s Service DNS name).
 * In docker-compose, same value pointing at the compose service name.
 */
@FeignClient(name = "account-service", url = "${ledgerlite.account-service.url}")
public interface AccountServiceClient {

    @GetMapping("/api/accounts/{id}")
    Map<String, Object> getAccount(@PathVariable UUID id);

    @PatchMapping("/api/accounts/{id}/balance")
    Map<String, Object> updateBalance(@PathVariable UUID id, @RequestBody Map<String, Object> request);
}
