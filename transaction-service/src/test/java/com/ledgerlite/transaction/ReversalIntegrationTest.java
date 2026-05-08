package com.ledgerlite.transaction;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ledgerlite.transaction.entity.Transaction;
import com.ledgerlite.transaction.entity.TransactionStatus;
import com.ledgerlite.transaction.repository.TransactionRepository;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import javax.crypto.SecretKey;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Integration tests for POST /api/transactions/{id}/reverse.
 *
 * Requires Postgres and Kafka running via docker-compose.infra.yml.
 * Account-service is NOT running, so any reversal that reaches the balance-update step
 * will result in a FAILED reversal row. Tests that verify POSTED status should mock or
 * skip the account-service call — here we focus on auth, idempotency, and guard rails,
 * which are all resolved before the account-service call.
 *
 * Run with: ./mvnw test -Dspring.profiles.active=test
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {
                "spring.datasource.url=jdbc:postgresql://localhost:5432/transaction_db",
                "spring.datasource.username=ledgerlite",
                "spring.datasource.password=ledgerlite",
                "spring.kafka.bootstrap-servers=localhost:19092",
                "ledgerlite.jwt.secret=super-secret-dev-key-that-is-at-least-256-bits-long-for-hs256",
                "ledgerlite.jwt.ttl=3600000",
                "ledgerlite.jwt.issuer=ledgerlite",
                "eureka.client.enabled=false",
                "spring.cloud.config.enabled=false"
        })
@AutoConfigureMockMvc
class ReversalIntegrationTest {

    private static final String JWT_SECRET = "super-secret-dev-key-that-is-at-least-256-bits-long-for-hs256";
    private static final String JWT_ISSUER = "ledgerlite";

    private static final UUID USER_A = UUID.randomUUID();

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired TransactionRepository transactionRepository;

    private String tokenA;

    @BeforeEach
    void setUp() {
        transactionRepository.deleteAll();
        tokenA = buildJwt(USER_A);
    }

    // -------------------------------------------------------------------------
    // Test 1: Happy path — reversal row is created with negated amount
    // Account-service is down in this environment, so the reversal lands as FAILED,
    // but all row fields (reversesTransactionId, negated amount, category) are correct.
    // -------------------------------------------------------------------------
    @Test
    void shouldCreateReversalRowReferencingOriginal() throws Exception {
        Transaction original = seedPostedTransaction(USER_A, new BigDecimal("100.00"), "FOOD");

        String reversalKey = UUID.randomUUID().toString();
        mockMvc.perform(post("/api/transactions/" + original.getId() + "/reverse")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("Authorization", "Bearer " + tokenA)
                        .header("Idempotency-Key", reversalKey)
                        .content(objectMapper.writeValueAsString(Map.of("reason", "user-correction"))))
                .andExpect(jsonPath("$.reversesTransactionId").value(original.getId().toString()))
                .andExpect(jsonPath("$.category").value("FOOD"))
                .andExpect(jsonPath("$.idempotencyKey").value(reversalKey));

        // Verify the reversal row persisted with the right amount sign and back-reference
        var reversal = transactionRepository.findByIdempotencyKeyAndUserId(reversalKey, USER_A);
        assertThat(reversal).isPresent();
        assertThat(reversal.get().getAmount()).isEqualByComparingTo(new BigDecimal("-100.00"));
        assertThat(reversal.get().getReversesTransactionId()).isEqualTo(original.getId());
        assertThat(reversal.get().getDescription())
                .startsWith("Reversal")
                .contains("user-correction")
                .doesNotContain(original.getId().toString());
        // Original row must be unchanged
        var unchanged = transactionRepository.findById(original.getId()).orElseThrow();
        assertThat(unchanged.getStatus()).isEqualTo(TransactionStatus.POSTED);
    }

