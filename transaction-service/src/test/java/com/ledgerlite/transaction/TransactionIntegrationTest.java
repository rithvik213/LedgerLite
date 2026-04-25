package com.ledgerlite.transaction;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ledgerlite.transaction.dto.CreateTransactionRequest;
import com.ledgerlite.transaction.entity.Transaction;
import com.ledgerlite.transaction.repository.TransactionRepository;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import javax.crypto.SecretKey;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Integration test for the transaction POST flow.
 * Requires Postgres and Kafka to be running (via docker-compose.infra.yml).
 *
 * Run with: ./mvnw test -Dspring.profiles.active=test
 *
 * The Feign client to account-service is not available in this test context,
 * so transactions will end up in FAILED state. This test verifies:
 * persistence, idempotency replay, and the overall request/response flow.
 *
 * Note: When Testcontainers compatibility with Docker Desktop 4.70+ is resolved,
 * this test can be converted back to use @Testcontainers with PostgreSQLContainer
 * and KafkaContainer for full isolation.
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
class TransactionIntegrationTest {

    private static final String JWT_SECRET = "super-secret-dev-key-that-is-at-least-256-bits-long-for-hs256";
    private static final String JWT_ISSUER = "ledgerlite";
    private static final UUID TEST_USER_ID = UUID.randomUUID();

    @Autowired
    MockMvc mockMvc;

    @Autowired
    ObjectMapper objectMapper;

    @Autowired
    TransactionRepository transactionRepository;

    private String jwtToken;

    @BeforeEach
    void setUp() {
        transactionRepository.deleteAll();
        SecretKey key = Keys.hmacShaKeyFor(JWT_SECRET.getBytes(StandardCharsets.UTF_8));
        jwtToken = Jwts.builder()
                .subject(TEST_USER_ID.toString())
                .claim("email", "test@example.com")
                .claim("roles", "USER")
                .issuer(JWT_ISSUER)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + 3600000))
                .signWith(key)
                .compact();
    }

    @Test
    void shouldPersistTransactionAndReplayIdempotentRequest() throws Exception {
        UUID accountId = UUID.randomUUID();
        String idempotencyKey = UUID.randomUUID().toString();

        var request = new CreateTransactionRequest(accountId, new BigDecimal("50.00"), "FOOD", "Lunch");
        String json = objectMapper.writeValueAsString(request);

        // First request — transaction will be FAILED because account-service is not running,
        // but it should still be persisted
        mockMvc.perform(post("/api/transactions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("Authorization", "Bearer " + jwtToken)
                        .header("Idempotency-Key", idempotencyKey)
                        .content(json))
                .andExpect(jsonPath("$.idempotencyKey").value(idempotencyKey))
                .andExpect(jsonPath("$.accountId").value(accountId.toString()))
                .andExpect(jsonPath("$.amount").value(50.00));

        // Verify persisted in DB
        Optional<Transaction> saved = transactionRepository.findByIdempotencyKey(idempotencyKey);
        assertThat(saved).isPresent();
        assertThat(saved.get().getUserId()).isEqualTo(TEST_USER_ID);

        // Second request with same idempotency key — should return the original (idempotent replay)
        mockMvc.perform(post("/api/transactions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("Authorization", "Bearer " + jwtToken)
                        .header("Idempotency-Key", idempotencyKey)
                        .content(json))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(saved.get().getId().toString()));

        // Verify only one transaction exists for this key
        assertThat(transactionRepository.findAll().size()).isEqualTo(1);
    }

    @Test
    void shouldRejectRequestWithoutIdempotencyKey() throws Exception {
        var request = new CreateTransactionRequest(UUID.randomUUID(), new BigDecimal("25.00"), "FOOD", "Coffee");
        String json = objectMapper.writeValueAsString(request);

        mockMvc.perform(post("/api/transactions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("Authorization", "Bearer " + jwtToken)
                        .content(json))
                .andExpect(status().isBadRequest());
    }

    @Test
    void shouldRejectRequestWithoutJwt() throws Exception {
        var request = new CreateTransactionRequest(UUID.randomUUID(), new BigDecimal("25.00"), "FOOD", "Coffee");
        String json = objectMapper.writeValueAsString(request);

        mockMvc.perform(post("/api/transactions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("Idempotency-Key", UUID.randomUUID().toString())
                        .content(json))
                .andExpect(status().isForbidden());
    }
}
