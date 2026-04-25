package com.ledgerlite.analytics.entity;

import java.io.Serializable;
import java.util.Objects;
import java.util.UUID;

public class MonthlySpendingId implements Serializable {
    private UUID userId;
    private UUID accountId;
    private String yearMonth;
    private String category;

    public MonthlySpendingId() {}

    public MonthlySpendingId(UUID userId, UUID accountId, String yearMonth, String category) {
        this.userId = userId;
        this.accountId = accountId;
        this.yearMonth = yearMonth;
        this.category = category;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof MonthlySpendingId that)) return false;
        return Objects.equals(userId, that.userId) &&
                Objects.equals(accountId, that.accountId) &&
                Objects.equals(yearMonth, that.yearMonth) &&
                Objects.equals(category, that.category);
    }

    @Override
    public int hashCode() {
        return Objects.hash(userId, accountId, yearMonth, category);
    }
}
