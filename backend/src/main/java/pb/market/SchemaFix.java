package pb.market;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class SchemaFix implements CommandLineRunner {

    private final JdbcTemplate jdbcTemplate;

    @Override
    public void run(String... args) throws Exception {
        log.info("Checking database schema for missing columns and constraints...");

        // ── Column migrations (idempotent) ─────────────────────────────────────
        safeExecute("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS consigned BOOLEAN DEFAULT FALSE",
                "Column 'consigned' checked/added to 'transactions' table.");

        safeExecute("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS cost_price DECIMAL(19,2)",
                "Column 'cost_price' checked/added to 'transactions' table.");

        safeExecute("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS supplier_id BIGINT",
                "Column 'supplier_id' checked/added to 'transactions' table.");

        safeExecute("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS transaction_type VARCHAR(255) DEFAULT 'REGULAR'",
                "Column 'transaction_type' checked/added to 'transactions' table.");

        safeExecute("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS consignee_id BIGINT",
                "Column 'consignee_id' checked/added to 'transactions' table.");

        safeExecute("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS notes TEXT",
                "Column 'notes' checked/added to 'transactions' table.");

        // Backfill old transactions
        safeExecute("UPDATE transactions SET transaction_type = 'REGULAR' WHERE transaction_type IS NULL",
                "Backfilled existing transactions with 'REGULAR' type.");

        // ── Data integrity fixes ───────────────────────────────────────────────
        // Fix any existing negative remaining_quantity (could happen from old race conditions)
        safeExecute("UPDATE stock_batches SET remaining_quantity = 0 WHERE remaining_quantity < 0",
                "Fixed any negative remaining_quantity rows in stock_batches.");

        // ── Database constraints (safe for concurrent backend instances) ───────
        // CHECK: remaining_quantity can never go negative at the DB level
        safeExecute("ALTER TABLE stock_batches ADD CONSTRAINT chk_remaining_non_negative CHECK (remaining_quantity >= 0)",
                "CHECK constraint chk_remaining_non_negative added to stock_batches.");

        // FK: transactions.stock_batch_id → ON DELETE SET NULL (prevents 500 on batch deletion)
        safeExecute("ALTER TABLE transactions DROP CONSTRAINT IF EXISTS fk_tx_stock_batch",
                "Dropped old FK constraint fk_tx_stock_batch (if any).");
        safeExecute("ALTER TABLE transactions ADD CONSTRAINT fk_tx_stock_batch " +
                    "FOREIGN KEY (stock_batch_id) REFERENCES stock_batches(id) ON DELETE SET NULL",
                "FK constraint fk_tx_stock_batch with ON DELETE SET NULL added.");

        // ── Data migrations ────────────────────────────────────────────────────
        // Rename old 'Bank Transfer' payment method to 'Banko'
        safeExecute("UPDATE transactions SET payment_method = 'Banko' WHERE payment_method = 'Bank Transfer'",
                "Renamed 'Bank Transfer' payment method to 'Banko' in existing transactions.");

        // ── Payment Logs table ────────────────────────────────────────────────
        safeExecute("CREATE TABLE IF NOT EXISTS payment_logs (" +
                "id BIGSERIAL PRIMARY KEY, " +
                "transaction_id BIGINT REFERENCES transactions(id) ON DELETE CASCADE, " +
                "order_id VARCHAR(255), " +
                "amount DECIMAL(19,2), " +
                "cost_portion DECIMAL(19,2), " +
                "payment_date TIMESTAMP, " +
                "payment_method VARCHAR(255))",
                "Created payment_logs table.");

        // Backfill: create payment log entries for existing FULL transactions
        // Only run if the table is empty (avoid duplicates on repeated startups)
        try {
            Integer count = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM payment_logs", Integer.class);
            if (count != null && count == 0) {
                // Backfill FULL transactions: payment amount = finalPrice, date = transactionDate
                int fullRows = jdbcTemplate.update(
                    "INSERT INTO payment_logs (transaction_id, order_id, amount, cost_portion, payment_date, payment_method) " +
                    "SELECT t.id, COALESCE(t.transaction_id, 'LEGACY-' || t.id), t.final_price, COALESCE(t.cost_price, 0), " +
                    "t.transaction_date, COALESCE(t.payment_method, 'Unknown') " +
                    "FROM transactions t WHERE t.status = 'FULL' AND t.final_price IS NOT NULL AND t.final_price > 0"
                );
                log.info("Backfilled " + fullRows + " payment logs for FULL transactions.");

                // Backfill PARTIAL transactions: payment amount = downpayment, date = transactionDate
                int partialRows = jdbcTemplate.update(
                    "INSERT INTO payment_logs (transaction_id, order_id, amount, cost_portion, payment_date, payment_method) " +
                    "SELECT t.id, COALESCE(t.transaction_id, 'LEGACY-' || t.id), t.downpayment, " +
                    "CASE WHEN t.final_price > 0 THEN COALESCE(t.cost_price, 0) * t.downpayment / t.final_price ELSE 0 END, " +
                    "t.transaction_date, COALESCE(t.payment_method, 'Unknown') " +
                    "FROM transactions t WHERE t.status = 'PARTIAL' AND t.downpayment IS NOT NULL AND t.downpayment > 0"
                );
                log.info("Backfilled " + partialRows + " payment logs for PARTIAL transactions.");
            } else {
                log.info("Payment logs table already has data, skipping backfill.");
            }
        } catch (Exception e) {
            log.info("Payment logs backfill skipped: " + e.getMessage());
        }

        // Drop warehouse_id columns and constraints if they exist
        safeExecute("ALTER TABLE stock_batches DROP COLUMN IF EXISTS warehouse_id CASCADE",
                "Dropped warehouse_id from stock_batches.");

        safeExecute("ALTER TABLE stock_adjustments DROP COLUMN IF EXISTS warehouse_id CASCADE",
                "Dropped warehouse_id from stock_adjustments.");

        // Drop warehouses table
        safeExecute("DROP TABLE IF EXISTS warehouses CASCADE",
                "Dropped warehouses table.");

        // Stock Requests tables (Branch stock requests from Master Storage)
        safeExecute("CREATE TABLE IF NOT EXISTS stock_requests (" +
                "id BIGSERIAL PRIMARY KEY, " +
                "request_number VARCHAR(32) NOT NULL UNIQUE, " +
                "branch_id BIGINT NOT NULL REFERENCES branches(id) ON DELETE CASCADE, " +
                "requested_by_username VARCHAR(100) NOT NULL, " +
                "status VARCHAR(20) NOT NULL DEFAULT 'PENDING', " +
                "notes TEXT, " +
                "admin_notes TEXT, " +
                "admin_batch_id VARCHAR(64), " +
                "created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP, " +
                "reviewed_at TIMESTAMP WITHOUT TIME ZONE, " +
                "reviewed_by_username VARCHAR(100)" +
                ")", "Table 'stock_requests' verified/created.");

        safeExecute("CREATE TABLE IF NOT EXISTS stock_request_items (" +
                "id BIGSERIAL PRIMARY KEY, " +
                "request_id BIGINT NOT NULL REFERENCES stock_requests(id) ON DELETE CASCADE, " +
                "variant_id BIGINT NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT, " +
                "requested_quantity INT NOT NULL CHECK (requested_quantity > 0), " +
                "approved_quantity INT DEFAULT 0, " +
                "status VARCHAR(20) NOT NULL DEFAULT 'PENDING'" +
                ")", "Table 'stock_request_items' verified/created.");

        // Add payment_source column to expenses if not exists
        safeExecute("ALTER TABLE expenses ADD COLUMN IF NOT EXISTS payment_source VARCHAR(50) DEFAULT 'Cash Drawer'",
                "Added payment_source to expenses.");

        // Clear branch_id for ADMIN users (Admin holds unallocated stock)
        safeExecute("UPDATE users SET branch_id = NULL WHERE role = 'ADMIN'",
                "Cleared branch_id for admin users.");

        log.info("Schema check complete.");
    }

    /** Execute SQL silently — if it fails (e.g. constraint already exists), just log and move on. */
    private void safeExecute(String sql, String successMsg) {
        try {
            jdbcTemplate.execute(sql);
            log.info(successMsg);
        } catch (Exception e) {
            log.info("Skipped (already applied or not needed): " + e.getMessage());
        }
    }
}
