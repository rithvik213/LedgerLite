package com.ledgerlite.transaction.repository;

import com.ledgerlite.transaction.entity.Transaction;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TransactionRepository extends JpaRepository<Transaction, UUID> {
    // User-scoped lookup prevents cross-tenant disclosure: if user B replays user A's
    // Idempotency-Key, an unscoped query would return A's row. Always scope by userId.
    Optional<Transaction> findByIdempotencyKeyAndUserId(String idempotencyKey, UUID userId);
    List<Transaction> findByAccountIdAndUserId(UUID accountId, UUID userId);
    Optional<Transaction> findByIdAndUserId(UUID id, UUID userId);
    // Pre-flight "already reversed" check, scoped by userId so the invariant
    // (reversal.userId == original.userId) is explicit at the query layer rather than implicit.
    // The partial unique index uq_one_reversal_per_tx remains the definitive concurrency guard.
    Optional<Transaction> findByReversesTransactionIdAndUserId(UUID reversesTransactionId, UUID userId);
}
