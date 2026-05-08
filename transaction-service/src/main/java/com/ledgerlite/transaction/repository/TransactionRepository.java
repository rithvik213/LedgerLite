package com.ledgerlite.transaction.repository;

import com.ledgerlite.transaction.entity.Transaction;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TransactionRepository extends JpaRepository<Transaction, UUID> {
    Optional<Transaction> findByIdempotencyKey(String idempotencyKey);
    // User-scoped lookup prevents cross-tenant disclosure: if user B replays user A's
    // Idempotency-Key, the unscoped query would return A's row. Always scope by userId.
    Optional<Transaction> findByIdempotencyKeyAndUserId(String idempotencyKey, UUID userId);
    List<Transaction> findByAccountIdAndUserId(UUID accountId, UUID userId);
    Optional<Transaction> findByIdAndUserId(UUID id, UUID userId);
    // Used to detect "already reversed" before attempting the insert — avoids relying solely on
    // the constraint violation to surface 409 (though the index remains the definitive guard
    // against concurrent reversals).
    Optional<Transaction> findByReversesTransactionId(UUID reversesTransactionId);
}
