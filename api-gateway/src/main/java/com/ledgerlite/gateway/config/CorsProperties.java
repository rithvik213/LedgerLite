package com.ledgerlite.gateway.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.List;

/**
 * Externalises the CORS allowed-origins list so production deployments can
 * override it without rebuilding the image.
 *
 * Set LEDGERLITE_CORS_ALLOWED_ORIGINS to a comma-separated list of origins
 * (Spring's relaxed binding converts the env var to the list automatically).
 *
 * Dev default is http://localhost:5173 (Vite). In production, set the env var
 * to your actual frontend origin(s), e.g. "https://app.example.com".
 */
@ConfigurationProperties(prefix = "ledgerlite.cors")
public record CorsProperties(List<String> allowedOrigins) {
}
