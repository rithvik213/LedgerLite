package com.ledgerlite.analytics.consumer;

import com.ledgerlite.analytics.dto.TransactionPostedEvent;
import com.ledgerlite.analytics.entity.MonthlySpending;
import com.ledgerlite.analytics.entity.MonthlySpendingId;
import com.ledgerlite.analytics.entity.ProcessedTransaction;
import com.ledgerlite.analytics.repository.MonthlySpendingRepository;
import com.ledgerlite.analytics.repository.ProcessedTransactionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.support.Acknowledgment;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;

@Component
public class TransactionEventConsumer {

    private static final Logger log = LoggerFactory.getLogger(TransactionEventConsumer.class);
    private static final DateTimeFormatter YEAR_MONTH_FMT = DateTimeFormatter.ofPattern("yyyy-MM");

    private final MonthlySpendingRepository spendingRepository;
    private final ProcessedTransactionRepository processedRepository;

    public TransactionEventConsumer(MonthlySpendingRepository spendingRepository,
                                    ProcessedTransactionRepository processedRepository) {
        this.spendingRepository = spendingRepository;
        this.processedRepository = processedRepository;
    }

    @KafkaListener(topics = "transactions.posted", groupId = "analytics-aggregator")
    @Transactional
    public void handleTransactionPosted(TransactionPostedEvent event, Acknowledgment ack) {
        // Idempotent consumer: skip if we've already processed this transaction
        if (processedRepository.existsById(event.transactionId())) {
            log.info("Already processed transaction {}, skipping", event.transactionId());
            ack.acknowledge();
            return;
        }

        String yearMonth = event.createdAt().atZone(ZoneOffset.UTC).format(YEAR_MONTH_FMT);
        String category = event.category() != null ? event.category() : "UNCATEGORIZED";

        MonthlySpendingId id = new MonthlySpendingId(
                event.userId(), event.accountId(), yearMonth, category);

        MonthlySpending spending = spendingRepository.findById(id).orElseGet(() -> {
            MonthlySpending ms = new MonthlySpending();
            ms.setUserId(event.userId());
            ms.setAccountId(event.accountId());
            ms.setYearMonth(yearMonth);
            ms.setCategory(category);
            return ms;
        });

        spending.setTotalAmount(spending.getTotalAmount().add(event.amount()));
        spending.setTransactionCount(spending.getTransactionCount() + 1);
        spendingRepository.save(spending);

        // Mark as processed for deduplication
        processedRepository.save(new ProcessedTransaction(event.transactionId()));

        log.info("Processed transaction {} — {}/{} {} total: {}",
                event.transactionId(), yearMonth, category,
                event.amount(), spending.getTotalAmount());

        // Manual ack: only ack after DB write succeeds
        ack.acknowledge();
    }
}
