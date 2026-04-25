package com.ledgerlite.account.controller;

import com.ledgerlite.account.dto.*;
import com.ledgerlite.account.entity.Account;
import com.ledgerlite.account.repository.AccountRepository;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/accounts")
public class AccountController {

    private final AccountRepository accountRepository;

    public AccountController(AccountRepository accountRepository) {
        this.accountRepository = accountRepository;
    }

    @PostMapping
    public ResponseEntity<AccountResponse> create(@AuthenticationPrincipal String userId,
                                                   @Valid @RequestBody CreateAccountRequest request) {
        Account account = new Account();
        account.setUserId(UUID.fromString(userId));
        account.setName(request.name());
        account.setType(request.type());
        if (request.currency() != null) {
            account.setCurrency(request.currency());
        }
        account = accountRepository.save(account);
        return ResponseEntity.status(HttpStatus.CREATED).body(AccountResponse.from(account));
    }

    @GetMapping
    public ResponseEntity<List<AccountResponse>> list(@AuthenticationPrincipal String userId) {
        List<AccountResponse> accounts = accountRepository.findByUserId(UUID.fromString(userId))
                .stream()
                .map(AccountResponse::from)
                .toList();
        return ResponseEntity.ok(accounts);
    }

    @GetMapping("/{id}")
    public ResponseEntity<AccountResponse> get(@AuthenticationPrincipal String userId,
                                               @PathVariable UUID id) {
        Account account = accountRepository.findByIdAndUserId(id, UUID.fromString(userId))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Account not found"));
        return ResponseEntity.ok(AccountResponse.from(account));
    }

    @PatchMapping("/{id}/balance")
    public ResponseEntity<AccountResponse> updateBalance(@AuthenticationPrincipal String userId,
                                                         @PathVariable UUID id,
                                                         @Valid @RequestBody BalanceUpdateRequest request) {
        Account account = accountRepository.findByIdAndUserId(id, UUID.fromString(userId))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Account not found"));

        if (!account.getVersion().equals(request.expectedVersion())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Version mismatch: expected " + request.expectedVersion() + ", actual " + account.getVersion());
        }

        account.setBalance(account.getBalance().add(request.delta()));
        account = accountRepository.save(account);
        return ResponseEntity.ok(AccountResponse.from(account));
    }
}
