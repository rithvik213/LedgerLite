package com.ledgerlite.transaction.controller;

import com.ledgerlite.transaction.dto.CreateTransactionRequest;
import com.ledgerlite.transaction.dto.ReverseTransactionRequest;
import com.ledgerlite.transaction.dto.TransactionResponse;
import com.ledgerlite.transaction.entity.Transaction;
import com.ledgerlite.transaction.repository.TransactionRepository;
import com.ledgerlite.transaction.service.TransactionService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/transactions")
public class TransactionController {

    private final TransactionService transactionService;
    private final TransactionRepository transactionRepository;

    public TransactionController(TransactionService transactionService,
                                 TransactionRepository transactionRepository) {
        this.transactionService = transactionService;
        this.transactionRepository = transactionRepository;
    }

    @PostMapping
    public ResponseEntity<TransactionResponse> create(
            @AuthenticationPrincipal String userId,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            @Valid @RequestBody CreateTransactionRequest request) {

        if (idempotencyKey == null || idempotencyKey.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Idempotency-Key header is required");
        }

        // Idempotency replay: scope by userId so user B replaying user A's key cannot read A's row.
        var existing = transactionRepository.findByIdempotencyKeyAndUserId(idempotencyKey, UUID.fromString(userId));
        if (existing.isPresent()) {
            return ResponseEntity.ok(TransactionResponse.from(existing.get()));
        }

        TransactionResponse response = transactionService.createTransaction(
                UUID.fromString(userId), idempotencyKey, request);

        HttpStatus status = response.failureReason() == null ? HttpStatus.CREATED : HttpStatus.UNPROCESSABLE_ENTITY;
        return ResponseEntity.status(status).body(response);
    }

    @PostMapping("/{id}/reverse")
    public ResponseEntity<TransactionResponse> reverse(
            @AuthenticationPrincipal String userId,
            @PathVariable UUID id,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            @Valid @RequestBody(required = false) ReverseTransactionRequest request) {

        if (idempotencyKey == null || idempotencyKey.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Idempotency-Key header is required");
        }

        // Note: idempotency replay handling for the reverse path lives in the service layer
        // because it must also assert the existing row is a reversal of this same original
        // (cross-endpoint collision guard). Don't short-circuit here.
        TransactionResponse response = transactionService.reverseTransaction(
                UUID.fromString(userId), idempotencyKey, id, request);

        // A reversal persisted as FAILED means account-service was unreachable — surface as 503.
        if (response.status() == com.ledgerlite.transaction.entity.TransactionStatus.FAILED) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(response);
        }

        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/{id}")
    public ResponseEntity<TransactionResponse> get(@AuthenticationPrincipal String userId,
                                                    @PathVariable UUID id) {
        Transaction tx = transactionRepository.findByIdAndUserId(id, UUID.fromString(userId))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Transaction not found"));
        return ResponseEntity.ok(TransactionResponse.from(tx));
    }

    @GetMapping
    public ResponseEntity<List<TransactionResponse>> list(
            @AuthenticationPrincipal String userId,
            @RequestParam UUID accountId) {
        List<TransactionResponse> txns = transactionRepository
                .findByAccountIdAndUserId(accountId, UUID.fromString(userId))
                .stream()
                .map(TransactionResponse::from)
                .toList();
        return ResponseEntity.ok(txns);
    }
}
