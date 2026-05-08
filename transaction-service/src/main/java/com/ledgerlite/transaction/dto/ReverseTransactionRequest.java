package com.ledgerlite.transaction.dto;

import jakarta.validation.constraints.Size;

public record ReverseTransactionRequest(
        @Size(max = 255) String reason
) {}
