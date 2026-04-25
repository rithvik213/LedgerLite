package com.ledgerlite.account.dto;

import com.ledgerlite.account.entity.Account;
import com.ledgerlite.account.entity.AccountType;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record AccountResponse(
        UUID id,
        UUID userId,
        String name,
        AccountType type,
        BigDecimal balance,
        String currency,
        Integer version,
        Instant createdAt,
        Instant updatedAt
) {
    public static AccountResponse from(Account account) {
        return new AccountResponse(
                account.getId(),
                account.getUserId(),
                account.getName(),
                account.getType(),
                account.getBalance(),
                account.getCurrency(),
                account.getVersion(),
                account.getCreatedAt(),
                account.getUpdatedAt()
        );
    }
}
