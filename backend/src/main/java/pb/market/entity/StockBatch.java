package pb.market.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.LocalDate;

@Entity
@Table(name = "stock_batches")
@Data
public class StockBatch {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "variant_id", nullable = false)
    private ProductVariant variant;

    private BigDecimal acquisitionPrice; // price paid for THIS batch
    private Integer quantity;            // units in this batch
    private Integer remainingQuantity;   // units not yet sold
    private LocalDateTime restockedAt;

    // Supplier that provided this specific batch
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "supplier_id")
    private Supplier supplier;

    // Whether this batch is consigned (not owned outright)
    @Column(nullable = false)
    private boolean consigned = false;

    // Status of the batch: PENDING, INCOMING, or RECEIVED
    @Column(nullable = false, length = 20)
    private String status = "RECEIVED";

    // Groups items added in the same "Batch Add" action for reverting
    @Column(name = "batch_id", length = 36)
    private String batchId;

    // Expected arrival date for INCOMING stock
    @Column(name = "eta")
    private LocalDate eta;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "branch_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private Branch branch;


    @PrePersist
    public void prePersist() {
        if (this.restockedAt == null) {
            this.restockedAt = LocalDateTime.now();
        }
        // remainingQuantity is always set explicitly by callers (addStock, batchReceive, etc.)
        // Do NOT auto-fill from quantity here — INCOMING batches intentionally set it to 0.
    }
}