package com.ledgerlite.transaction.controller;

import com.ledgerlite.transaction.dto.CreateTransactionRequest;
import com.ledgerlite.transaction.dto.ReverseTransactionRequest;
import com.ledgerlite.transaction.dto.TransactionResponse;
import com.ledgerlite.transaction.entity.Transaction;
import com.ledgerlite.transaction.repository.TransactionRepository;
import com.ledgerlite.transaction.service.TransactionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
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

        // Standardized FAILED detection — same predicate the reverse endpoint uses.
        HttpStatus status = response.status() == com.ledgerlite.transaction.entity.TransactionStatus.FAILED
                ? HttpStatus.UNPROCESSABLE_ENTITY
                : HttpStatus.CREATED;
        return ResponseEntity.status(status).body(response);
    }

    @Operation(
        summary = "Reverse a posted transaction",
        description = "Append-only ledger semantics: the original row is never mutated. " +
            "A new transaction with negated amount is created and references the original via " +
            "reversesTransactionId. Idempotency-Key replays always return 200, including when " +
            "the stored reversal landed FAILED — clients should treat any 200 as 'already seen' " +
            "rather than retrying, to avoid an infinite-retry trap on poisoned keys."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "201", description = "Reversal created and POSTED"),
        @ApiResponse(responseCode = "200", description = "Idempotent replay — body is the previously stored reversal row regardless of its terminal status"),
        @ApiResponse(responseCode = "403", description = "Original transaction belongs to a different user"),
        @ApiResponse(responseCode = "404", description = "Original transaction not found"),
        @ApiResponse(responseCode = "409", description = "Already reversed, or Idempotency-Key was used for a different operation"),
        @ApiResponse(responseCode = "422", description = "Original is not POSTED, or attempt to reverse a reversal"),
        @ApiResponse(responseCode = "503", description = "Account-service unreachable on a fresh request")
    })
    @PostMapping("/{id}/reverse")
    public ResponseEntity<TransactionResponse> reverse(
            @AuthenticationPrincipal String userId,
            @PathVariable UUID id,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            @Valid @RequestBody(required = false) ReverseTransactionRequest request) {

        if (idempotencyKey == null || idempotencyKey.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Idempotency-Key header is required");
        }

        // Idempotent replay: scoped by userId, and only honored if the existing row is a
        // reversal of this same original. The service layer enforces the cross-endpoint
        // collision guard for any other case (existing row that isn't a reversal of `id`).
        var existing = transactionRepository.findByIdempotencyKeyAndUserId(idempotencyKey, UUID.fromString(userId));
        if (existing.isPresent() && id.equals(existing.get().getReversesTransactionId())) {
            // Replay always returns 200 regardless of the stored row's terminal status —
            // a stored FAILED row replayed as 503 would create an infinite-retry trap on
            // poisoned keys. Clients should treat any 200 as "we already saw this".
            return ResponseEntity.ok(TransactionResponse.from(existing.get()));
        }

        TransactionResponse response = transactionService.reverseTransaction(
                UUID.fromString(userId), idempotencyKey, id, request);

        // A reversal persisted as FAILED means account-service was unreachable — surface as 503
        // on a *fresh* request so the client knows to retry. Replays already returned 200 above.
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
