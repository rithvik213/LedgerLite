package com.ledgerlite.analytics.repository;

import com.ledgerlite.analytics.entity.ProcessedTransaction;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.UUID;

public interface ProcessedTransactionRepository extends JpaRepository<ProcessedTransaction, UUID> {
}
