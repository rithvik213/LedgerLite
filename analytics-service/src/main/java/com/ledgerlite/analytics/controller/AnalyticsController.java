package com.ledgerlite.analytics.controller;

import com.ledgerlite.analytics.dto.SpendingResponse;
import com.ledgerlite.analytics.repository.MonthlySpendingRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/analytics")
public class AnalyticsController {

    private final MonthlySpendingRepository spendingRepository;

    public AnalyticsController(MonthlySpendingRepository spendingRepository) {
        this.spendingRepository = spendingRepository;
    }

    @GetMapping("/spending")
    public ResponseEntity<List<SpendingResponse>> getSpending(
            @AuthenticationPrincipal String userId,
            @RequestParam UUID accountId,
            @RequestParam String month) {
        var spending = spendingRepository
                .findByUserIdAndAccountIdAndYearMonth(UUID.fromString(userId), accountId, month)
                .stream()
                .map(SpendingResponse::from)
                .toList();
        return ResponseEntity.ok(spending);
    }

    @GetMapping("/spending/by-category")
    public ResponseEntity<List<SpendingResponse>> getSpendingByCategory(
            @AuthenticationPrincipal String userId,
            @RequestParam String month) {
        var spending = spendingRepository
                .findByUserIdAndYearMonth(UUID.fromString(userId), month)
                .stream()
                .map(SpendingResponse::from)
                .toList();
        return ResponseEntity.ok(spending);
    }
}
