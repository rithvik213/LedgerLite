package com.ledgerlite.transaction.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record TransactionPostedEvent(
        UUID transactionId,
        UUID accountId,
        UUID userId,
        BigDecimal amount,
        String category,
        Instant createdAt
) {}
