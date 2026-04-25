CREATE TABLE monthly_spending (
    user_id UUID NOT NULL,
    account_id UUID NOT NULL,
    year_month VARCHAR(7) NOT NULL,
    category VARCHAR(100) NOT NULL,
    total_amount NUMERIC(19, 4) NOT NULL DEFAULT 0,
    transaction_count INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, account_id, year_month, category)
);

CREATE TABLE processed_transactions (
    transaction_id UUID PRIMARY KEY,
    processed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
