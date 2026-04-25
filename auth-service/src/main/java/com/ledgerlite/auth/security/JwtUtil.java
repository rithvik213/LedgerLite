package com.ledgerlite.auth.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;

/**
 * JWT helper — duplicated per service rather than extracted into a shared library.
 * At this scale (4 services) the duplication is cheaper than the version-coordination
 * overhead a shared JAR introduces. Revisit if service count grows past ~8.
 */
@Component
public class JwtUtil {

    private final SecretKey key;
    private final long ttlMillis;
    private final String issuer;

    public JwtUtil(
            @Value("${ledgerlite.jwt.secret}") String secret,
            @Value("${ledgerlite.jwt.ttl}") long ttlMillis,
            @Value("${ledgerlite.jwt.issuer}") String issuer) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.ttlMillis = ttlMillis;
        this.issuer = issuer;
    }

    public String generateToken(UUID userId, String email, String roles) {
        Instant now = Instant.now();
        Instant expiry = now.plusMillis(ttlMillis);

        return Jwts.builder()
                .subject(userId.toString())
                .claim("email", email)
                .claim("roles", roles)
                .issuer(issuer)
                .issuedAt(Date.from(now))
                .expiration(Date.from(expiry))
                .signWith(key)
                .compact();
    }

    public Claims parseToken(String token) {
        return Jwts.parser()
                .verifyWith(key)
                .requireIssuer(issuer)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    public Instant getExpiry(String token) {
        return parseToken(token).getExpiration().toInstant();
    }

    public long getTtlMillis() {
        return ttlMillis;
    }
}
