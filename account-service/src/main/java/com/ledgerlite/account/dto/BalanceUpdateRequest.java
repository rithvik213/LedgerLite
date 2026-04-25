package com.ledgerlite.account.dto;

import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

public record BalanceUpdateRequest(
        @NotNull BigDecimal delta,
        @NotNull Integer expectedVersion
) {}