    // -------------------------------------------------------------------------
    // Test 2: Idempotency replay — same Idempotency-Key returns same row, 200
    // -------------------------------------------------------------------------
    @Test
    void shouldReplayIdempotentReversal() throws Exception {
        Transaction original = seedPostedTransaction(USER_A, new BigDecimal("50.00"), "TRANSPORT");
        String reversalKey = UUID.randomUUID().toString();

        // First call
        mockMvc.perform(post("/api/transactions/" + original.getId() + "/reverse")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("Authorization", "Bearer " + tokenA)
                        .header("Idempotency-Key", reversalKey)
                        .content("{}"))
                .andReturn();

        String firstReversalId = transactionRepository.findByIdempotencyKeyAndUserId(reversalKey, USER_A)
                .orElseThrow().getId().toString();

        // Second call — same key
        mockMvc.perform(post("/api/transactions/" + original.getId() + "/reverse")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("Authorization", "Bearer " + tokenA)
                        .header("Idempotency-Key", reversalKey)
                        .content("{}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(firstReversalId));

        // Exactly one reversal row should exist (no duplicates from replay)
        assertThat(transactionRepository.findByReversesTransactionIdAndUserId(original.getId(), USER_A)).isPresent();
        assertThat(transactionRepository.findByIdempotencyKeyAndUserId(reversalKey, USER_A).get().getId())
                .isEqualTo(UUID.fromString(firstReversalId));
        // One original + one reversal = 2 rows total
        assertThat(transactionRepository.count()).isEqualTo(2);
    }

    // -------------------------------------------------------------------------
    // Test 3: Already reversed with a different key — 409
    // -------------------------------------------------------------------------
    @Test
    void shouldReturn409WhenAlreadyReversed() throws Exception {
        Transaction original = seedPostedTransaction(USER_A, new BigDecimal("75.00"), "DINING");

        // First reversal
        mockMvc.perform(post("/api/transactions/" + original.getId() + "/reverse")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("Authorization", "Bearer " + tokenA)
                        .header("Idempotency-Key", UUID.randomUUID().toString())
                        .content("{}"))
                .andReturn();

        // Second reversal with a DIFFERENT key — must 409
        mockMvc.perform(post("/api/transactions/" + original.getId() + "/reverse")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("Authorization", "Bearer " + tokenA)
                        .header("Idempotency-Key", UUID.randomUUID().toString())
                        .content("{}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value(
                        org.hamcrest.Matchers.containsString("already_reversed")));
    }

    // -------------------------------------------------------------------------
    // Test 4: Cross-user — user B cannot reverse user A's transaction — 404
    // (Returns 404 rather than 403 to avoid leaking transaction-id existence
    // across users; the lookup is user-scoped so the row is indistinguishable
    // from non-existent.)
    // -------------------------------------------------------------------------
    @Test
    void shouldReturn404WhenReversalBelongsToDifferentUser() throws Exception {
        Transaction original = seedPostedTransaction(USER_A, new BigDecimal("200.00"), "UTILITIES");

        String userBToken = buildJwt(UUID.randomUUID()); // a completely different user

        mockMvc.perform(post("/api/transactions/" + original.getId() + "/reverse")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("Authorization", "Bearer " + userBToken)
                        .header("Idempotency-Key", UUID.randomUUID().toString())
                        .content("{}"))
                .andExpect(status().isNotFound());

        // No reversal row should have been created
        assertThat(transactionRepository.count()).isEqualTo(1);
    }

    // -------------------------------------------------------------------------
    // Test 5: Wrong status — only POSTED transactions are reversible — 422
    // -------------------------------------------------------------------------
    @Test
    void shouldReturn422WhenOriginalIsNotPosted() throws Exception {
        Transaction failed = new Transaction();
        failed.setAccountId(UUID.randomUUID());
        failed.setUserId(USER_A);
        failed.setAmount(new BigDecimal("30.00"));
        failed.setCategory("GROCERIES");
        failed.setIdempotencyKey(UUID.randomUUID().toString());
        failed.setStatus(TransactionStatus.FAILED);
        failed = transactionRepository.save(failed);

        mockMvc.perform(post("/api/transactions/" + failed.getId() + "/reverse")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("Authorization", "Bearer " + tokenA)
                        .header("Idempotency-Key", UUID.randomUUID().toString())
                        .content("{}"))
                .andExpect(status().isUnprocessableEntity());
    }

    // -------------------------------------------------------------------------
    // Test 6: Missing Idempotency-Key header — 400
    // -------------------------------------------------------------------------
    @Test
    void shouldReturn400WhenIdempotencyKeyMissing() throws Exception {
        Transaction original = seedPostedTransaction(USER_A, new BigDecimal("10.00"), "MISC");

        mockMvc.perform(post("/api/transactions/" + original.getId() + "/reverse")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("Authorization", "Bearer " + tokenA)
                        .content("{}"))
                .andExpect(status().isBadRequest());
    }

    // -------------------------------------------------------------------------
    // Test 7: Unknown original — 404
    // -------------------------------------------------------------------------
    @Test
    void shouldReturn404WhenOriginalNotFound() throws Exception {
        mockMvc.perform(post("/api/transactions/" + UUID.randomUUID() + "/reverse")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("Authorization", "Bearer " + tokenA)
                        .header("Idempotency-Key", UUID.randomUUID().toString())
                        .content("{}"))
                .andExpect(status().isNotFound());
    }

    // -------------------------------------------------------------------------
    // Test 8: Cross-tenant idempotency replay — user B replaying user A's key
    // must not return user A's row. The lookup is scoped by userId so B simply
    // sees no existing row and proceeds (here landing in 403 since the original
    // belongs to A; the critical assertion is that A's data is not echoed back).
    // -------------------------------------------------------------------------
    @Test
    void shouldNotLeakUserAReversalToUserBOnIdempotencyReplay() throws Exception {
        Transaction original = seedPostedTransaction(USER_A, new BigDecimal("123.45"), "FOOD");
        String sharedKey = UUID.randomUUID().toString();

        // User A successfully creates a reversal under sharedKey
        mockMvc.perform(post("/api/transactions/" + original.getId() + "/reverse")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("Authorization", "Bearer " + tokenA)
                        .header("Idempotency-Key", sharedKey)
                        .content("{}"))
                .andReturn();

        UUID userAReversalId = transactionRepository.findByIdempotencyKeyAndUserId(sharedKey, USER_A)
                .orElseThrow().getId();

        // User B replays the same Idempotency-Key against A's transaction.
        // Without user-scoped idempotency lookup, this would return A's reversal row (data leak).
        // With the fix, B is treated as a fresh request and authorization rejects it as 403.
        String userBToken = buildJwt(UUID.randomUUID());
        var result = mockMvc.perform(post("/api/transactions/" + original.getId() + "/reverse")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("Authorization", "Bearer " + userBToken)
                        .header("Idempotency-Key", sharedKey)
                        .content("{}"))
                .andReturn();

        // The response must not be a 200 echoing user A's reversal id.
        int statusCode = result.getResponse().getStatus();
        String body = result.getResponse().getContentAsString();
        assertThat(statusCode).isNotEqualTo(200);
        assertThat(body).doesNotContain(userAReversalId.toString());
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private Transaction seedPostedTransaction(UUID userId, BigDecimal amount, String category) {
        Transaction tx = new Transaction();
        tx.setAccountId(UUID.randomUUID());
        tx.setUserId(userId);
        tx.setAmount(amount);
        tx.setCategory(category);
        tx.setDescription("Seed transaction");
        tx.setIdempotencyKey(UUID.randomUUID().toString());
        tx.setStatus(TransactionStatus.POSTED);
        return transactionRepository.save(tx);
    }

    private String buildJwt(UUID userId) {
        SecretKey key = Keys.hmacShaKeyFor(JWT_SECRET.getBytes(StandardCharsets.UTF_8));
        return Jwts.builder()
                .subject(userId.toString())
                .claim("email", "user@example.com")
                .claim("roles", "USER")
                .issuer(JWT_ISSUER)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + 3600000))
                .signWith(key)
                .compact();
    }
}
