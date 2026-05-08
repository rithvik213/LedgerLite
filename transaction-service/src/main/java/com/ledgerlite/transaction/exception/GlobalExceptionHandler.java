package com.ledgerlite.transaction.exception;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

import java.util.stream.Collectors;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ResponseStatusException.class)
    public ProblemDetail handleResponseStatus(ResponseStatusException ex) {
        return ProblemDetail.forStatusAndDetail(ex.getStatusCode(), ex.getReason());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ProblemDetail handleValidation(MethodArgumentNotValidException ex) {
        String errors = ex.getBindingResult().getFieldErrors().stream()
                .map(fe -> fe.getField() + ": " + fe.getDefaultMessage())
                .collect(Collectors.joining(", "));
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, errors);
        problem.setTitle("Validation failed");
        return problem;
    }

    /**
     * Maps the unique-index constraint violation from the partial index uq_one_reversal_per_tx
     * to a 409 Conflict. This fires when two concurrent reversal requests for the same original
     * transaction race past the pre-flight check and both try to insert.
     *
     * Other DataIntegrityViolations (e.g. concurrent createTransaction inserts that race the
     * idempotency-key check) must NOT be flattened to 409 — that would mask the existing
     * idempotency contract on POST /api/transactions, which expects an idempotent 200 reply.
     * Rethrow anything we don't explicitly recognize so Spring's default 500 path handles it.
     */
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ProblemDetail handleDataIntegrity(DataIntegrityViolationException ex) {
        String message = ex.getMessage();
        if (message != null && message.contains("uq_one_reversal_per_tx")) {
            ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT,
                    "already_reversed: a reversal already exists for this transaction");
            problem.setTitle("Conflict");
            return problem;
        }
        // Unrecognized integrity violation: surface as 500 rather than masking as 409,
        // which would silently break the create endpoint's idempotent-replay contract.
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.INTERNAL_SERVER_ERROR,
                "A database integrity error occurred");
        problem.setTitle("Internal Server Error");
        return problem;
    }
}
