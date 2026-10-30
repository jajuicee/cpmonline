package pb.market.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Data;

import java.math.BigDecimal;

@Entity
@Table(name = "product_variants")
@Data
public class ProductVariant {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String sku;

    private String color;
    private Integer thicknessMm;
    private String shape;

    private BigDecimal acquisitionPrice;
    private BigDecimal sellingPrice;

    @Column(name = "recommended_selling_price")
    private BigDecimal recommendedSellingPrice;
    // Computed from stock_batches in ProductService.getAllProducts() — NOT stored in DB.
    // Using @Transient instead of @Formula avoids N+1 subqueries and stale-read bugs.
    @Transient
    private Integer stockQuantity;

    // Below this threshold the variant is flagged as "low stock" in the UI. null = use system default.
    private Integer lowStockThreshold;

    @Transient
    private BigDecimal branchSellingPrice;

    @Transient
    private Boolean hasCustomPrice = false;

    
    // Virtual fields using subqueries (formula) to count all-time additions and sales.
    // POPULATED MANUALLY IN ProductService
    @Transient
    private Long totalAdded = 0L;

    @Transient
    private Long totalSold = 0L;

    @Transient
    private Long totalAdjusted = 0L;

    // Total units transferred/allocated to branches
    @Transient
    private Long totalTransferred = 0L;

    // Remaining stock in Holding Pool (unallocated at CPM Main)
    @Transient
    private Integer mainStock = 0;

    // Remaining stock currently distributed across branches (awaiting sale)
    @Transient
    private Integer branchStock = 0;

    // Live breakdown of locations and remaining stock per location
    @Transient
    private java.util.List<java.util.Map<String, Object>> locationBreakdown;

    // Whether this variant is consigned (affects default for new batches)
    @Column(columnDefinition = "boolean default false")
    private boolean consigned = false;

    // Default partner flag (e.g. Pickle Gear 50/50)
    @Column(columnDefinition = "boolean default false")
    private boolean partner = false;

    @Column(name = "partner_name")
    private String partnerName;

    @Column(name = "partner_split_pct")
    private BigDecimal partnerSplitPct = new BigDecimal("50.00");

    @Transient
    private Integer partnerStock = 0;

    @Transient
    private Integer ownedStock = 0;

    @Transient
    private String activePartnerName;

    // Serialize the parent product (brand/model/category) but not its variants list
    // to avoid circular reference, and ignore Hibernate proxy handlers to prevent 500 errors on lazy loads.
    @JsonIgnoreProperties({"variants", "hibernateLazyInitializer", "handler"})
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id")
    private Product product;

    // Default supplier for this paddle variant
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "default_supplier_id")
    private Supplier defaultSupplier;
}
