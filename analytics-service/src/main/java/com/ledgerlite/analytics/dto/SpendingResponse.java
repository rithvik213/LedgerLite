package com.ledgerlite.analytics.dto;

import com.ledgerlite.analytics.entity.MonthlySpending;
import java.math.BigDecimal;
import java.util.UUID;

public record SpendingResponse(
        UUID userId,
        UUID accountId,
        String yearMonth,
        String category,
        BigDecimal totalAmount,
        int transactionCount
) {
    public static SpendingResponse from(MonthlySpending ms) {
        return new SpendingResponse(
                ms.getUserId(), ms.getAccountId(), ms.getYearMonth(),
                ms.getCategory(), ms.getTotalAmount(), ms.getTransactionCount()
        );
    }
}
