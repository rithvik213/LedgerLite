package com.ledgerlite.account.dto;

import com.ledgerlite.account.entity.AccountType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record CreateAccountRequest(
        @NotBlank String name,
        @NotNull AccountType type,
        String currency
) {}
