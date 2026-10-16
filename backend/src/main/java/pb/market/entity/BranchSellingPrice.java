package pb.market.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Allows each branch to override the default selling price for a specific variant.
 * Unique constraint ensures one price override per branch per variant.
 */
@Entity
@Table(
    name = "branch_selling_prices",
    uniqueConstraints = @UniqueConstraint(columnNames = {"branch_id", "variant_id"})
)
@Data
public class BranchSellingPrice {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "branch_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private Branch branch;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "variant_id", nullable = false)
    @JsonIgnoreProperties({"variants", "hibernateLazyInitializer", "handler"})
    private ProductVariant variant;

    /** The branch's custom selling price for this variant */
    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal sellingPrice;

    private LocalDateTime updatedAt;

    @PrePersist
    @PreUpdate
    protected void onSave() {
        this.updatedAt = LocalDateTime.now();
    }
}
