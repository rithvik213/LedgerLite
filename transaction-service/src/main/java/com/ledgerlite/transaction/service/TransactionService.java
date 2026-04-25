package com.ledgerlite.transaction.service;

import com.ledgerlite.transaction.client.AccountServiceClient;
import com.ledgerlite.transaction.dto.CreateTransactionRequest;
import com.ledgerlite.transaction.dto.TransactionPostedEvent;
import com.ledgerlite.transaction.dto.TransactionResponse;
import com.ledgerlite.transaction.entity.Transaction;
import com.ledgerlite.transaction.entity.TransactionStatus;
import com.ledgerlite.transaction.repository.TransactionRepository;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import io.github.resilience4j.retry.annotation.Retry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.Map;
import java.util.UUID;

@Service
public class TransactionService {

    private static final Logger log = LoggerFactory.getLogger(TransactionService.class);
    private static final String TOPIC = "transactions.posted";

    private final TransactionRepository transactionRepository;
    private final AccountServiceClient accountServiceClient;
    private final KafkaTemplate<String, TransactionPostedEvent> kafkaTemplate;

    public TransactionService(TransactionRepository transactionRepository,
                              AccountServiceClient accountServiceClient,
                              KafkaTemplate<String, TransactionPostedEvent> kafkaTemplate) {
        this.transactionRepository = transactionRepository;
        this.accountServiceClient = accountServiceClient;
        this.kafkaTemplate = kafkaTemplate;
    }

    public TransactionResponse createTransaction(UUID userId, String idempotencyKey,
                                                  CreateTransactionRequest request) {
        // Idempotency check: if this key was already used, return the original response
        var existing = transactionRepository.findByIdempotencyKey(idempotencyKey);
        if (existing.isPresent()) {
            return TransactionResponse.from(existing.get());
        }

        // Create the transaction in PENDING state
        Transaction tx = new Transaction();
        tx.setAccountId(request.accountId());
        tx.setUserId(userId);
        tx.setAmount(request.amount());
        tx.setCategory(request.category());
        tx.setDescription(request.description());
        tx.setIdempotencyKey(idempotencyKey);
        tx.setStatus(TransactionStatus.PENDING);
        tx = transactionRepository.save(tx);

        // Call account-service to update the balance
        try {
            updateAccountBalance(tx.getAccountId(), tx.getAmount());
            tx.setStatus(TransactionStatus.POSTED);
            tx = transactionRepository.save(tx);

            // Publish event to Kafka
            // NOTE: This is a dual-write — we write to the DB then publish to Kafka.
            // If the app crashes between the DB write and the Kafka publish, the event is lost.
            // The proper fix is the Transactional Outbox pattern: write the event to an
            // "outbox" table in the same DB transaction, then have a separate process
            // (e.g., Debezium CDC) relay events from the outbox to Kafka.
            // At this scale, the dual-write risk is acceptable.
            publishEvent(tx);

        } catch (Exception e) {
            log.error("Failed to update account balance for transaction {}: {}", tx.getId(), e.getMessage());
            tx.setStatus(TransactionStatus.FAILED);
            tx.setFailureReason(e.getMessage());
            tx = transactionRepository.save(tx);
        }

        return TransactionResponse.from(tx);
    }

    @CircuitBreaker(name = "account-service", fallbackMethod = "updateBalanceFallback")
    @Retry(name = "account-service")
    private void updateAccountBalance(UUID accountId, BigDecimal amount) {
        // First get the account to read its current version
        Map<String, Object> account = accountServiceClient.getAccount(accountId);
        Integer version = (Integer) account.get("version");

        // Update balance with optimistic locking
        Map<String, Object> balanceUpdate = Map.of(
                "delta", amount,
                "expectedVersion", version
        );
        accountServiceClient.updateBalance(accountId, balanceUpdate);
    }

    private void updateBalanceFallback(UUID accountId, BigDecimal amount, Throwable t) {
        throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                "Account service is unavailable: " + t.getMessage());
    }

    private void publishEvent(Transaction tx) {
        var event = new TransactionPostedEvent(
                tx.getId(), tx.getAccountId(), tx.getUserId(),
                tx.getAmount(), tx.getCategory(), tx.getCreatedAt()
        );
        kafkaTemplate.send(TOPIC, tx.getAccountId().toString(), event);
        log.info("Published TransactionPostedEvent for transaction {}", tx.getId());
    }
}
