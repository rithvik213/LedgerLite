package com.ledgerlite.transaction.dto;

import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.util.UUID;

public record CreateTransactionRequest(
        @NotNull UUID accountId,
        @NotNull BigDecimal amount,
        String category,
        String description
) {}
