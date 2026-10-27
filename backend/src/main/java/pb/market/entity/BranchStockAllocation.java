package pb.market.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Records every stock transfer from Admin → Branch.
 * Tracks the cost charged to the branch, payment deadline, and payment status.
 */
@Entity
@Table(name = "branch_stock_allocations")
@Data
public class BranchStockAllocation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** The branch receiving the stock */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "branch_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private Branch branch;

    /** The paddle variant being allocated */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "variant_id", nullable = false)
    @JsonIgnoreProperties({"variants", "hibernateLazyInitializer", "handler"})
    private ProductVariant variant;

    /** Number of units transferred to the branch */
    @Column(nullable = false)
    private Integer quantity;

    /** Price per unit that the branch owes admin */
    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal costPerUnit;

    /** Admin's acquisition cost per unit (e.g. ₱37.50) */
    @Column(name = "admin_cost_per_unit", precision = 12, scale = 2)
    private BigDecimal adminCostPerUnit;

    /** quantity × costPerUnit — convenience field, computed on save */
    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal totalCost;

    /** Payment due date set by admin */
    @Column(nullable = false)
    private LocalDate deadline;

    /** How much the branch has paid so far (default 0) */
    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal amountPaid = BigDecimal.ZERO;

    /** PENDING / PARTIAL / PAID */
    @Column(nullable = false, length = 20)
    private String status = "PENDING";

    /** Optional admin notes for this allocation */
    @Column(columnDefinition = "TEXT")
    private String notes;

    /** Groups all items created in the same allocation session */
    @Column(name = "admin_batch_id", length = 36)
    private String adminBatchId;

    /** Reference to the StockBatch row created at the branch for this allocation */
    @Column(name = "stock_batch_id")
    private Long stockBatchId;

    private LocalDateTime allocatedAt;

    @PrePersist
    protected void onCreate() {
        if (this.allocatedAt == null) this.allocatedAt = LocalDateTime.now();
        if (this.amountPaid == null) this.amountPaid = BigDecimal.ZERO;
        if (this.status == null) this.status = "PENDING";
        // Compute totalCost from quantity × costPerUnit
        if (this.totalCost == null && this.quantity != null && this.costPerUnit != null) {
            this.totalCost = this.costPerUnit.multiply(BigDecimal.valueOf(this.quantity));
        }
    }
}
