package com.ledgerlite.transaction.dto;

import com.ledgerlite.transaction.entity.Transaction;
import com.ledgerlite.transaction.entity.TransactionStatus;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record TransactionResponse(
        UUID id,
        UUID accountId,
        UUID userId,
        BigDecimal amount,
        String category,
        String description,
        String idempotencyKey,
        TransactionStatus status,
        String failureReason,
        Instant createdAt
) {
    public static TransactionResponse from(Transaction tx) {
        return new TransactionResponse(
                tx.getId(), tx.getAccountId(), tx.getUserId(),
                tx.getAmount(), tx.getCategory(), tx.getDescription(),
                tx.getIdempotencyKey(), tx.getStatus(), tx.getFailureReason(),
                tx.getCreatedAt()
        );
    }
}
