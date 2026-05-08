package com.ledgerlite.transaction.service;

import com.ledgerlite.transaction.dto.CreateTransactionRequest;
import com.ledgerlite.transaction.dto.ReverseTransactionRequest;
import com.ledgerlite.transaction.dto.TransactionPostedEvent;
import com.ledgerlite.transaction.dto.TransactionResponse;
import com.ledgerlite.transaction.entity.Transaction;
import com.ledgerlite.transaction.entity.TransactionStatus;
import com.ledgerlite.transaction.repository.TransactionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.UUID;

@Service
public class TransactionService {

    private static final Logger log = LoggerFactory.getLogger(TransactionService.class);
    private static final String TOPIC = "transactions.posted";

    private final TransactionRepository transactionRepository;
    private final AccountBalanceUpdater accountBalanceUpdater;
    private final KafkaTemplate<String, TransactionPostedEvent> kafkaTemplate;

    public TransactionService(TransactionRepository transactionRepository,
                              AccountBalanceUpdater accountBalanceUpdater,
                              KafkaTemplate<String, TransactionPostedEvent> kafkaTemplate) {
        this.transactionRepository = transactionRepository;
        this.accountBalanceUpdater = accountBalanceUpdater;
        this.kafkaTemplate = kafkaTemplate;
    }

    public TransactionResponse createTransaction(UUID userId, String idempotencyKey,
                                                  CreateTransactionRequest request) {
        // Idempotency check, scoped by userId so a replay from a different user cannot read this row.
        var existing = transactionRepository.findByIdempotencyKeyAndUserId(idempotencyKey, userId);
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
            accountBalanceUpdater.updateAccountBalance(tx.getAccountId(), tx.getAmount());
            tx.setStatus(TransactionStatus.POSTED);
            tx = transactionRepository.save(tx);

            // NOTE: This is a dual-write — we write to the DB then publish to Kafka.
            // If the app crashes between the DB write and the Kafka publish, the event is lost.
            // The proper fix is the Transactional Outbox pattern: write the event to an
            // "outbox" table in the same DB transaction, then have a separate process
            // (e.g., Debezium CDC) relay events from the outbox to Kafka.
            // At this scale, the dual-write risk is acceptable.
            publishEvent(tx);

        } catch (Exception e) {
            log.error("Failed to update account balance for transaction {}", tx.getId(), e);
            tx.setStatus(TransactionStatus.FAILED);
            // Normalized message: avoid echoing internal exception details to API consumers.
            tx.setFailureReason("account balance update failed");
            tx = transactionRepository.save(tx);
        }

        return TransactionResponse.from(tx);
    }

    /**
     * Creates a reversal row for an existing POSTED transaction.
     *
     * Immutability contract: the original row is never modified. The reversal is a new
     * transaction with a negated amount that references the original via reversesTransactionId.
     * The partial unique index (uq_one_reversal_per_tx) enforces at-most-one-reversal at the
     * DB layer, making concurrent reversal races safe.
     */
    // @Transactional binds the PENDING insert and the terminal-status save into one unit of
    // work. If the JVM crashes between the PENDING save and the account-service call, the
    // transaction never commits and we don't leak an orphan PENDING row that would hold
    // uq_one_reversal_per_tx forever. The catch block swallows the exception and saves FAILED,
    // so a normal failure still commits the FAILED row for observability.
    @Transactional
    public TransactionResponse reverseTransaction(UUID requestingUserId, String idempotencyKey,
                                                   UUID originalId, ReverseTransactionRequest request) {
        // Idempotency: scoped by userId to prevent cross-tenant disclosure on replayed keys.
        var existingByKey = transactionRepository.findByIdempotencyKeyAndUserId(idempotencyKey, requestingUserId);
        if (existingByKey.isPresent()) {
            // Cross-endpoint collision guard: a key previously used on POST /api/transactions
            // would otherwise be replayed here and the create row returned as if it were a
            // reversal. Only honor the replay when it actually points at this same original.
            Transaction existing = existingByKey.get();
            if (!originalId.equals(existing.getReversesTransactionId())) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "Idempotency-Key was previously used for a different operation");
            }
            return TransactionResponse.from(existing);
        }

        Transaction original = transactionRepository.findById(originalId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Transaction not found: " + originalId));

        // Authorization: prevent user A from reversing user B's transaction.
        if (!original.getUserId().equals(requestingUserId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Transaction does not belong to the authenticated user");
        }

        // Only POSTED transactions are reversible. PENDING/FAILED have not settled — leave them
        // to their own state machine rather than creating a dangling reversal.
        if (original.getStatus() != TransactionStatus.POSTED) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                    "Only POSTED transactions can be reversed; current status: " + original.getStatus());
        }

        // Reversal-of-a-reversal would inflate analytics counts and create confusing chains.
        // To undo a reversal, post a new transaction; don't reverse the reversal itself.
        if (original.getReversesTransactionId() != null) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                    "Reversal rows cannot themselves be reversed");
        }

        // Pre-flight check for "already reversed". The unique index is the definitive guard
        // (handles races), but checking here gives a friendlier error path for the common case.
        transactionRepository.findByReversesTransactionIdAndUserId(originalId, requestingUserId).ifPresent(existing -> {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "already_reversed: transaction " + originalId + " has already been reversed");
        });

        String description = "Reversal of " + originalId
                + (request != null && request.reason() != null && !request.reason().isBlank()
                   ? ": " + request.reason()
                   : "");

        Transaction reversal = new Transaction();
        reversal.setAccountId(original.getAccountId());
        reversal.setUserId(original.getUserId());
        reversal.setAmount(original.getAmount().negate());
        reversal.setCategory(original.getCategory());
        reversal.setDescription(description);
        reversal.setIdempotencyKey(idempotencyKey);
        reversal.setReversesTransactionId(originalId);
        reversal.setStatus(TransactionStatus.PENDING);

        reversal = transactionRepository.save(reversal);

        try {
            // Apply the inverse delta. The existing @CircuitBreaker + @Retry on updateAccountBalance
            // covers transient failures and optimistic-lock conflicts on the account side.
            accountBalanceUpdater.updateAccountBalance(reversal.getAccountId(), reversal.getAmount());
            reversal.setStatus(TransactionStatus.POSTED);
            reversal = transactionRepository.save(reversal);

            // Same dual-write caveat as createTransaction — see note above.
            publishEvent(reversal);

        } catch (Exception e) {
            log.error("Failed to apply reversal balance update for reversal {}", reversal.getId(), e);
            reversal.setStatus(TransactionStatus.FAILED);
            reversal.setFailureReason("account balance update failed");
            reversal = transactionRepository.save(reversal);
        }

        return TransactionResponse.from(reversal);
    }

    private void publishEvent(Transaction tx) {
        var event = new TransactionPostedEvent(
                tx.getId(), tx.getAccountId(), tx.getUserId(),
                tx.getAmount(), tx.getCategory(), tx.getCreatedAt(),
                tx.getReversesTransactionId()
        );
        kafkaTemplate.send(TOPIC, tx.getAccountId().toString(), event);
        log.info("Published TransactionPostedEvent for transaction {}", tx.getId());
    }
}
