package com.ledgerlite.account.config;

import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;
import org.springframework.boot.autoconfigure.jackson.Jackson2ObjectMapperBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.math.BigDecimal;

/**
 * Serialize {@link BigDecimal} as a JSON string instead of a JSON number.
 *
 * <p>Reason: the frontend models money as a string end-to-end (BigInt-based
 * arithmetic via {@code lib/decimal.ts}) to avoid floating-point drift on
 * NUMERIC(19,4) values. Jackson's default emits BigDecimal as a JSON number,
 * which the frontend then receives as a JS {@code number} despite its declared
 * {@code string} TS type — that crashed {@code sumDecimalStrings} on contact.
 * Sending a string preserves precision over the wire and matches the contract.
 */
@Configuration
public class JacksonConfig {
    @Bean
    public Jackson2ObjectMapperBuilderCustomizer bigDecimalAsString() {
        return builder -> builder.serializerByType(BigDecimal.class, ToStringSerializer.instance);
    }
}
