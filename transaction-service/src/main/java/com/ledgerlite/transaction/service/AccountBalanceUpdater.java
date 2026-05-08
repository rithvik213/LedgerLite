package com.ledgerlite.transaction.service;

import com.ledgerlite.transaction.client.AccountServiceClient;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import io.github.resilience4j.retry.annotation.Retry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.Map;
import java.util.UUID;

/**
 * Resilience4j's @CircuitBreaker and @Retry are AOP-driven and only fire when invoked through
 * the Spring proxy — i.e. via a different bean. Keeping this method as a private helper on
 * TransactionService would silently disable both annotations because self-invocation bypasses
 * the proxy. Extracting to a separate @Component is the standard fix.
 */
@Component
public class AccountBalanceUpdater {

    private static final Logger log = LoggerFactory.getLogger(AccountBalanceUpdater.class);

    private final AccountServiceClient accountServiceClient;

    public AccountBalanceUpdater(AccountServiceClient accountServiceClient) {
        this.accountServiceClient = accountServiceClient;
    }

    @CircuitBreaker(name = "account-service", fallbackMethod = "updateBalanceFallback")
    @Retry(name = "account-service")
    public void updateAccountBalance(UUID accountId, BigDecimal amount) {
        Map<String, Object> account = accountServiceClient.getAccount(accountId);
        Integer version = (Integer) account.get("version");

        Map<String, Object> balanceUpdate = Map.of(
                "delta", amount,
                "expectedVersion", version
        );
        accountServiceClient.updateBalance(accountId, balanceUpdate);
    }

    @SuppressWarnings("unused")
    private void updateBalanceFallback(UUID accountId, BigDecimal amount, Throwable t) {
        log.warn("account-service circuit/retry fallback invoked for account {}", accountId, t);
        throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                "Account service is unavailable");
    }
}
