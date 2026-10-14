package pb.market.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Entity
@Table(name = "stock_adjustments")
@Data
public class StockAdjustment {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // The client already knows which variant they queried — no need to re-serialize it,
    // and lazy-loading the proxy outside a session (open-in-view=false) would 500.
    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "variant_id", nullable = false)
    private ProductVariant variant;

    // Positive count of units removed from stock as a manual adjustment (not a sale).
    @Column(nullable = false)
    private Integer quantity;

    // Free-text reason — typical values: "Return to Supplier", "Damaged / Lost", "Manual Adjustment".
    @Column(nullable = false, length = 64)
    private String reason;

    @Column(columnDefinition = "TEXT")
    private String note;

    @com.fasterxml.jackson.annotation.JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "branch_id")
    private Branch branch;

    @Column(nullable = false)
    private LocalDateTime adjustedAt;

    @PrePersist
    protected void onCreate() {
        if (this.adjustedAt == null) this.adjustedAt = LocalDateTime.now();
    }
}
