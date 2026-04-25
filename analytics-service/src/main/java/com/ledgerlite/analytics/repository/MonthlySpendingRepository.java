package com.ledgerlite.analytics.repository;

import com.ledgerlite.analytics.entity.MonthlySpending;
import com.ledgerlite.analytics.entity.MonthlySpendingId;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface MonthlySpendingRepository extends JpaRepository<MonthlySpending, MonthlySpendingId> {
    List<MonthlySpending> findByUserIdAndAccountIdAndYearMonth(UUID userId, UUID accountId, String yearMonth);
    List<MonthlySpending> findByUserIdAndYearMonth(UUID userId, String yearMonth);
}
