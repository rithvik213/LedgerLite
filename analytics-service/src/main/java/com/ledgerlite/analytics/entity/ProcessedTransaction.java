package com.ledgerlite.analytics.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "processed_transactions")
public class ProcessedTransaction {

    @Id
    @Column(name = "transaction_id")
    private UUID transactionId;

    @Column(name = "processed_at", nullable = false)
    private Instant processedAt = Instant.now();

    public ProcessedTransaction() {}

    public ProcessedTransaction(UUID transactionId) {
        this.transactionId = transactionId;
    }

    public UUID getTransactionId() { return transactionId; }
    public Instant getProcessedAt() { return processedAt; }
}
