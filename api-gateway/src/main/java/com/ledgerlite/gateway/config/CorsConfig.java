package com.ledgerlite.gateway.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.reactive.CorsWebFilter;
import org.springframework.web.cors.reactive.UrlBasedCorsConfigurationSource;

import java.util.List;

/**
 * Registers a CorsWebFilter driven by CorsProperties so the allowed-origins list
 * is env-overridable at deploy time.
 *
 * We use a programmatic CorsWebFilter rather than the globalcors YAML block
 * because Spring's relaxed binding can map a comma-separated env var
 * (LEDGERLITE_CORS_ALLOWED_ORIGINS) directly to List<String>, which the
 * globalcors YAML block cannot do natively.
 *
 * Methods and headers are pinned to the exact set the React frontend needs.
 * allowCredentials is false — the frontend uses Bearer tokens, not cookies.
 */
@Configuration
@EnableConfigurationProperties(CorsProperties.class)
public class CorsConfig {

    @Bean
    public CorsWebFilter corsWebFilter(CorsProperties props) {
        CorsConfiguration config = new CorsConfiguration();

        config.setAllowedOrigins(props.allowedOrigins());
        config.setAllowedMethods(List.of("GET", "POST", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("Content-Type", "Authorization", "Idempotency-Key"));
        config.setAllowCredentials(false);
        // Cache preflight response for 30 minutes to reduce OPTIONS round-trips
        config.setMaxAge(1800L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);

        return new CorsWebFilter(source);
    }
}
