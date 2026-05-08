package com.ledgerlite.analytics.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

// reversesTransactionId was added on the producer side for the reversal feature; analytics
// doesn't currently use it but must tolerate its presence on the wire. @JsonIgnoreProperties
// also future-proofs the consumer against further producer-side fields.
@JsonIgnoreProperties(ignoreUnknown = true)
public record TransactionPostedEvent(
        UUID transactionId,
        UUID accountId,
        UUID userId,
        BigDecimal amount,
        String category,
        Instant createdAt,
        UUID reversesTransactionId
) {}
