package com.ledgerlite.transaction.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import java.util.Map;
import java.util.UUID;

@FeignClient(name = "account-service")
public interface AccountServiceClient {

    @GetMapping("/api/accounts/{id}")
    Map<String, Object> getAccount(@PathVariable UUID id);

    @PatchMapping("/api/accounts/{id}/balance")
    Map<String, Object> updateBalance(@PathVariable UUID id, @RequestBody Map<String, Object> request);
}
