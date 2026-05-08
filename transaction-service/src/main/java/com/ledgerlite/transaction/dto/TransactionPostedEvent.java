package com.ledgerlite.transaction.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

// reversesTransactionId is null for regular transactions, non-null for reversals.
// Analytics-service consumers see a negated amount and the category flows through normally —
// the monthly aggregate math self-corrects without any consumer-side changes.
public record TransactionPostedEvent(
        UUID transactionId,
        UUID accountId,
        UUID userId,
        BigDecimal amount,
        String category,
        Instant createdAt,
        UUID reversesTransactionId
) {}
